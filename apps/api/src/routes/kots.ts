import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, and, asc, desc, gte, inArray, sql } from 'drizzle-orm';
import {
  Permissions,
  AppError,
  sendKotInputSchema,
  updateKotStatusSchema,
  serializeKitchenState,
  generateUuidV7,
  Roles,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { orders, orderItems, syncCommands } from '../db/schema/orders.js';
import { kots, kotItems, kotCounters } from '../db/schema/kots.js';
import { tables } from '../db/schema/tables.js';
import { menuItems } from '../db/schema/menu-items.js';
import { users } from '../db/schema/users.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';
import { emitRealtimeEvent } from '../realtime/socket.js';
import { verifyPin } from '../auth/crypto.js';

/**
 * Derives and updates order and table status based on all active KOT items for an order.
 */
async function syncOrderAndTableStatus(orderId: string, restaurantId: string, tx: any) {
  const allOrderKots = await tx
    .select()
    .from(kots)
    .where(and(eq(kots.orderId, orderId), eq(kots.restaurantId, restaurantId)));

  if (allOrderKots.length === 0) return;

  const kotIds = allOrderKots.map((k: any) => k.id);
  const allItems = await tx.select().from(kotItems).where(inArray(kotItems.kotId, kotIds));

  // Non-cancelled items
  const activeItems = allItems.filter(
    (i: any) => i.action !== 'cancel' && i.status !== 'cancelled',
  );

  let orderStatus: 'saved' | 'preparing' | 'ready' | 'served' = 'saved';
  let tableStatus: 'occupied' | 'preparing' | 'ready' = 'occupied';

  const allDone = activeItems.length > 0 && activeItems.every((i: any) => i.status === 'done');
  const allServed = allOrderKots.every((k: any) => k.status === 'served');

  if (allServed) {
    orderStatus = 'served';
    tableStatus = 'occupied';
  } else if (allDone) {
    orderStatus = 'ready';
    tableStatus = 'ready';
  } else if (
    activeItems.some(
      (i: any) => i.status === 'done' || allOrderKots.some((k: any) => k.status === 'preparing'),
    )
  ) {
    orderStatus = 'preparing';
    tableStatus = 'preparing';
  } else {
    orderStatus = 'saved';
    tableStatus = 'occupied';
  }

  // Update order status if changed
  await tx.update(orders).set({ updatedAt: new Date() }).where(eq(orders.id, orderId));

  // Update table status if bound
  const [order] = await tx
    .select({ tableId: orders.tableId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (order?.tableId) {
    await tx
      .update(tables)
      .set({ status: tableStatus, updatedAt: new Date() })
      .where(eq(tables.id, order.tableId));

    emitRealtimeEvent(
      restaurantId,
      'table.statusChanged',
      { tableId: order.tableId, status: tableStatus },
      'all',
    );
  }

  if (orderStatus === 'ready') {
    emitRealtimeEvent(
      restaurantId,
      'order.ready',
      { orderId, tableId: order?.tableId || null },
      'floor',
    );
  }
}

/**
 * Allocates next sequential KOT number for today in the given restaurant.
 */
async function allocateKotNumber(restaurantId: string, tx: any): Promise<number> {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Upsert kot_counter and increment atomically
  const result = await tx.execute(
    sql`INSERT INTO kot_counters (restaurant_id, business_date, last_kot_number, created_at, updated_at)
        VALUES (${restaurantId}, ${todayStr}::date, 1, NOW(), NOW())
        ON CONFLICT (restaurant_id, business_date)
        DO UPDATE SET last_kot_number = kot_counters.last_kot_number + 1, updated_at = NOW()
        RETURNING last_kot_number;`,
  );

  return result.rows[0].last_kot_number;
}

export async function registerKotRoutes(app: FastifyInstance): Promise<void> {
  // Route guards for security audit
  registerRouteGuard({
    method: 'POST',
    url: '/orders/:id/kots',
    isPublic: false,
    permission: Permissions.KOT_CREATE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/kots',
    isPublic: false,
    permission: Permissions.KOT_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/kots/:id/seen',
    isPublic: false,
    permission: Permissions.KOT_UPDATE_STATUS,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/kot-items/:id/done',
    isPublic: false,
    permission: Permissions.ITEM_COMPLETE,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/kots/:id/status',
    isPublic: false,
    permission: Permissions.KOT_UPDATE_STATUS,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/orders/:id/served',
    isPublic: false,
    permission: Permissions.KOT_UPDATE_STATUS,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/kitchen/state',
    isPublic: false,
    permission: Permissions.KOT_READ,
  });

  /**
   * POST /orders/:id/kots - SEND KOT (diff engine, sequential numbering, idempotent)
   */
  app.post(
    '/orders/:id/kots',
    { preHandler: [requirePermission(Permissions.KOT_CREATE)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const { id: orderId } = request.params as { id: string };
      const idempotencyKey = (request.headers['idempotency-key'] as string) || null;

      const bodyParse = sendKotInputSchema.safeParse(request.body || {});
      if (!bodyParse.success) {
        throw new AppError(
          'Invalid KOT payload',
          'VALIDATION_ERROR',
          400,
          bodyParse.error.format(),
        );
      }
      const { provisionalLabel, cancelledItems = [] } = bodyParse.data;

      // 1. Idempotency Check
      if (idempotencyKey) {
        const existingSync = await db
          .select()
          .from(syncCommands)
          .where(
            and(
              eq(syncCommands.idempotencyKey, idempotencyKey),
              eq(syncCommands.restaurantId, authUser.restaurantId),
            ),
          )
          .limit(1);

        if (existingSync.length > 0) {
          return reply.status(200).send(existingSync[0]!.result);
        }
      }

      // 2. Diff engine execution inside single DB transaction
      const responsePayload = await db.transaction(async (tx) => {
        // Fetch order
        const [order] = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.restaurantId, authUser.restaurantId)))
          .limit(1);

        if (!order) {
          throw new AppError('Order not found', 'ORDER_NOT_FOUND', 404);
        }

        // Fetch all current order items
        const currentOrderItems = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));

        // Fetch existing KOTs for order to determine KOT type ('new' vs 'additional'/'modified')
        const existingKots = await tx.select().from(kots).where(eq(kots.orderId, orderId));

        const isFirstKot = existingKots.length === 0;

        // Fetch previously sent kot_items to compute diff
        const existingKotItems = isFirstKot
          ? []
          : await tx
              .select()
              .from(kotItems)
              .where(
                inArray(
                  kotItems.kotId,
                  existingKots.map((k) => k.id),
                ),
              );

        // Verify out-of-stock items before sending
        const itemIdsToCheck = currentOrderItems
          .filter((i) => i.status === 'active' && i.kotState !== 'sent')
          .map((i) => i.itemId);

        if (itemIdsToCheck.length > 0) {
          const dbMenuItems = await tx
            .select({ id: menuItems.id, name: menuItems.name, available: menuItems.available })
            .from(menuItems)
            .where(inArray(menuItems.id, itemIdsToCheck));

          const oosList = dbMenuItems.filter((m) => !m.available);
          if (oosList.length > 0) {
            throw new AppError(
              `Items are out of stock: ${oosList.map((m) => m.name).join(', ')}`,
              'ITEM_OOS',
              409,
              { oosItemIds: oosList.map((m) => m.id) },
            );
          }
        }

        // Determine diff lines
        const linesToCreate: Array<{
          orderItemId: string;
          qty: number;
          action: 'add' | 'cancel' | 'update';
          noteSnapshot?: string | null;
          cancelledReason?: string;
        }> = [];

        // Check for unsent / updated items
        for (const item of currentOrderItems) {
          if (item.status === 'cancelled') continue;

          // Find total previously sent qty for this order_item
          const previouslySentQty = existingKotItems
            .filter((ki) => ki.orderItemId === item.id)
            .reduce((sum, ki) => {
              if (ki.action === 'add') return sum + ki.qty;
              if (ki.action === 'cancel') return sum - ki.qty;
              return sum;
            }, 0);

          if (previouslySentQty === 0) {
            // New line
            linesToCreate.push({
              orderItemId: item.id,
              qty: item.qty,
              action: 'add',
              noteSnapshot: item.note,
            });
          } else if (item.qty > previouslySentQty) {
            // Increased qty (+ diff)
            linesToCreate.push({
              orderItemId: item.id,
              qty: item.qty - previouslySentQty,
              action: 'add',
              noteSnapshot: item.note,
            });
          } else if (item.qty < previouslySentQty) {
            // Decreased qty (- diff)
            linesToCreate.push({
              orderItemId: item.id,
              qty: previouslySentQty - item.qty,
              action: 'update',
              noteSnapshot: item.note,
            });
          }
        }

        // Check cancellations
        for (const cancelledReq of cancelledItems) {
          const targetOrderItem = currentOrderItems.find((i) => i.id === cancelledReq.orderItemId);
          if (!targetOrderItem) continue;

          // Check if item was already prepared in kitchen
          const sentItemLogs = existingKotItems.filter(
            (ki) => ki.orderItemId === targetOrderItem.id && ki.status === 'done',
          );

          if (sentItemLogs.length > 0) {
            // Prepared item requires owner/manager PIN
            if (!cancelledReq.managerPin) {
              throw new AppError(
                'Item is already prepared. Manager PIN required to cancel.',
                'PIN_REQUIRED',
                403,
              );
            }

            // Fetch owner/manager users by role
            const ownersAndManagers = await tx
              .select({ id: users.id, pinHash: users.pinHash })
              .from(users)
              .where(eq(users.restaurantId, authUser.restaurantId));

            let pinValid = false;
            for (const u of ownersAndManagers) {
              if (u.pinHash && (await verifyPin(u.pinHash, cancelledReq.managerPin))) {
                pinValid = true;
                break;
              }
            }

            if (!pinValid) {
              throw new AppError(
                'Invalid manager PIN for prepared item cancellation',
                'INVALID_PIN',
                403,
              );
            }
          }

          // Mark order_item as cancelled
          await tx
            .update(orderItems)
            .set({
              status: 'cancelled',
              cancelledReason: cancelledReq.reason,
            })
            .where(eq(orderItems.id, targetOrderItem.id));

          linesToCreate.push({
            orderItemId: targetOrderItem.id,
            qty: targetOrderItem.qty,
            action: 'cancel',
            noteSnapshot: targetOrderItem.note,
            cancelledReason: cancelledReq.reason,
          });

          await recordAuditLog({
            restaurantId: authUser.restaurantId,
            userId: authUser.userId,
            action: 'order.cancel_item_after_kot',
            entity: 'order_item',
            entityId: targetOrderItem.id,
            before: { status: 'active', qty: targetOrderItem.qty },
            after: { status: 'cancelled', reason: cancelledReq.reason },
            request,
          });
        }

        if (linesToCreate.length === 0) {
          throw new AppError('No new or modified items to send in KOT', 'EMPTY_KOT_DIFF', 400);
        }

        // Allocate sequential KOT number
        const kotNumber = await allocateKotNumber(authUser.restaurantId, tx);

        // Determine KOT type: 'new' if first; otherwise if all cancelled 'modified', else 'additional'
        const kotType: 'new' | 'additional' | 'modified' = isFirstKot
          ? 'new'
          : linesToCreate.some((l) => l.action === 'cancel' || l.action === 'update')
            ? 'modified'
            : 'additional';

        // Insert KOT row
        const [newKot] = await tx
          .insert(kots)
          .values({
            orderId,
            restaurantId: authUser.restaurantId,
            kotNumber,
            provisionalLabel: provisionalLabel || null,
            type: kotType,
            status: 'new',
            createdBy: authUser.userId,
          })
          .returning();

        if (!newKot) {
          throw new AppError('Failed to generate KOT record', 'INTERNAL_SERVER_ERROR', 500);
        }

        // Insert KOT Items
        const insertedKotItems = [];
        for (const line of linesToCreate) {
          const [insertedKi] = await tx
            .insert(kotItems)
            .values({
              kotId: newKot.id,
              orderItemId: line.orderItemId,
              qty: line.qty,
              action: line.action,
              status: 'pending',
              noteSnapshot: line.noteSnapshot,
              cancelledReason: line.cancelledReason,
            })
            .returning();
          insertedKotItems.push(insertedKi);

          // Update order_item kot_state to 'sent'
          await tx
            .update(orderItems)
            .set({ kotState: 'sent' })
            .where(eq(orderItems.id, line.orderItemId));
        }

        // Sync table and order statuses
        await syncOrderAndTableStatus(orderId, authUser.restaurantId, tx);

        await recordAuditLog({
          restaurantId: authUser.restaurantId,
          userId: authUser.userId,
          action: 'kot.create',
          entity: 'kot',
          entityId: newKot.id,
          after: {
            kotNumber,
            type: kotType,
            linesCount: linesToCreate.length,
          },
          request,
        });

        const resultPayload = {
          success: true,
          kot: {
            ...newKot,
            items: insertedKotItems,
          },
          provisionalMapping: provisionalLabel
            ? { provisional: provisionalLabel, kotNumber, kotId: newKot.id }
            : null,
        };

        // Cache in sync_commands if idempotency key present
        if (idempotencyKey) {
          await tx.insert(syncCommands).values({
            idempotencyKey,
            restaurantId: authUser.restaurantId,
            userId: authUser.userId,
            commandType: 'order.send_kot',
            result: resultPayload,
          });
        }

        return resultPayload;
      });

      // 3. Emit Realtime Events to kitchen & floor rooms
      emitRealtimeEvent(
        authUser.restaurantId,
        'kot.created',
        {
          kotId: responsePayload.kot.id,
          orderId,
          kotNumber: responsePayload.kot.kotNumber,
          type: responsePayload.kot.type,
          status: responsePayload.kot.status,
        },
        'kitchen',
      );

      emitRealtimeEvent(
        authUser.restaurantId,
        'kot.created',
        {
          kotId: responsePayload.kot.id,
          orderId,
          kotNumber: responsePayload.kot.kotNumber,
          type: responsePayload.kot.type,
        },
        'floor',
      );

      return reply.status(201).send(responsePayload);
    },
  );

  /**
   * GET /kots - List KOTs with status and since filter
   */
  app.get(
    '/kots',
    { preHandler: [requirePermission(Permissions.KOT_READ)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const { status, orderId, since } = request.query as {
        status?: string;
        orderId?: string;
        since?: string;
      };

      const conditions = [eq(kots.restaurantId, authUser.restaurantId)];
      if (status) conditions.push(eq(kots.status, status));
      if (orderId) conditions.push(eq(kots.orderId, orderId));
      if (since) conditions.push(gte(kots.createdAt, new Date(since)));

      const kotRows = await db
        .select()
        .from(kots)
        .where(and(...conditions))
        .orderBy(desc(kots.createdAt));

      if (kotRows.length === 0) {
        return reply.status(200).send({ kots: [] });
      }

      const kotIds = kotRows.map((k) => k.id);
      const items = await db
        .select({
          id: kotItems.id,
          kotId: kotItems.kotId,
          orderItemId: kotItems.orderItemId,
          name: orderItems.nameSnapshot,
          qty: kotItems.qty,
          action: kotItems.action,
          status: kotItems.status,
          noteSnapshot: kotItems.noteSnapshot,
          doneAt: kotItems.doneAt,
          cancelledReason: kotItems.cancelledReason,
          createdAt: kotItems.createdAt,
        })
        .from(kotItems)
        .leftJoin(orderItems, eq(kotItems.orderItemId, orderItems.id))
        .where(inArray(kotItems.kotId, kotIds));

      const itemsByKotId = new Map<string, any[]>();
      for (const item of items) {
        if (!itemsByKotId.has(item.kotId)) itemsByKotId.set(item.kotId, []);
        itemsByKotId.get(item.kotId)!.push(item);
      }

      const formatted = kotRows.map((k) => ({
        ...k,
        items: itemsByKotId.get(k.id) || [],
      }));

      return reply.status(200).send({ kots: formatted });
    },
  );

  /**
   * POST /kots/:id/seen - Mark KOT seen by kitchen
   */
  app.post(
    '/kots/:id/seen',
    { preHandler: [requirePermission(Permissions.KOT_UPDATE_STATUS)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params as { id: string };

      const [updated] = await db
        .update(kots)
        .set({
          seenAt: new Date(),
          status: sql`CASE WHEN status = 'new' THEN 'preparing' ELSE status END`,
        })
        .where(and(eq(kots.id, id), eq(kots.restaurantId, authUser.restaurantId)))
        .returning();

      if (!updated) {
        throw new AppError('KOT not found', 'KOT_NOT_FOUND', 404);
      }

      emitRealtimeEvent(
        authUser.restaurantId,
        'kot.updated',
        { kotId: id, status: updated.status, seenAt: updated.seenAt },
        'all',
      );

      return reply.status(200).send({ success: true, kot: updated });
    },
  );

  /**
   * PATCH /kot-items/:id/done - Mark item done in kitchen
   */
  app.patch(
    '/kot-items/:id/done',
    { preHandler: [requirePermission(Permissions.ITEM_COMPLETE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params as { id: string };

      const [item] = await db
        .select()
        .from(kotItems)
        .innerJoin(kots, eq(kotItems.kotId, kots.id))
        .where(and(eq(kotItems.id, id), eq(kots.restaurantId, authUser.restaurantId)))
        .limit(1);

      if (!item) {
        throw new AppError('KOT item not found', 'ITEM_NOT_FOUND', 404);
      }

      const [updatedItem] = await db
        .update(kotItems)
        .set({ status: 'done', doneAt: new Date() })
        .where(eq(kotItems.id, id))
        .returning();

      // Check if all items in this KOT are done
      const siblingItems = await db.select().from(kotItems).where(eq(kotItems.kotId, item.kots.id));

      const allKotDone = siblingItems.every(
        (i) => i.id === id || i.status === 'done' || i.status === 'cancelled',
      );
      if (allKotDone) {
        await db
          .update(kots)
          .set({ status: 'ready', readyAt: new Date() })
          .where(eq(kots.id, item.kots.id));
      }

      // Check if whole order is now ready
      await syncOrderAndTableStatus(item.kots.orderId, authUser.restaurantId, db);

      emitRealtimeEvent(
        authUser.restaurantId,
        'kot.itemDone',
        { kotItemId: id, kotId: item.kots.id, orderId: item.kots.orderId },
        'all',
      );

      return reply.status(200).send({ success: true, item: updatedItem });
    },
  );

  /**
   * PATCH /kots/:id/status - Update KOT status (e.g. preparing -> ready -> served)
   */
  app.patch(
    '/kots/:id/status',
    { preHandler: [requirePermission(Permissions.KOT_UPDATE_STATUS)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params as { id: string };
      const body = updateKotStatusSchema.parse(request.body);

      const updates: any = { status: body.status };
      if (body.status === 'ready') updates.readyAt = new Date();
      if (body.status === 'served') updates.servedAt = new Date();

      const [updated] = await db
        .update(kots)
        .set(updates)
        .where(and(eq(kots.id, id), eq(kots.restaurantId, authUser.restaurantId)))
        .returning();

      if (!updated) {
        throw new AppError('KOT not found', 'KOT_NOT_FOUND', 404);
      }

      await syncOrderAndTableStatus(updated.orderId, authUser.restaurantId, db);

      emitRealtimeEvent(
        authUser.restaurantId,
        'kot.statusChanged',
        { kotId: id, orderId: updated.orderId, status: body.status },
        'all',
      );

      return reply.status(200).send({ success: true, kot: updated });
    },
  );

  /**
   * POST /orders/:id/served - Mark entire order served by waiter
   */
  app.post(
    '/orders/:id/served',
    { preHandler: [requirePermission(Permissions.KOT_UPDATE_STATUS)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id: orderId } = request.params as { id: string };

      const [order] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.restaurantId, authUser.restaurantId)))
        .limit(1);

      if (!order) {
        throw new AppError('Order not found', 'ORDER_NOT_FOUND', 404);
      }

      // Mark all KOTs as served
      await db
        .update(kots)
        .set({ status: 'served', servedAt: new Date() })
        .where(eq(kots.orderId, orderId));

      await syncOrderAndTableStatus(orderId, authUser.restaurantId, db);

      emitRealtimeEvent(
        authUser.restaurantId,
        'kot.statusChanged',
        { orderId, status: 'served' },
        'all',
      );

      return reply.status(200).send({ success: true, orderId });
    },
  );

  /**
   * GET /kitchen/state - Dedicated kitchen feed (sanitized, zero prices, zero customer data)
   */
  app.get(
    '/kitchen/state',
    { preHandler: [requirePermission(Permissions.KOT_READ)] },
    async (request, reply) => {
      const authUser = request.user!;

      const activeKots = await db
        .select({
          id: kots.id,
          orderId: kots.orderId,
          tableLabel: tables.label,
          kotNumber: kots.kotNumber,
          type: kots.type,
          status: kots.status,
          createdAt: kots.createdAt,
          seenAt: kots.seenAt,
          readyAt: kots.readyAt,
        })
        .from(kots)
        .leftJoin(orders, eq(kots.orderId, orders.id))
        .leftJoin(tables, eq(orders.tableId, tables.id))
        .where(
          and(
            eq(kots.restaurantId, authUser.restaurantId),
            inArray(kots.status, ['new', 'preparing', 'ready']),
          ),
        )
        .orderBy(asc(kots.createdAt));

      if (activeKots.length === 0) {
        return reply.status(200).send({ activeKots: [] });
      }

      const kotIds = activeKots.map((k) => k.id);
      const items = await db
        .select({
          id: kotItems.id,
          kotId: kotItems.kotId,
          orderItemId: kotItems.orderItemId,
          nameSnapshot: orderItems.nameSnapshot,
          qty: kotItems.qty,
          action: kotItems.action,
          status: kotItems.status,
          noteSnapshot: kotItems.noteSnapshot,
          modifiers: orderItems.modifiers,
          doneAt: kotItems.doneAt,
        })
        .from(kotItems)
        .innerJoin(orderItems, eq(kotItems.orderItemId, orderItems.id))
        .where(inArray(kotItems.kotId, kotIds));

      const itemsMap = new Map<string, any[]>();
      for (const i of items) {
        if (!itemsMap.has(i.kotId)) itemsMap.set(i.kotId, []);
        itemsMap.get(i.kotId)!.push(i);
      }

      const combined = activeKots.map((k) => ({
        ...k,
        items: itemsMap.get(k.id) || [],
      }));

      // Authoritative serializer stripping all pricing and customer information
      const sanitized = serializeKitchenState(combined);
      return reply.status(200).send(sanitized);
    },
  );
}
