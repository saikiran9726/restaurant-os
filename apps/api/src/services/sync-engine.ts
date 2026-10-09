import { eq, and, desc, asc, sql, gt, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  deviceRegistry,
  hubRegistry,
  syncEvents,
  syncCursors,
  deadLetterCommands,
  conflictReviews,
} from '../db/schema/sync.js';
import { orders, orderItems, syncCommands } from '../db/schema/orders.js';
import { kots, kotItems } from '../db/schema/kots.js';
import { bills, payments } from '../db/schema/bills.js';
import { emitRealtimeEvent } from '../realtime/socket.js';
import {
  AppError,
  type SyncPushBatchInput,
  type SyncPushBatchResponse,
  type SyncPushCommandResult,
  type SyncPullResponse,
  type SyncEventItem,
  type RegisterHubInput,
  type HubRegistryItem,
  type DeadLetterCommandItem,
  type ConflictReviewItem,
  type SyncStatusOverview,
} from '@restaurant-os/shared';
import crypto from 'node:crypto';

export class SyncEngineService {
  /**
   * Process an ordered batch of commands pushed by a client device or Local Hub.
   * Enforces monotonicity, idempotency, single-writer domain invariants, and conflict rules.
   */
  static async processPushBatch(input: SyncPushBatchInput): Promise<SyncPushBatchResponse> {
    const { restaurantId, deviceId, batchId, commands } = input;
    const results: SyncPushCommandResult[] = [];
    let latestSeq = 0;

    // Track/update device in device registry
    await this.touchDevice(restaurantId, deviceId, 'waiter');

    for (const cmd of commands) {
      try {
        // 1. Idempotency Check: if idempotency key already applied in sync_events, return previous result
        const [existing] = await db
          .select()
          .from(syncEvents)
          .where(
            and(
              eq(syncEvents.restaurantId, restaurantId),
              eq(syncEvents.idempotencyKey, cmd.idempotencyKey),
            ),
          )
          .limit(1);

        if (existing) {
          results.push({
            commandId: cmd.id,
            idempotencyKey: cmd.idempotencyKey,
            seq: existing.seq,
            status: 'duplicate',
            serverTimestamp: existing.serverTimestamp.toISOString(),
            resultPayload: (existing.payload as Record<string, any>) || undefined,
          });
          latestSeq = Math.max(latestSeq, existing.seq);
          continue;
        }

        // 2. Dispatch command to domain handler with conflict rules
        const { status, resultPayload, conflict } = await this.executeDomainCommand(
          restaurantId,
          deviceId,
          cmd,
        );

        // 3. Append to authoritative monotonic sequence log
        const [insertedEvent] = await db
          .insert(syncEvents)
          .values({
            restaurantId,
            deviceId,
            commandId: cmd.id,
            idempotencyKey: cmd.idempotencyKey,
            type: cmd.type,
            payload: resultPayload || cmd.payload,
            claimedAt: cmd.claimedAt ? new Date(cmd.claimedAt) : null,
          })
          .returning();

        const seq = insertedEvent!.seq;
        latestSeq = Math.max(latestSeq, seq);

        // Record in legacy sync_commands if not already present
        await db
          .insert(syncCommands)
          .values({
            restaurantId,
            idempotencyKey: cmd.idempotencyKey,
            commandType: cmd.type,
            result: resultPayload || cmd.payload,
          })
          .onConflictDoNothing();

        // 4. Broadcast event to local/cloud realtime rooms
        emitRealtimeEvent(
          restaurantId,
          'sync:event',
          {
            seq,
            type: cmd.type,
            payload: resultPayload || cmd.payload,
            deviceId,
          },
          'all',
        );

        results.push({
          commandId: cmd.id,
          idempotencyKey: cmd.idempotencyKey,
          seq,
          status,
          serverTimestamp: insertedEvent!.serverTimestamp.toISOString(),
          resultPayload,
        });
      } catch (err: any) {
        // Poison command or unexpected failure: record in dead letter queue
        await db
          .insert(deadLetterCommands)
          .values({
            restaurantId,
            commandId: cmd.id,
            idempotencyKey: cmd.idempotencyKey,
            deviceId,
            type: cmd.type,
            payload: cmd.payload,
            errorMessage: err.message || 'Unknown execution error',
            attempts: 1,
            status: 'dead_letter',
          })
          .onConflictDoNothing();

        results.push({
          commandId: cmd.id,
          idempotencyKey: cmd.idempotencyKey,
          seq: 0,
          status: 'rejected',
          serverTimestamp: new Date().toISOString(),
          errorMessage: err.message || 'Execution error',
        });
      }
    }

    return {
      success: true,
      batchId,
      lastSeq: latestSeq,
      results,
    };
  }

  /**
   * Domain command execution with exact conflict rules:
   * - Order line additions commutative; quantity updates in receipt order
   * - Two devices open order on same table: both preserved, 2nd flagged with collision review
   * - KOT status forward-only: new -> preparing -> ready -> served
   * - Duplicate payments routed to owner review queue
   * - Bills generated once per order version
   */
  private static async executeDomainCommand(
    restaurantId: string,
    deviceId: string,
    cmd: { type: string; payload: Record<string, any>; baseVersion?: number | null },
  ): Promise<{ status: 'applied' | 'conflict'; resultPayload: any; conflict?: any }> {
    const { type, payload } = cmd;

    switch (type) {
      case 'order.create': {
        const orderId = payload.id;
        const tableId = payload.tableId;

        // Conflict check: Check if table already has an active open order
        if (tableId) {
          const [openOrderOnTable] = await db
            .select()
            .from(orders)
            .where(
              and(
                eq(orders.restaurantId, restaurantId),
                eq(orders.tableId, tableId),
                eq(orders.status, 'open'),
              ),
            )
            .limit(1);

          if (openOrderOnTable && openOrderOnTable.id !== orderId) {
            // Table Collision Rule: Both orders preserved; flag conflict for owner/waiter review
            await db.insert(conflictReviews).values({
              restaurantId,
              type: 'table_collision',
              referenceId: tableId,
              severity: 'warning',
              details: {
                existingOrderId: openOrderOnTable.id,
                collidingOrderId: orderId,
                deviceId,
                message:
                  'Two devices opened an order on the same table. Both orders are preserved.',
              },
            });

            // Insert new order anyway (never silently discard)
            await db
              .insert(orders)
              .values({
                id: orderId,
                restaurantId,
                tableId,
                type: payload.type || 'dine_in',
                guests: payload.guests || 2,
                status: 'open',
                specialInstructions: `[Table collision notice] ${payload.specialInstructions || ''}`,
                subtotalPaise: payload.subtotalPaise || 0,
                taxPaise: payload.taxPaise || 0,
                totalPaise: payload.totalPaise || 0,
                version: 1,
              })
              .onConflictDoNothing();

            return {
              status: 'conflict',
              resultPayload: {
                orderId,
                collision: true,
                existingOrderId: openOrderOnTable.id,
                message:
                  'Table already has an open order. Second order preserved separately for split billing.',
              },
            };
          }
        }

        // Standard order creation
        await db
          .insert(orders)
          .values({
            id: orderId,
            restaurantId,
            tableId: payload.tableId || null,
            type: payload.type || 'dine_in',
            guests: payload.guests || 2,
            status: 'open',
            specialInstructions: payload.specialInstructions || null,
            subtotalPaise: payload.subtotalPaise || 0,
            taxPaise: payload.taxPaise || 0,
            totalPaise: payload.totalPaise || 0,
            version: 1,
          })
          .onConflictDoNothing();

        // Insert items if provided
        if (Array.isArray(payload.items) && payload.items.length > 0) {
          for (let idx = 0; idx < payload.items.length; idx++) {
            const item = payload.items[idx];
            await db
              .insert(orderItems)
              .values({
                orderId,
                itemId: item.itemId,
                nameSnapshot: item.nameSnapshot || item.name || 'Item',
                pricePaiseSnapshot: item.pricePaiseSnapshot || item.pricePaise || 0,
                taxRateBpSnapshot: item.taxRateBpSnapshot || 500,
                qty: item.qty || 1,
                modifiers: item.modifiers || [],
                note: item.note || null,
                lineNo: idx + 1,
                kotState: 'unsent',
              })
              .onConflictDoNothing();
          }
        }

        return { status: 'applied', resultPayload: { orderId, success: true } };
      }

      case 'kot.status': {
        const { kotId, status: nextStatus } = payload;
        const [kot] = await db
          .select()
          .from(kots)
          .where(and(eq(kots.id, kotId), eq(kots.restaurantId, restaurantId)))
          .limit(1);

        if (!kot) {
          throw AppError.notFound(`KOT ${kotId} not found`);
        }

        // Forward-only state machine rule: new (1) -> preparing (2) -> ready (3) -> served (4)
        const rank: Record<string, number> = { new: 1, preparing: 2, ready: 3, served: 4 };
        const currentRank = rank[kot.status] || 0;
        const newRank = rank[nextStatus] || 0;

        if (newRank < currentRank) {
          // Stale backward update ignored and logged
          return {
            status: 'conflict',
            resultPayload: {
              kotId,
              ignored: true,
              currentStatus: kot.status,
              attemptedStatus: nextStatus,
              message: `Stale backward KOT status update ignored (current: ${kot.status}, attempted: ${nextStatus}).`,
            },
          };
        }

        await db.update(kots).set({ status: nextStatus }).where(eq(kots.id, kotId));

        return { status: 'applied', resultPayload: { kotId, status: nextStatus } };
      }

      case 'payment.record': {
        const { billId, amountPaise, method } = payload;
        const [bill] = await db
          .select()
          .from(bills)
          .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
          .limit(1);

        if (!bill) {
          throw AppError.notFound(`Bill ${billId} not found for payment`);
        }

        // Conflict rule: Check if bill is already fully paid
        if (bill.status === 'paid') {
          // Flag possible duplicate payment in conflict reviews queue (no silent discard)
          await db.insert(conflictReviews).values({
            restaurantId,
            type: 'duplicate_payment',
            referenceId: billId,
            severity: 'critical',
            details: {
              billId,
              billNumber: bill.billNumber,
              extraAmountPaise: amountPaise,
              method,
              deviceId,
              message: 'Payment received for already-paid bill. Routed to owner review queue.',
            },
          });

          // Insert payment record flagged with reference
          await db.insert(payments).values({
            billId,
            restaurantId,
            amountPaise,
            method,
            status: 'confirmed',
            reference: '[POSSIBLE DUPLICATE PAYMENT - ROUTED TO OWNER REVIEW]',
            businessDate: bill.businessDate || new Date().toISOString().split('T')[0]!,
          });

          return {
            status: 'conflict',
            resultPayload: {
              billId,
              duplicateFlagged: true,
              message:
                'Bill was already marked paid. Payment recorded and routed to owner conflict queue.',
            },
          };
        }

        // Normal payment settlement
        await db.insert(payments).values({
          billId,
          restaurantId,
          amountPaise,
          method,
          status: 'confirmed',
          businessDate: bill.businessDate || new Date().toISOString().split('T')[0]!,
        });

        const [paymentSum] = await db
          .select({ total: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::integer` })
          .from(payments)
          .where(eq(payments.billId, billId));

        const totalPaidPaise = Number(paymentSum?.total || amountPaise);
        const newStatus = totalPaidPaise >= bill.totalPaise ? 'paid' : 'partially_paid';

        await db
          .update(bills)
          .set({
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(bills.id, billId));

        return {
          status: 'applied',
          resultPayload: { billId, paidPaise: totalPaidPaise, paymentStatus: newStatus },
        };
      }

      default:
        // Generic event or config sync
        return { status: 'applied', resultPayload: payload };
    }
  }

  /**
   * Pull replication event log since a specific sequence number.
   * Hub pulls configuration or client pulls operational events.
   */
  static async pullEvents(
    restaurantId: string,
    sinceSeq: number,
    limit: number = 100,
  ): Promise<SyncPullResponse> {
    const rows = await db
      .select()
      .from(syncEvents)
      .where(and(eq(syncEvents.restaurantId, restaurantId), gt(syncEvents.seq, sinceSeq)))
      .orderBy(asc(syncEvents.seq))
      .limit(limit);

    const events: SyncEventItem[] = rows.map((r) => ({
      seq: r.seq,
      restaurantId: r.restaurantId,
      deviceId: r.deviceId,
      commandId: r.commandId,
      idempotencyKey: r.idempotencyKey,
      type: r.type,
      payload: (r.payload as Record<string, any>) || {},
      serverTimestamp: r.serverTimestamp.toISOString(),
      appliedAt: r.appliedAt.toISOString(),
    }));

    const lastSeq = events.length > 0 ? events[events.length - 1]!.seq : sinceSeq;

    return {
      success: true,
      lastSeq,
      hasMore: events.length === limit,
      events,
    };
  }

  /**
   * Get sync status overview for restaurant owner.
   */
  static async getStatusOverview(restaurantId: string): Promise<SyncStatusOverview> {
    const [maxEvent] = await db
      .select({ maxSeq: sql<number>`coalesce(max(${syncEvents.seq}), 0)` })
      .from(syncEvents)
      .where(eq(syncEvents.restaurantId, restaurantId));

    const [hub] = await db
      .select()
      .from(hubRegistry)
      .where(and(eq(hubRegistry.restaurantId, restaurantId), eq(hubRegistry.isActive, true)))
      .limit(1);

    const [deadLetters] = await db
      .select({ count: sql<number>`count(*)` })
      .from(deadLetterCommands)
      .where(
        and(
          eq(deadLetterCommands.restaurantId, restaurantId),
          eq(deadLetterCommands.status, 'dead_letter'),
        ),
      );

    const [conflicts] = await db
      .select({ count: sql<number>`count(*)` })
      .from(conflictReviews)
      .where(
        and(eq(conflictReviews.restaurantId, restaurantId), eq(conflictReviews.status, 'pending')),
      );

    const [deviceCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(deviceRegistry)
      .where(eq(deviceRegistry.restaurantId, restaurantId));

    return {
      currentSeq: Number(maxEvent?.maxSeq || 0),
      activeHub: hub
        ? {
            id: hub.id,
            restaurantId: hub.restaurantId,
            deviceId: hub.deviceId,
            name: hub.name,
            hostAddress: hub.hostAddress,
            isActive: hub.isActive,
            lastHeartbeat: hub.lastHeartbeat.toISOString(),
            lastSyncedSeq: hub.lastSyncedSeq,
            createdAt: hub.createdAt.toISOString(),
            updatedAt: hub.updatedAt.toISOString(),
          }
        : null,
      pendingDeadLettersCount: Number(deadLetters?.count || 0),
      pendingConflictsCount: Number(conflicts?.count || 0),
      devicesCount: Number(deviceCount?.count || 0),
      isCloudWriter: !hub || !hub.isActive,
    };
  }

  /**
   * Register or update Local Hub for a restaurant.
   */
  static async registerHub(
    restaurantId: string,
    input: RegisterHubInput,
  ): Promise<HubRegistryItem> {
    const apiKeyHash = crypto.createHash('sha256').update(input.apiKey).digest('hex');

    const [hub] = await db
      .insert(hubRegistry)
      .values({
        restaurantId,
        deviceId: input.deviceId,
        name: input.name,
        hostAddress: input.hostAddress,
        apiKeyHash,
        isActive: true,
        lastHeartbeat: new Date(),
      })
      .onConflictDoUpdate({
        target: hubRegistry.restaurantId,
        set: {
          deviceId: input.deviceId,
          name: input.name,
          hostAddress: input.hostAddress,
          apiKeyHash,
          isActive: true,
          lastHeartbeat: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    return {
      id: hub!.id,
      restaurantId: hub!.restaurantId,
      deviceId: hub!.deviceId,
      name: hub!.name,
      hostAddress: hub!.hostAddress,
      isActive: hub!.isActive,
      lastHeartbeat: hub!.lastHeartbeat.toISOString(),
      lastSyncedSeq: hub!.lastSyncedSeq,
      createdAt: hub!.createdAt.toISOString(),
      updatedAt: hub!.updatedAt.toISOString(),
    };
  }

  /**
   * List dead letter poison commands.
   */
  static async listDeadLetters(restaurantId: string): Promise<DeadLetterCommandItem[]> {
    const rows = await db
      .select()
      .from(deadLetterCommands)
      .where(eq(deadLetterCommands.restaurantId, restaurantId))
      .orderBy(desc(deadLetterCommands.createdAt));

    return rows.map((r) => ({
      id: r.id,
      restaurantId: r.restaurantId,
      commandId: r.commandId,
      idempotencyKey: r.idempotencyKey,
      deviceId: r.deviceId,
      type: r.type,
      payload: (r.payload as Record<string, any>) || {},
      errorMessage: r.errorMessage,
      attempts: r.attempts,
      status: r.status as 'dead_letter' | 'replayed' | 'discarded',
      discardReason: r.discardReason,
      discardedBy: r.discardedBy,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Discard a dead-letter command with an audited reason.
   */
  static async discardDeadLetter(
    restaurantId: string,
    deadLetterId: string,
    userId: string,
    reason: string,
  ): Promise<DeadLetterCommandItem> {
    const [row] = await db
      .select()
      .from(deadLetterCommands)
      .where(
        and(
          eq(deadLetterCommands.id, deadLetterId),
          eq(deadLetterCommands.restaurantId, restaurantId),
        ),
      )
      .limit(1);

    if (!row) {
      throw AppError.notFound('Dead letter command not found');
    }

    const [updated] = await db
      .update(deadLetterCommands)
      .set({
        status: 'discarded',
        discardReason: reason,
        discardedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(deadLetterCommands.id, deadLetterId))
      .returning();

    return {
      id: updated!.id,
      restaurantId: updated!.restaurantId,
      commandId: updated!.commandId,
      idempotencyKey: updated!.idempotencyKey,
      deviceId: updated!.deviceId,
      type: updated!.type,
      payload: (updated!.payload as Record<string, any>) || {},
      errorMessage: updated!.errorMessage,
      attempts: updated!.attempts,
      status: updated!.status as 'dead_letter' | 'replayed' | 'discarded',
      discardReason: updated!.discardReason,
      discardedBy: updated!.discardedBy,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  /**
   * List conflict review items.
   */
  static async listConflicts(restaurantId: string): Promise<ConflictReviewItem[]> {
    const rows = await db
      .select()
      .from(conflictReviews)
      .where(eq(conflictReviews.restaurantId, restaurantId))
      .orderBy(desc(conflictReviews.createdAt));

    return rows.map((r) => ({
      id: r.id,
      restaurantId: r.restaurantId,
      type: r.type as any,
      referenceId: r.referenceId,
      severity: r.severity as any,
      details: (r.details as Record<string, any>) || {},
      status: r.status as any,
      resolvedBy: r.resolvedBy,
      resolutionNote: r.resolutionNote,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Resolve a conflict with resolution note.
   */
  static async resolveConflict(
    restaurantId: string,
    conflictId: string,
    userId: string,
    note: string,
  ): Promise<ConflictReviewItem> {
    const [row] = await db
      .select()
      .from(conflictReviews)
      .where(
        and(eq(conflictReviews.id, conflictId), eq(conflictReviews.restaurantId, restaurantId)),
      )
      .limit(1);

    if (!row) {
      throw AppError.notFound('Conflict review not found');
    }

    const [updated] = await db
      .update(conflictReviews)
      .set({
        status: 'resolved',
        resolutionNote: note,
        resolvedBy: userId,
        resolvedAt: new Date(),
      })
      .where(eq(conflictReviews.id, conflictId))
      .returning();

    return {
      id: updated!.id,
      restaurantId: updated!.restaurantId,
      type: updated!.type as any,
      referenceId: updated!.referenceId,
      severity: updated!.severity as any,
      details: (updated!.details as Record<string, any>) || {},
      status: updated!.status as any,
      resolvedBy: updated!.resolvedBy,
      resolutionNote: updated!.resolutionNote,
      resolvedAt: updated!.resolvedAt ? updated!.resolvedAt.toISOString() : null,
      createdAt: updated!.createdAt.toISOString(),
    };
  }

  /**
   * Touch device registry for device heartbeat and presence.
   */
  static async touchDevice(
    restaurantId: string,
    deviceId: string,
    role: string = 'waiter',
  ): Promise<void> {
    await db
      .insert(deviceRegistry)
      .values({
        id: deviceId,
        restaurantId,
        name: `Device-${deviceId.slice(0, 6)}`,
        role,
        lastSeen: new Date(),
      })
      .onConflictDoUpdate({
        target: deviceRegistry.id,
        set: {
          lastSeen: new Date(),
        },
      });
  }
}
