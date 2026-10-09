import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import {
  Permissions,
  AppError,
  Roles,
  CreateBillSchema,
  ApplyDiscountSchema,
  RecordPaymentSchema,
  CancelBillSchema,
  RefundBillSchema,
  BillFilterSchema,
  printEventSchema,
  createPaymentRequestSchema,
  calculateBill,
  type BillingLineInput,
  type ReceiptData,
  buildReceiptEscPos,
  formatReceiptPlainText,
  generateUpiIntentUrl,
  generateUuidV7,
  redeemPointsSchema,
  validateAndConvertRedemption,
  getBusinessDate,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { bills, billLines, payments, refunds, billCounters } from '../db/schema/bills.js';
import { orders, orderItems, syncCommands } from '../db/schema/orders.js';
import { tables } from '../db/schema/tables.js';
import { restaurantSettings } from '../db/schema/restaurant-settings.js';
import { restaurants } from '../db/schema/restaurants.js';
import { users } from '../db/schema/users.js';
import { roles } from '../db/schema/roles.js';
import { customers } from '../db/schema/customers.js';
import { printerConfigurations, printEvents } from '../db/schema/printers.js';
import { paymentRequests } from '../db/schema/payment-requests.js';
import { loyaltyAccounts, loyaltyTransactions } from '../db/schema/loyalty.js';
import { dailySummaries } from '../db/schema/daily-summaries.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';
import { emitRealtimeEvent } from '../realtime/socket.js';
import { verifyPin } from '../auth/crypto.js';
import {
  processBillPaidLoyaltyEarn,
  processBillReversalLoyalty,
  getOrCreateLoyaltySettings,
  getOrCreateLoyaltyAccount,
} from '../services/loyalty.js';

/**
 * Verifies whether an owner PIN override is valid for this restaurant.
 */
async function verifyOwnerPin(restaurantId: string, pin: string, tx: any): Promise<boolean> {
  const owners = await tx
    .select({ pinHash: users.pinHash })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      and(
        eq(users.restaurantId, restaurantId),
        eq(roles.name, Roles.OWNER),
        eq(users.active, true),
      ),
    );

  for (const owner of owners) {
    if (owner.pinHash && (await verifyPin(pin, owner.pinHash))) {
      return true;
    }
  }
  return false;
}

/**
 * Retrieves the discount percentage cap for a user's role.
 */
function getRoleDiscountCap(roleName: string, settings: any): number {
  if (roleName === Roles.OWNER) return settings?.discountCapOwnerPercent ?? 100;
  if (roleName === Roles.MANAGER) return settings?.discountCapManagerPercent ?? 25;
  if (roleName === Roles.CASHIER) return settings?.discountCapCashierPercent ?? 10;
  return 0; // Waiters and other roles have 0% discount cap by default
}

/**
 * Asserts that the business date for a bill is not closed and locked.
 */
async function assertBusinessDateNotLocked(
  restaurantId: string,
  businessDate: string | null | undefined,
  tx: any,
): Promise<void> {
  if (!businessDate) return;
  const [lockedDay] = await tx
    .select({ id: dailySummaries.id })
    .from(dailySummaries)
    .where(
      and(
        eq(dailySummaries.restaurantId, restaurantId),
        eq(dailySummaries.businessDate, businessDate),
        eq(dailySummaries.locked, true),
      ),
    )
    .limit(1);

  if (lockedDay) {
    throw AppError.badRequest(
      `Business date ${businessDate} is closed and locked. Modifying settled records requires day reopen with owner PIN.`,
    );
  }
}

export async function billsRoutes(fastify: FastifyInstance) {
  // Register permissions in central route registry
  registerRouteGuard({
    method: 'POST',
    url: '/orders/:id/bill',
    isPublic: false,
    permission: Permissions.BILL_CREATE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/bills/:id',
    isPublic: false,
    permission: Permissions.BILL_READ,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/bills/:id/discount',
    isPublic: false,
    permission: Permissions.DISCOUNT_APPLY,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/bills/:id/payments',
    isPublic: false,
    permission: Permissions.PAYMENT_TAKE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/payments/:id/confirm',
    isPublic: false,
    permission: Permissions.PAYMENT_TAKE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/bills/:id/cancel',
    isPublic: false,
    permission: Permissions.BILL_CREATE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/bills/:id/refunds',
    isPublic: false,
    permission: Permissions.BILL_REFUND,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/bills',
    isPublic: false,
    permission: Permissions.BILL_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/payments/pending',
    isPublic: false,
    permission: Permissions.PAYMENT_TAKE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/bills/:id/reprint',
    isPublic: false,
    permission: Permissions.BILL_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/bills/:id/receipt',
    isPublic: false,
    permission: Permissions.BILL_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/bills/:id/print-events',
    isPublic: false,
    permission: Permissions.BILL_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/bills/:id/payment-requests',
    isPublic: false,
    permission: Permissions.BILL_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/bills/:id/payment-requests',
    isPublic: false,
    permission: Permissions.BILL_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/bills/:id/redeem',
    isPublic: false,
    permission: Permissions.PAYMENT_TAKE,
  });

  /**
   * POST /orders/:id/bill
   * Generates or fetches an existing active bill for an order.
   */
  fastify.post(
    '/orders/:id/bill',
    { preHandler: [requirePermission(Permissions.BILL_CREATE)] },
    async (request: FastifyRequest, reply) => {
      const { id: orderId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, userId, role: roleName } = authUser;

      const body = CreateBillSchema.parse(request.body || {});

      // Handle idempotency
      if (body.idempotencyKey) {
        const existingSync = await db
          .select()
          .from(syncCommands)
          .where(eq(syncCommands.idempotencyKey, body.idempotencyKey))
          .limit(1);

        if (existingSync.length > 0 && existingSync[0]) {
          return reply.status(200).send(existingSync[0].result);
        }
      }

      const result = await db.transaction(async (tx) => {
        // 1. Fetch Order and items
        const orderResult = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
          .limit(1);

        const order = orderResult[0];
        if (!order) {
          throw AppError.notFound('Order not found');
        }

        // 2. Check if an active bill already exists for this order
        const existingBills = await tx
          .select()
          .from(bills)
          .where(
            and(
              eq(bills.orderId, orderId),
              eq(bills.restaurantId, restaurantId),
              inArray(bills.status, ['draft', 'unpaid', 'partially_paid', 'paid']),
            ),
          )
          .limit(1);

        if (existingBills.length > 0 && existingBills[0]) {
          const existingBill = existingBills[0];
          const lines = await tx
            .select()
            .from(billLines)
            .where(eq(billLines.billId, existingBill.id));
          const billPayments = await tx
            .select()
            .from(payments)
            .where(eq(payments.billId, existingBill.id));
          const billRefunds = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.billId, existingBill.id));

          return {
            bill: existingBill,
            order: { id: order.id, customerId: order.customerId },
            lines,
            payments: billPayments,
            refunds: billRefunds,
          };
        }

        // 3. Fetch active order items
        const items = await tx
          .select()
          .from(orderItems)
          .where(and(eq(orderItems.orderId, orderId), eq(orderItems.status, 'active')));

        if (items.length === 0) {
          throw AppError.badRequest('Cannot generate bill for an order with no active items');
        }

        // 4. Fetch Restaurant Settings
        const settingsResult = await tx
          .select()
          .from(restaurantSettings)
          .where(eq(restaurantSettings.restaurantId, restaurantId))
          .limit(1);
        const settings = settingsResult[0];

        const taxMode = (settings?.taxMode as 'inclusive' | 'exclusive') || 'exclusive';
        const serviceChargePercent =
          body.serviceChargePercent ?? (Number(settings?.serviceChargePercent) || 0);
        const defaultGstRateBp = settings?.defaultGstRateBp ?? 500;
        const roundOffEnabled = body.roundOffEnabled ?? true;

        // 5. Validate discount cap & PIN override if discount specified
        if (body.discount && body.discount.value > 0) {
          const capPercent = getRoleDiscountCap(roleName, settings);
          let requestedPercent = 0;

          if (body.discount.type === 'percent') {
            requestedPercent = body.discount.value;
          } else {
            const rawSubtotal = items.reduce(
              (sum, item) => sum + item.qty * item.pricePaiseSnapshot,
              0,
            );
            requestedPercent = rawSubtotal > 0 ? (body.discount.value / rawSubtotal) * 100 : 0;
          }

          if (requestedPercent > capPercent) {
            if (!body.discount.overridePin) {
              throw AppError.forbidden(
                `Discount exceeds your allowed role cap of ${capPercent}%. Owner PIN override is required.`,
              );
            }
            const isPinValid = await verifyOwnerPin(restaurantId, body.discount.overridePin, tx);
            if (!isPinValid) {
              throw AppError.forbidden('Invalid Owner PIN override for discount');
            }
            // Audit log the PIN override
            await recordAuditLog({
              restaurantId,
              userId,
              action: 'discount.override_pin',
              entity: 'order',
              entityId: orderId,
              after: { requestedPercent, capPercent, reason: body.discount.reason },
              request,
            });
          }
        }

        // 6. Compute Bill using billing engine
        const billingLines: BillingLineInput[] = items.map((item) => ({
          orderItemId: item.id,
          itemId: item.itemId,
          name: item.nameSnapshot,
          qty: item.qty,
          pricePaise: item.pricePaiseSnapshot,
          taxRateBp: item.taxRateBpSnapshot,
          modifiers: Array.isArray(item.modifiers) ? (item.modifiers as any) : [],
          note: item.note,
        }));

        const calculated = calculateBill({
          lines: billingLines,
          taxMode,
          discount: body.discount,
          serviceChargePercent,
          defaultGstRateBp,
          roundOffEnabled,
        });

        // 7. Allocate daily sequential bill number based on business date
        const todayStr = getBusinessDate(
          new Date(),
          settings?.businessDayStartHour ?? 5,
          settings?.timezone ?? 'Asia/Kolkata',
        );
        const counterRows = await tx
          .select()
          .from(billCounters)
          .where(and(eq(billCounters.restaurantId, restaurantId), eq(billCounters.date, todayStr)))
          .for('update');

        let nextNum = 1;
        if (counterRows.length === 0 || !counterRows[0]) {
          await tx.insert(billCounters).values({
            restaurantId,
            date: todayStr,
            lastNumber: 1,
          });
        } else {
          nextNum = counterRows[0].lastNumber + 1;
          await tx
            .update(billCounters)
            .set({ lastNumber: nextNum })
            .where(
              and(eq(billCounters.restaurantId, restaurantId), eq(billCounters.date, todayStr)),
            );
        }

        const dateSlug = todayStr.replace(/-/g, '');
        const billNumber = `B-${dateSlug}-${String(nextNum).padStart(4, '0')}`;

        // 8. Insert Bill
        const [insertedBill] = await tx
          .insert(bills)
          .values({
            restaurantId,
            orderId,
            billNumber,
            businessDate: todayStr,
            subtotalPaise: calculated.subtotalPaise,
            discountPaise: calculated.discountPaise,
            discountType: calculated.discountType,
            discountValue: calculated.discountValue,
            discountReason: calculated.discountReason,
            serviceChargePaise: calculated.serviceChargePaise,
            taxPaise: calculated.taxPaise,
            roundOffPaise: calculated.roundOffPaise,
            totalPaise: calculated.totalPaise,
            status: 'unpaid',
            createdBy: userId,
          })
          .returning();

        if (!insertedBill) throw AppError.internal('Failed to create bill record');

        // 9. Insert Bill Lines snapshot
        const insertedLines = await tx
          .insert(billLines)
          .values(
            calculated.lines.map((l) => ({
              billId: insertedBill.id,
              orderItemId: l.orderItemId,
              itemId: l.itemId!,
              name: l.name,
              qty: l.qty,
              pricePaise: l.pricePaise,
              subtotalPaise: l.subtotalPaise,
              discountPaise: l.discountPaise,
              taxablePaise: l.taxablePaise,
              taxRateBp: l.taxRateBp,
              taxPaise: l.taxPaise,
              cgstPaise: l.cgstPaise,
              sgstPaise: l.sgstPaise,
              modifiers: (l.modifiers || []) as any,
              note: l.note,
            })),
          )
          .returning();

        // 10. Update table status to 'payment_pending' if dine-in
        if (order.tableId) {
          await tx
            .update(tables)
            .set({ status: 'payment_pending', updatedAt: new Date() })
            .where(eq(tables.id, order.tableId));
        }

        // 11. Audit log
        await recordAuditLog({
          restaurantId,
          userId,
          action: 'bill.create',
          entity: 'bill',
          entityId: insertedBill.id,
          after: insertedBill as any,
          request,
        });

        // 12. Save sync command if idempotencyKey
        const responseData = {
          bill: insertedBill,
          order: { id: order.id, customerId: order.customerId },
          lines: insertedLines,
          payments: [],
          refunds: [],
        };

        if (body.idempotencyKey) {
          await tx.insert(syncCommands).values({
            idempotencyKey: body.idempotencyKey,
            restaurantId,
            userId,
            commandType: 'bill.create',
            result: responseData,
          });
        }

        return responseData;
      });

      emitRealtimeEvent('floor', 'bill.created', { billId: result.bill.id, orderId });
      emitRealtimeEvent('owner', 'bill.created', { billId: result.bill.id, orderId });

      return reply.status(201).send(result);
    },
  );

  /**
   * GET /bills/:id
   * Fetches bill details, line snapshots, payment logs, and refunds.
   */
  fastify.get(
    '/bills/:id',
    { preHandler: [requirePermission(Permissions.BILL_READ)] },
    async (request: FastifyRequest, reply) => {
      const { id: billId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId } = authUser;

      let billRows: any[] = [];
      try {
        billRows = await db
          .select()
          .from(bills)
          .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
          .limit(1);
      } catch (err: any) {
        request.log.debug({ err }, 'Database error looking up bill, treating as not found');
      }

      const bill = billRows[0];
      if (!bill) {
        // Anti-IDOR security telemetry: check if entity exists under another tenant
        try {
          const [foreignBill] = await db
            .select({ id: bills.id, restaurantId: bills.restaurantId })
            .from(bills)
            .where(eq(bills.id, billId))
            .limit(1);

          if (foreignBill) {
            await recordAuditLog({
              restaurantId,
              userId: authUser.userId,
              action: 'security.cross_tenant_access_attempt',
              entity: 'bill',
              entityId: billId,
              before: { targetRestaurantId: foreignBill.restaurantId },
              request,
            });
            request.log.warn(
              {
                billId,
                targetRestaurantId: foreignBill.restaurantId,
                callerRestaurantId: restaurantId,
              },
              'Cross-tenant bill access probe detected and neutralized',
            );
          }
        } catch (err: any) {
          request.log.debug({ err }, 'Could not probe foreign tenant existence');
        }

        throw AppError.notFound('Bill not found');
      }

      const lines = await db.select().from(billLines).where(eq(billLines.billId, billId));
      const billPayments = await db.select().from(payments).where(eq(payments.billId, billId));
      const billRefunds = await db.select().from(refunds).where(eq(refunds.billId, billId));

      const [order] = await db
        .select({ id: orders.id, customerId: orders.customerId })
        .from(orders)
        .where(eq(orders.id, bill.orderId))
        .limit(1);

      return reply.send({
        bill,
        order: order || null,
        customerId: order?.customerId || null,
        lines,
        payments: billPayments,
        refunds: billRefunds,
      });
    },
  );

  /**
   * PATCH /bills/:id/discount
   * Applies or updates discount on an unpaid bill.
   */
  fastify.patch(
    '/bills/:id/discount',
    { preHandler: [requirePermission(Permissions.DISCOUNT_APPLY)] },
    async (request: FastifyRequest, reply) => {
      const { id: billId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, userId, role: roleName } = authUser;

      const body = ApplyDiscountSchema.parse(request.body);

      const updated = await db.transaction(async (tx) => {
        const billRows = await tx
          .select()
          .from(bills)
          .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
          .limit(1);

        const bill = billRows[0];
        if (!bill) throw AppError.notFound('Bill not found');

        await assertBusinessDateNotLocked(restaurantId, bill.businessDate, tx);

        if (bill.status !== 'unpaid' && bill.status !== 'draft') {
          throw AppError.badRequest(
            `Cannot modify discount on a bill with status "${bill.status}"`,
          );
        }

        // Check existing payments
        const existingPayments = await tx
          .select()
          .from(payments)
          .where(
            and(eq(payments.billId, billId), inArray(payments.status, ['confirmed', 'recorded'])),
          );

        if (existingPayments.length > 0) {
          throw AppError.badRequest('Cannot alter discount after payments have been recorded');
        }

        // Fetch settings
        const settings = (
          await tx
            .select()
            .from(restaurantSettings)
            .where(eq(restaurantSettings.restaurantId, restaurantId))
            .limit(1)
        )[0];

        // Validate cap
        const capPercent = getRoleDiscountCap(roleName, settings);
        let requestedPercent = 0;
        if (body.type === 'percent') {
          requestedPercent = body.value;
        } else {
          requestedPercent = bill.subtotalPaise > 0 ? (body.value / bill.subtotalPaise) * 100 : 0;
        }

        if (requestedPercent > capPercent) {
          if (!body.overridePin) {
            throw AppError.forbidden(
              `Discount exceeds your allowed role cap of ${capPercent}%. Owner PIN override is required.`,
            );
          }
          const isPinValid = await verifyOwnerPin(restaurantId, body.overridePin, tx);
          if (!isPinValid) {
            throw AppError.forbidden('Invalid Owner PIN override');
          }
          await recordAuditLog({
            restaurantId,
            userId,
            action: 'discount.override_pin',
            entity: 'bill',
            entityId: bill.id,
            after: { requestedPercent, capPercent, reason: body.reason },
            request,
          });
        }

        // Recompute with new discount
        const lines = await tx.select().from(billLines).where(eq(billLines.billId, billId));
        const billingLines: BillingLineInput[] = lines.map((l) => ({
          orderItemId: l.orderItemId ?? undefined,
          itemId: l.itemId,
          name: l.name,
          qty: l.qty,
          pricePaise: l.pricePaise,
          taxRateBp: l.taxRateBp,
          modifiers: Array.isArray(l.modifiers) ? (l.modifiers as any) : [],
          note: l.note,
        }));

        const calculated = calculateBill({
          lines: billingLines,
          taxMode: (settings?.taxMode as any) || 'exclusive',
          discount: { type: body.type, value: body.value, reason: body.reason },
          serviceChargePercent: Number(settings?.serviceChargePercent) || 0,
          defaultGstRateBp: settings?.defaultGstRateBp ?? 500,
          roundOffEnabled: true,
        });

        // Update bill lines
        for (const cl of calculated.lines) {
          const match = lines.find((l) => l.orderItemId === cl.orderItemId && l.name === cl.name);
          if (match) {
            await tx
              .update(billLines)
              .set({
                discountPaise: cl.discountPaise,
                taxablePaise: cl.taxablePaise,
                taxPaise: cl.taxPaise,
                cgstPaise: cl.cgstPaise,
                sgstPaise: cl.sgstPaise,
              })
              .where(eq(billLines.id, match.id));
          }
        }

        // Update bill
        const [updatedBill] = await tx
          .update(bills)
          .set({
            discountPaise: calculated.discountPaise,
            discountType: calculated.discountType,
            discountValue: calculated.discountValue,
            discountReason: calculated.discountReason,
            serviceChargePaise: calculated.serviceChargePaise,
            taxPaise: calculated.taxPaise,
            roundOffPaise: calculated.roundOffPaise,
            totalPaise: calculated.totalPaise,
            updatedAt: new Date(),
          })
          .where(eq(bills.id, bill.id))
          .returning();

        if (!updatedBill) throw AppError.internal('Failed to update bill');

        await recordAuditLog({
          restaurantId,
          userId,
          action: 'discount.apply',
          entity: 'bill',
          entityId: bill.id,
          before: bill as any,
          after: updatedBill as any,
          request,
        });

        // Invalidate stale pending UPI QR payment requests since bill total has changed
        await tx
          .update(paymentRequests)
          .set({ status: 'cancelled' })
          .where(
            and(
              eq(paymentRequests.billId, bill.id),
              eq(paymentRequests.restaurantId, restaurantId),
              eq(paymentRequests.status, 'pending'),
            ),
          );

        const refreshedLines = await tx
          .select()
          .from(billLines)
          .where(eq(billLines.billId, billId));

        return {
          bill: updatedBill,
          lines: refreshedLines,
        };
      });

      emitRealtimeEvent('floor', 'bill.updated', { billId });
      emitRealtimeEvent('owner', 'bill.updated', { billId });

      return reply.send(updated);
    },
  );

  /**
   * POST /bills/:id/redeem
   * Redeems customer loyalty points against a bill in blocks.
   * Concurrency protected via SELECT FOR UPDATE on loyalty_accounts.
   */
  fastify.post(
    '/bills/:id/redeem',
    { preHandler: [requirePermission(Permissions.PAYMENT_TAKE)] },
    async (request: FastifyRequest, reply) => {
      const { id: billId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, userId } = authUser;

      const body = redeemPointsSchema.parse(request.body);

      // Handle idempotency
      if (body.idempotencyKey) {
        const existingSync = await db
          .select()
          .from(syncCommands)
          .where(eq(syncCommands.idempotencyKey, body.idempotencyKey))
          .limit(1);

        if (existingSync.length > 0 && existingSync[0]) {
          return reply.status(200).send(existingSync[0].result);
        }
      }

      const result = await db.transaction(async (tx) => {
        // 1. Fetch bill and associated order/customer
        const [bill] = await tx
          .select()
          .from(bills)
          .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
          .limit(1);

        if (!bill) throw AppError.notFound('Bill not found');
        await assertBusinessDateNotLocked(restaurantId, bill.businessDate, tx);
        if (bill.status === 'paid' || bill.status === 'cancelled' || bill.status === 'refunded') {
          throw AppError.badRequest(
            `Cannot redeem loyalty points on bill with status "${bill.status}"`,
          );
        }

        const [order] = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, bill.orderId), eq(orders.restaurantId, restaurantId)))
          .limit(1);

        if (!order || !order.customerId) {
          throw AppError.badRequest(
            'No customer attached to this order. Attach customer before redeeming loyalty points.',
          );
        }

        const customerId = order.customerId;

        // Check if customer exists
        const [customer] = await tx
          .select()
          .from(customers)
          .where(and(eq(customers.id, customerId), eq(customers.restaurantId, restaurantId)))
          .limit(1);

        if (!customer) throw AppError.notFound('Customer not found');

        // 2. Fetch loyalty settings
        const settings = await getOrCreateLoyaltySettings(restaurantId, tx);
        if (!settings.enabled) {
          throw AppError.badRequest('Loyalty program is currently disabled');
        }

        // 3. Serialized row-level lock on customer loyalty account
        const [account] = await tx
          .select()
          .from(loyaltyAccounts)
          .where(
            and(
              eq(loyaltyAccounts.restaurantId, restaurantId),
              eq(loyaltyAccounts.customerId, customerId),
            ),
          )
          .for('update')
          .limit(1);

        if (!account) {
          throw AppError.badRequest('Customer does not have a loyalty account yet');
        }

        // 4. Calculate points redeemed today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const todayRedemptions = await tx
          .select({
            points: loyaltyTransactions.points,
          })
          .from(loyaltyTransactions)
          .where(
            and(
              eq(loyaltyTransactions.customerId, customerId),
              eq(loyaltyTransactions.type, 'redeem'),
              sql`${loyaltyTransactions.createdAt} >= ${startOfDay}`,
            ),
          );

        const pointsRedeemedToday = todayRedemptions.reduce(
          (sum: number, r: any) => sum + Math.abs(r.points),
          0,
        );

        // Account age hours check
        const accountAgeHours =
          (Date.now() - new Date(account.createdAt).getTime()) / (1000 * 60 * 60);

        // 5. Validate and calculate discount paise
        const validation = validateAndConvertRedemption({
          pointsToRedeem: body.pointsToRedeem,
          billTotalPaise: bill.subtotalPaise, // Validate against pre-discount subtotal
          pointsBalance: account.pointsBalance,
          pointsRedeemedToday,
          accountAgeHours,
          settings,
        });

        if (!validation.isValid) {
          throw AppError.badRequest(validation.error || 'Redemption conditions not met');
        }

        const discountPaise = validation.discountPaise;

        // 6. Record append-only ledger transaction (debit: negative points)
        const [redeemTx] = await tx
          .insert(loyaltyTransactions)
          .values({
            restaurantId,
            accountId: account.id,
            customerId,
            type: 'redeem',
            points: -body.pointsToRedeem,
            billId,
            reason: `Redeemed ${body.pointsToRedeem} points for ₹${(discountPaise / 100).toFixed(2)} off on Bill #${bill.billNumber}`,
            createdBy: userId,
          })
          .returning();

        // 7. Update account points balance
        const [updatedAccount] = await tx
          .update(loyaltyAccounts)
          .set({
            pointsBalance: sql`${loyaltyAccounts.pointsBalance} - ${body.pointsToRedeem}`,
            updatedAt: new Date(),
          })
          .where(eq(loyaltyAccounts.id, account.id))
          .returning();

        // 8. Apply discount to bill
        // If an existing non-loyalty discount was on the bill, keep or combine
        const existingOtherDiscount = Math.max(
          0,
          (bill.discountPaise || 0) - (bill.loyaltyDiscountPaise || 0),
        );
        const totalNewDiscountPaise = existingOtherDiscount + discountPaise;

        const lines = await tx.select().from(billLines).where(eq(billLines.billId, billId));
        const billingLines: BillingLineInput[] = lines.map((l) => ({
          orderItemId: l.orderItemId ?? undefined,
          itemId: l.itemId,
          name: l.name,
          qty: l.qty,
          pricePaise: l.pricePaise,
          taxRateBp: l.taxRateBp,
          modifiers: Array.isArray(l.modifiers) ? (l.modifiers as any) : [],
          note: l.note,
        }));

        const calculated = calculateBill({
          lines: billingLines,
          taxMode: (settings as any)?.taxMode || 'exclusive',
          discount: {
            type: 'flat',
            value: totalNewDiscountPaise,
            reason: bill.discountReason
              ? `${bill.discountReason} + Loyalty Redemption`
              : `Loyalty: ${body.pointsToRedeem} points`,
          },
          serviceChargePercent: Number(
            bill.serviceChargePaise ? (bill.serviceChargePaise / bill.subtotalPaise) * 100 : 0,
          ),
          defaultGstRateBp: 500,
          roundOffEnabled: true,
        });

        // Update bill lines
        for (const cl of calculated.lines) {
          const match = lines.find((l) => l.orderItemId === cl.orderItemId && l.name === cl.name);
          if (match) {
            await tx
              .update(billLines)
              .set({
                discountPaise: cl.discountPaise,
                taxablePaise: cl.taxablePaise,
                taxPaise: cl.taxPaise,
                cgstPaise: cl.cgstPaise,
                sgstPaise: cl.sgstPaise,
              })
              .where(eq(billLines.id, match.id));
          }
        }

        // Update bill record with loyalty redemption tracking
        const [updatedBill] = await tx
          .update(bills)
          .set({
            loyaltyPointsRedeemed: sql`${bills.loyaltyPointsRedeemed} + ${body.pointsToRedeem}`,
            loyaltyDiscountPaise: sql`${bills.loyaltyDiscountPaise} + ${discountPaise}`,
            discountPaise: calculated.discountPaise,
            discountType: 'flat',
            discountValue: calculated.discountValue,
            discountReason: calculated.discountReason,
            serviceChargePaise: calculated.serviceChargePaise,
            taxPaise: calculated.taxPaise,
            roundOffPaise: calculated.roundOffPaise,
            totalPaise: calculated.totalPaise,
            updatedAt: new Date(),
          })
          .where(eq(bills.id, bill.id))
          .returning();

        await recordAuditLog({
          restaurantId,
          userId,
          action: 'loyalty.redeem',
          entity: 'bill',
          entityId: bill.id,
          before: bill as any,
          after: updatedBill as any,
          request,
        });

        // Invalidate stale pending UPI QR payment requests since bill total has changed
        await tx
          .update(paymentRequests)
          .set({ status: 'cancelled' })
          .where(
            and(
              eq(paymentRequests.billId, bill.id),
              eq(paymentRequests.restaurantId, restaurantId),
              eq(paymentRequests.status, 'pending'),
            ),
          );

        const refreshedLines = await tx
          .select()
          .from(billLines)
          .where(eq(billLines.billId, billId));

        const responsePayload = {
          success: true,
          bill: updatedBill,
          lines: refreshedLines,
          redeemedPoints: body.pointsToRedeem,
          discountPaise,
          newBalance: updatedAccount!.pointsBalance,
        };

        if (body.idempotencyKey) {
          await tx.insert(syncCommands).values({
            idempotencyKey: body.idempotencyKey,
            restaurantId,
            userId,
            commandType: 'loyalty.redeem',
            result: responsePayload,
          });
        }

        return responsePayload;
      });

      emitRealtimeEvent('floor', 'bill.updated', { billId });
      emitRealtimeEvent('owner', 'bill.updated', { billId });

      return reply.send(result);
    },
  );

  /**
   * POST /bills/:id/payments
   * Records a payment against a bill (cash, UPI, card, or split payment line).
   */
  fastify.post(
    '/bills/:id/payments',
    { preHandler: [requirePermission(Permissions.PAYMENT_TAKE)] },
    async (request: FastifyRequest, reply) => {
      const { id: billId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, userId } = authUser;

      const body = RecordPaymentSchema.parse(request.body);

      // Handle idempotency
      if (body.idempotencyKey) {
        const existingSync = await db
          .select()
          .from(syncCommands)
          .where(eq(syncCommands.idempotencyKey, body.idempotencyKey))
          .limit(1);

        if (existingSync.length > 0 && existingSync[0]) {
          return reply.status(200).send(existingSync[0].result);
        }
      }

      const result = await db.transaction(async (tx) => {
        const billRows = await tx
          .select()
          .from(bills)
          .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
          .limit(1);

        const bill = billRows[0];
        if (!bill) throw AppError.notFound('Bill not found');

        await assertBusinessDateNotLocked(restaurantId, bill.businessDate, tx);

        if (bill.status === 'cancelled') {
          throw AppError.badRequest('Cannot record payment on a cancelled bill');
        }
        if (bill.status === 'paid') {
          throw AppError.badRequest('Bill is already fully paid');
        }

        // Calculate existing payments
        const existingPayments = await tx
          .select()
          .from(payments)
          .where(and(eq(payments.billId, billId), eq(payments.restaurantId, restaurantId)));

        const confirmedPaise = existingPayments
          .filter((p) => p.status === 'confirmed' || p.status === 'recorded')
          .reduce((sum, p) => sum + p.amountPaise, 0);

        const remainingPaise = Math.max(0, bill.totalPaise - confirmedPaise);

        // Validation for payment amounts
        if (body.method !== 'cash' && body.amountPaise > remainingPaise) {
          throw AppError.badRequest(
            `Payment amount (${body.amountPaise} paise) exceeds remaining balance of ${remainingPaise} paise`,
          );
        }

        // Cash change calculation
        let changePaise = 0;
        const tenderedPaise = body.tenderedPaise ?? body.amountPaise;
        if (body.method === 'cash') {
          if (tenderedPaise < body.amountPaise) {
            throw AppError.badRequest('Cash tendered amount cannot be less than payment amount');
          }
          changePaise = tenderedPaise - body.amountPaise;
        }

        // Status rule: UPI starts as pending_confirmation until staff confirms receipt; Cash & Card confirmed immediately
        const initialStatus = body.method === 'upi' ? 'pending_confirmation' : 'confirmed';

        const [paymentRecord] = await tx
          .insert(payments)
          .values({
            restaurantId,
            billId,
            method: body.method,
            amountPaise: body.amountPaise,
            tenderedPaise,
            changePaise,
            status: initialStatus,
            reference: body.reference,
            businessDate: bill.businessDate,
            confirmedBy: initialStatus === 'confirmed' ? userId : null,
            confirmedAt: initialStatus === 'confirmed' ? new Date() : null,
            createdBy: userId,
          })
          .returning();

        if (!paymentRecord) throw AppError.internal('Failed to record payment');

        // Calculate updated confirmed total
        const newConfirmedTotal =
          confirmedPaise + (initialStatus === 'confirmed' ? body.amountPaise : 0);

        let newBillStatus = bill.status;
        let isFullyPaid = false;

        if (newConfirmedTotal >= bill.totalPaise) {
          newBillStatus = 'paid';
          isFullyPaid = true;
        } else if (newConfirmedTotal > 0) {
          newBillStatus = 'partially_paid';
        }

        const [updatedBill] = await tx
          .update(bills)
          .set({
            status: newBillStatus,
            paidAt: isFullyPaid ? new Date() : bill.paidAt,
            updatedAt: new Date(),
          })
          .where(eq(bills.id, bill.id))
          .returning();

        // If fully paid, transition order and release table
        if (isFullyPaid) {
          await tx
            .update(orders)
            .set({ status: 'billed', updatedAt: new Date() })
            .where(eq(orders.id, bill.orderId));

          const order = (
            await tx.select().from(orders).where(eq(orders.id, bill.orderId)).limit(1)
          )[0];

          if (order?.customerId) {
            await tx
              .update(customers)
              .set({
                lastVisitAt: new Date(),
                visitCount: sql`${customers.visitCount} + 1`,
                totalSpentPaise: sql`${customers.totalSpentPaise} + ${bill.totalPaise}`,
                updatedAt: new Date(),
              })
              .where(eq(customers.id, order.customerId));

            // Award loyalty earn points on fully paid bill
            await processBillPaidLoyaltyEarn(
              {
                restaurantId,
                billId: bill.id,
                userId,
                request,
              },
              tx,
            );
          }

          if (order?.tableId) {
            await tx
              .update(tables)
              .set({
                status: 'available',
                currentOrderId: null,
                updatedAt: new Date(),
              })
              .where(eq(tables.id, order.tableId));
          }
        }

        await recordAuditLog({
          restaurantId,
          userId,
          action: 'payment.record',
          entity: 'payment',
          entityId: paymentRecord.id,
          after: paymentRecord as any,
          request,
        });

        const responseData = {
          payment: paymentRecord,
          bill: updatedBill,
          changePaise,
          isFullyPaid,
        };

        if (body.idempotencyKey) {
          await tx.insert(syncCommands).values({
            idempotencyKey: body.idempotencyKey,
            restaurantId,
            userId,
            commandType: 'bill.payment',
            result: responseData,
          });
        }

        return responseData;
      });

      emitRealtimeEvent('floor', 'payment.recorded', { billId, paymentId: result.payment.id });
      emitRealtimeEvent('owner', 'payment.recorded', { billId, paymentId: result.payment.id });
      if (result.isFullyPaid) {
        emitRealtimeEvent('floor', 'bill.paid', { billId });
        emitRealtimeEvent('owner', 'bill.paid', { billId });
      }

      return reply.status(201).send(result);
    },
  );

  /**
   * POST /payments/:id/confirm
   * Staff explicitly confirms a pending UPI payment.
   */
  fastify.post(
    '/payments/:id/confirm',
    { preHandler: [requirePermission(Permissions.PAYMENT_TAKE)] },
    async (request: FastifyRequest, reply) => {
      const { id: paymentId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, userId } = authUser;

      const result = await db.transaction(async (tx) => {
        const paymentRows = await tx
          .select()
          .from(payments)
          .where(and(eq(payments.id, paymentId), eq(payments.restaurantId, restaurantId)))
          .limit(1);

        const payment = paymentRows[0];
        if (!payment) throw AppError.notFound('Payment record not found');

        if (payment.status === 'confirmed') {
          return { payment, alreadyConfirmed: true };
        }
        if (payment.status !== 'pending_confirmation') {
          throw AppError.badRequest(`Cannot confirm payment with status "${payment.status}"`);
        }

        const [confirmedPayment] = await tx
          .update(payments)
          .set({
            status: 'confirmed',
            confirmedBy: userId,
            confirmedAt: new Date(),
          })
          .where(eq(payments.id, payment.id))
          .returning();

        // Recompute bill payments
        const allPayments = await tx
          .select()
          .from(payments)
          .where(eq(payments.billId, payment.billId));

        const confirmedPaise = allPayments
          .filter((p) => p.status === 'confirmed' || p.status === 'recorded')
          .reduce((sum, p) => sum + p.amountPaise, 0);

        const bill = (
          await tx.select().from(bills).where(eq(bills.id, payment.billId)).limit(1)
        )[0];

        if (!bill) throw AppError.notFound('Bill not found');

        const isFullyPaid = confirmedPaise >= bill.totalPaise;
        const newStatus = isFullyPaid
          ? 'paid'
          : confirmedPaise > 0
            ? 'partially_paid'
            : bill.status;

        const [updatedBill] = await tx
          .update(bills)
          .set({
            status: newStatus,
            paidAt: isFullyPaid ? new Date() : bill.paidAt,
            updatedAt: new Date(),
          })
          .where(eq(bills.id, bill.id))
          .returning();

        if (isFullyPaid) {
          await tx
            .update(orders)
            .set({ status: 'billed', updatedAt: new Date() })
            .where(eq(orders.id, bill.orderId));

          const order = (
            await tx.select().from(orders).where(eq(orders.id, bill.orderId)).limit(1)
          )[0];

          if (order?.customerId) {
            await tx
              .update(customers)
              .set({
                lastVisitAt: new Date(),
                visitCount: sql`${customers.visitCount} + 1`,
                totalSpentPaise: sql`${customers.totalSpentPaise} + ${bill.totalPaise}`,
                updatedAt: new Date(),
              })
              .where(eq(customers.id, order.customerId));

            // Award loyalty earn points on fully paid bill
            await processBillPaidLoyaltyEarn(
              {
                restaurantId,
                billId: bill.id,
                userId,
                request,
              },
              tx,
            );
          }

          if (order?.tableId) {
            await tx
              .update(tables)
              .set({
                status: 'available',
                currentOrderId: null,
                updatedAt: new Date(),
              })
              .where(eq(tables.id, order.tableId));
          }
        }

        await recordAuditLog({
          restaurantId,
          userId,
          action: 'payment.confirm',
          entity: 'payment',
          entityId: payment.id,
          before: payment as any,
          after: confirmedPayment as any,
          request,
        });

        return {
          payment: confirmedPayment,
          bill: updatedBill,
          isFullyPaid,
        };
      });

      emitRealtimeEvent('floor', 'payment.confirmed', { paymentId });
      emitRealtimeEvent('owner', 'payment.confirmed', { paymentId });

      return reply.send(result);
    },
  );

  /**
   * POST /bills/:id/cancel
   * Cancels an unpaid bill or cancels a paid bill with owner authorization.
   */
  fastify.post(
    '/bills/:id/cancel',
    { preHandler: [requirePermission(Permissions.BILL_CREATE)] },
    async (request: FastifyRequest, reply) => {
      const { id: billId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, userId, role: roleName } = authUser;

      const body = CancelBillSchema.parse(request.body);

      const result = await db.transaction(async (tx) => {
        const billRows = await tx
          .select()
          .from(bills)
          .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
          .limit(1);

        const bill = billRows[0];
        if (!bill) throw AppError.notFound('Bill not found');

        await assertBusinessDateNotLocked(restaurantId, bill.businessDate, tx);

        if (bill.status === 'cancelled') {
          throw AppError.badRequest('Bill is already cancelled');
        }

        // If bill was already paid, requires OWNER role or owner PIN override
        if (bill.status === 'paid' && roleName !== Roles.OWNER) {
          if (!body.overridePin) {
            throw AppError.forbidden(
              'Cancelling a paid bill requires Owner authorization or PIN override',
            );
          }
          const isPinValid = await verifyOwnerPin(restaurantId, body.overridePin, tx);
          if (!isPinValid) {
            throw AppError.forbidden('Invalid Owner PIN override for bill cancellation');
          }
        }

        const [cancelledBill] = await tx
          .update(bills)
          .set({
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(eq(bills.id, bill.id))
          .returning();

        // Invalidate all pending UPI QR payment requests for this bill
        await tx
          .update(paymentRequests)
          .set({ status: 'cancelled' })
          .where(
            and(
              eq(paymentRequests.billId, bill.id),
              eq(paymentRequests.restaurantId, restaurantId),
              eq(paymentRequests.status, 'pending'),
            ),
          );

        // If order was billed, revert to saved
        await tx
          .update(orders)
          .set({ status: 'saved', updatedAt: new Date() })
          .where(eq(orders.id, bill.orderId));

        const order = (
          await tx.select().from(orders).where(eq(orders.id, bill.orderId)).limit(1)
        )[0];

        if (order?.tableId) {
          await tx
            .update(tables)
            .set({ status: 'occupied', updatedAt: new Date() })
            .where(eq(tables.id, order.tableId));
        }

        await recordAuditLog({
          restaurantId,
          userId,
          action: 'bill.cancel',
          entity: 'bill',
          entityId: bill.id,
          before: bill as any,
          after: cancelledBill as any,
          request,
        });

        // Loyalty reversal hook
        await processBillReversalLoyalty(
          {
            restaurantId,
            billId: bill.id,
            reason: body.reason,
            userId,
            request,
          },
          tx,
        );

        return cancelledBill;
      });

      emitRealtimeEvent('floor', 'bill.cancelled', { billId });
      emitRealtimeEvent('owner', 'bill.cancelled', { billId });

      return reply.send({ bill: result });
    },
  );

  /**
   * POST /bills/:id/refunds
   * Records a refund on a paid or partially paid bill.
   */
  fastify.post(
    '/bills/:id/refunds',
    { preHandler: [requirePermission(Permissions.BILL_REFUND)] },
    async (request: FastifyRequest, reply) => {
      const { id: billId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, userId } = authUser;

      const body = RefundBillSchema.parse(request.body);

      const result = await db.transaction(async (tx) => {
        const billRows = await tx
          .select()
          .from(bills)
          .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
          .limit(1);

        const bill = billRows[0];
        if (!bill) throw AppError.notFound('Bill not found');

        await assertBusinessDateNotLocked(restaurantId, bill.businessDate, tx);

        if (bill.status !== 'paid' && bill.status !== 'partially_paid') {
          throw AppError.badRequest(`Cannot issue refund for a bill with status "${bill.status}"`);
        }

        const allPayments = await tx
          .select()
          .from(payments)
          .where(and(eq(payments.billId, billId), eq(payments.status, 'confirmed')));

        const totalConfirmedPaise = allPayments.reduce((sum, p) => sum + p.amountPaise, 0);

        const existingRefunds = await tx.select().from(refunds).where(eq(refunds.billId, billId));
        const totalRefundedPaise = existingRefunds.reduce((sum, r) => sum + r.amountPaise, 0);

        if (totalRefundedPaise + body.amountPaise > totalConfirmedPaise) {
          throw AppError.badRequest(
            `Total refunds (${totalRefundedPaise + body.amountPaise} paise) would exceed confirmed payments (${totalConfirmedPaise} paise)`,
          );
        }

        const [refundRecord] = await tx
          .insert(refunds)
          .values({
            restaurantId,
            billId,
            paymentId: body.paymentId,
            amountPaise: body.amountPaise,
            method: body.method,
            reason: body.reason,
            approvedBy: userId,
          })
          .returning();

        if (!refundRecord) throw AppError.internal('Failed to record refund');

        const isFullyRefunded = totalRefundedPaise + body.amountPaise >= totalConfirmedPaise;
        let updatedBill = bill;

        if (isFullyRefunded) {
          const [updated] = await tx
            .update(bills)
            .set({ status: 'refunded', updatedAt: new Date() })
            .where(eq(bills.id, bill.id))
            .returning();
          if (updated) updatedBill = updated;
        }

        await recordAuditLog({
          restaurantId,
          userId,
          action: 'bill.refund',
          entity: 'refund',
          entityId: refundRecord.id,
          after: refundRecord as any,
          request,
        });

        // Loyalty reversal hook on refund
        await processBillReversalLoyalty(
          {
            restaurantId,
            billId: bill.id,
            reason: body.reason,
            userId,
            request,
          },
          tx,
        );

        return {
          refund: refundRecord,
          bill: updatedBill,
        };
      });

      emitRealtimeEvent('floor', 'bill.refunded', { billId, refundId: result.refund?.id });
      emitRealtimeEvent('owner', 'bill.refunded', { billId, refundId: result.refund?.id });

      return reply.status(201).send(result);
    },
  );

  /**
   * GET /bills
   * Lists bills with filters (date, status, table, search, pagination).
   */
  fastify.get(
    '/bills',
    { preHandler: [requirePermission(Permissions.BILL_READ)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const { restaurantId, userId, role: roleName } = authUser;

      const query = BillFilterSchema.parse(request.query || {});

      const conditions = [eq(bills.restaurantId, restaurantId)];

      if (query.status) {
        conditions.push(eq(bills.status, query.status));
      }
      if (query.date) {
        conditions.push(sql`DATE(${bills.createdAt}) = ${query.date}::date`);
      }
      if (query.tableId) {
        conditions.push(
          sql`${bills.orderId} IN (SELECT id FROM orders WHERE table_id = ${query.tableId}::uuid)`,
        );
      }
      if (query.search) {
        conditions.push(sql`${bills.billNumber} ILIKE ${'%' + query.search + '%'}`);
      }

      // Restrict waiter to their own recent bills if role is WAITER
      if (roleName === Roles.WAITER) {
        conditions.push(eq(bills.createdBy, userId));
      }

      const results = await db
        .select()
        .from(bills)
        .where(and(...conditions))
        .orderBy(desc(bills.createdAt))
        .limit(query.limit)
        .offset(query.offset);

      return reply.send({
        bills: results,
        limit: query.limit,
        offset: query.offset,
      });
    },
  );

  /**
   * GET /payments/pending
   * Owner/Manager view of pending UPI confirmations.
   */
  fastify.get(
    '/payments/pending',
    { preHandler: [requirePermission(Permissions.PAYMENT_TAKE)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const { restaurantId } = authUser;

      const pending = await db
        .select({
          payment: payments,
          bill: bills,
        })
        .from(payments)
        .innerJoin(bills, eq(payments.billId, bills.id))
        .where(
          and(eq(payments.restaurantId, restaurantId), eq(payments.status, 'pending_confirmation')),
        )
        .orderBy(desc(payments.createdAt));

      return reply.send({
        pendingPayments: pending.map((p) => ({
          ...p.payment,
          billNumber: p.bill.billNumber,
          billTotalPaise: p.bill.totalPaise,
        })),
      });
    },
  );

  /**
   * POST /bills/:id/reprint
   * Records a reprint event and increments printedCount.
   */
  fastify.post(
    '/bills/:id/reprint',
    { preHandler: [requirePermission(Permissions.BILL_READ)] },
    async (request: FastifyRequest, reply) => {
      const { id: billId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, userId } = authUser;

      const [updatedBill] = await db
        .update(bills)
        .set({
          printedCount: sql`${bills.printedCount} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
        .returning();

      if (!updatedBill) throw AppError.notFound('Bill not found');

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'bill.reprint',
        entity: 'bill',
        entityId: billId,
        after: { newCount: updatedBill.printedCount },
        request,
      });

      return reply.send({
        billId,
        printedCount: updatedBill.printedCount,
      });
    },
  );

  /**
   * GET /bills/:id/receipt
   * Generates structured receipt data, monospace plain text, and ESC/POS byte sequence.
   */
  fastify.get(
    '/bills/:id/receipt',
    { preHandler: [requirePermission(Permissions.BILL_READ)] },
    async (request: FastifyRequest, reply) => {
      const { id: billId } = request.params as { id: string };
      const { widthMm: queryWidth, printerId } = (request.query || {}) as {
        widthMm?: string;
        printerId?: string;
      };
      const authUser = request.user!;
      const { restaurantId } = authUser;

      const [bill] = await db
        .select()
        .from(bills)
        .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
        .limit(1);

      if (!bill) throw AppError.notFound('Bill not found');

      const lines = await db.select().from(billLines).where(eq(billLines.billId, billId));

      const billPayments = await db.select().from(payments).where(eq(payments.billId, billId));

      const [order] = await db.select().from(orders).where(eq(orders.id, bill.orderId)).limit(1);

      let tableName: string | undefined;
      if (order?.tableId) {
        const [table] = await db.select().from(tables).where(eq(tables.id, order.tableId)).limit(1);
        tableName = table?.label;
      }

      let waiterName: string | undefined;
      if (order?.createdBy) {
        const [waiter] = await db
          .select()
          .from(users)
          .where(eq(users.id, order.createdBy))
          .limit(1);
        waiterName = waiter?.name;
      }

      const [settings] = await db
        .select()
        .from(restaurantSettings)
        .where(eq(restaurantSettings.restaurantId, restaurantId))
        .limit(1);

      const [restaurant] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId))
        .limit(1);

      const confirmedPaid = billPayments
        .filter((p) => p.status === 'confirmed')
        .reduce((acc, p) => acc + p.amountPaise, 0);

      const balanceDuePaise = Math.max(0, bill.totalPaise - confirmedPaid);

      let upiQrPayload: string | undefined;
      if (balanceDuePaise > 0 && settings?.upiVpa) {
        try {
          upiQrPayload = generateUpiIntentUrl({
            vpa: settings.upiVpa,
            payeeName:
              settings.upiPayeeName || settings.name || restaurant?.name || 'Restaurant OS',
            amountPaise: balanceDuePaise,
            billNumber: bill.billNumber,
            transactionRef: bill.id.replace(/-/g, '').slice(0, 16),
          });
        } catch {
          // Ignore invalid VPA during receipt build
        }
      }

      const receiptData: ReceiptData = {
        restaurantName: settings?.name || restaurant?.name || 'Restaurant OS',
        restaurantAddress: settings?.address || undefined,
        restaurantPhone: settings?.phone || undefined,
        restaurantGstin: settings?.gstin || undefined,
        billNumber: bill.billNumber,
        orderType: (order?.type as 'dine_in' | 'takeaway') || 'dine_in',
        tableName,
        waiterName,
        date: bill.createdAt,
        lines: lines.map((l) => ({
          name: l.name,
          qty: l.qty,
          pricePaise: l.pricePaise,
          totalPaise: l.subtotalPaise,
          modifiers: Array.isArray(l.modifiers)
            ? (l.modifiers as any[]).map((m: any) => m.name || String(m))
            : [],
          note: l.note || undefined,
        })),
        subtotalPaise: bill.subtotalPaise,
        discountPaise: bill.discountPaise,
        discountReason: bill.discountReason || undefined,
        serviceChargePaise: bill.serviceChargePaise,
        cgstPaise: lines.reduce((acc, l) => acc + l.cgstPaise, 0),
        sgstPaise: lines.reduce((acc, l) => acc + l.sgstPaise, 0),
        roundOffPaise: bill.roundOffPaise,
        totalPaise: bill.totalPaise,
        paidPaise: confirmedPaid,
        balanceDuePaise,
        payments: billPayments.map((p) => ({
          method: p.method,
          amountPaise: p.amountPaise,
          status: p.status,
        })),
        isDuplicate: bill.printedCount > 0,
        printedCount: bill.printedCount,
        upiQrPayload,
      };

      let targetWidth: 58 | 80 = 80;
      let targetCharsPerLine = 48;
      let autoCut = true;
      let drawerPulse = false;

      if (printerId) {
        const [printer] = await db
          .select()
          .from(printerConfigurations)
          .where(eq(printerConfigurations.id, printerId))
          .limit(1);
        if (printer) {
          targetWidth = printer.widthMm as 58 | 80;
          targetCharsPerLine = printer.charsPerLine;
          autoCut = printer.autoCut;
          drawerPulse = printer.drawerPulse;
        }
      } else if (queryWidth === '58') {
        targetWidth = 58;
        targetCharsPerLine = 32;
      }

      const templateConfig = {
        widthMm: targetWidth,
        charsPerLine: targetCharsPerLine,
        autoCut,
        drawerPulse,
        headerLines: settings?.receiptHeaderLines || [],
        footerLines: settings?.receiptFooterLines || [],
        showGstin: settings?.receiptShowGstin ?? true,
        showTable: true,
        showWaiter: true,
        showItemNotes: settings?.receiptShowItemNotes ?? false,
        showServiceCharge: settings?.receiptShowServiceCharge ?? true,
        showQr: settings?.receiptShowQr ?? true,
        rupeeMode: (settings?.rupeeSymbolMode as 'text_rs' | 'symbol' | 'image') || 'text_rs',
      };

      const plainText = formatReceiptPlainText(receiptData, templateConfig);
      const escposBytes = buildReceiptEscPos(receiptData, templateConfig);
      const escposBase64 = Buffer.from(escposBytes).toString('base64');

      return reply.send({
        receiptData,
        templateConfig,
        plainText,
        escposBase64,
        byteCount: escposBytes.length,
      });
    },
  );

  /**
   * POST /bills/:id/print-events
   * Records physical/browser print attempt, audits reprints/duplicates, and updates bills.printed_count.
   */
  fastify.post(
    '/bills/:id/print-events',
    { preHandler: [requirePermission(Permissions.BILL_READ)] },
    async (request: FastifyRequest, reply) => {
      const { id: billId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, userId, permissions: userPerms } = authUser;
      const body = printEventSchema.parse(request.body || {});

      const [bill] = await db
        .select()
        .from(bills)
        .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
        .limit(1);

      if (!bill) throw AppError.notFound('Bill not found');

      // Security check: If reprint of a paid bill, requires bill.reprint permission or owner PIN
      if (body.type === 'reprint' && bill.status === 'paid') {
        const hasReprintPerm = userPerms.includes(Permissions.BILL_REPRINT);
        if (!hasReprintPerm) {
          if (!body.ownerPin) {
            throw AppError.forbidden(
              'Reprinting a paid bill requires bill.reprint permission or owner PIN',
            );
          }
          const validPin = await verifyOwnerPin(restaurantId, body.ownerPin, db);
          if (!validPin) {
            throw AppError.forbidden('Invalid owner PIN for bill reprint');
          }
        }
      }

      // Increment printed_count on bill
      const [updatedBill] = await db
        .update(bills)
        .set({
          printedCount: sql`${bills.printedCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, billId))
        .returning();

      // Insert print event
      const [event] = await db
        .insert(printEvents)
        .values({
          id: generateUuidV7(),
          restaurantId,
          billId,
          userId,
          type: body.type,
          printerId: body.printerId || null,
          result: body.result,
          error: body.error || null,
        })
        .returning();

      await recordAuditLog({
        restaurantId,
        userId,
        action: `bill.${body.type}`,
        entity: 'bill',
        entityId: billId,
        after: {
          eventId: event?.id,
          type: body.type,
          printerId: body.printerId,
          result: body.result,
          newPrintedCount: updatedBill?.printedCount,
        },
        request,
      });

      return reply.status(201).send({
        event,
        printedCount: updatedBill?.printedCount,
      });
    },
  );

  /**
   * GET /bills/:id/payment-requests
   * Lists dynamic UPI QR payment requests for this bill.
   */
  fastify.get(
    '/bills/:id/payment-requests',
    { preHandler: [requirePermission(Permissions.BILL_READ)] },
    async (request: FastifyRequest, reply) => {
      const { id: billId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId } = authUser;

      const list = await db
        .select()
        .from(paymentRequests)
        .where(
          and(eq(paymentRequests.billId, billId), eq(paymentRequests.restaurantId, restaurantId)),
        )
        .orderBy(desc(paymentRequests.createdAt));

      return reply.send({ paymentRequests: list });
    },
  );

  /**
   * POST /bills/:id/payment-requests
   * Generates a dynamic UPI QR payment request for current balance due.
   */
  fastify.post(
    '/bills/:id/payment-requests',
    { preHandler: [requirePermission(Permissions.BILL_READ)] },
    async (request: FastifyRequest, reply) => {
      const { id: billId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId } = authUser;

      const [bill] = await db
        .select()
        .from(bills)
        .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
        .limit(1);

      if (!bill) throw AppError.notFound('Bill not found');

      const [settings] = await db
        .select()
        .from(restaurantSettings)
        .where(eq(restaurantSettings.restaurantId, restaurantId))
        .limit(1);

      if (!settings?.upiVpa) {
        throw AppError.badRequest('UPI VPA not configured for this restaurant');
      }

      const billPayments = await db.select().from(payments).where(eq(payments.billId, billId));

      const confirmedPaid = billPayments
        .filter((p) => p.status === 'confirmed')
        .reduce((acc, p) => acc + p.amountPaise, 0);

      const duePaise = Math.max(0, bill.totalPaise - confirmedPaid);
      if (duePaise === 0) {
        throw AppError.badRequest('Bill is already paid in full');
      }

      const upiRef = `UPI${bill.billNumber.replace(/[^A-Za-z0-9]/g, '')}${Date.now().toString().slice(-4)}`;
      const qrPayload = generateUpiIntentUrl({
        vpa: settings.upiVpa,
        payeeName: settings.upiPayeeName || settings.name || 'Restaurant OS',
        amountPaise: duePaise,
        billNumber: bill.billNumber,
        transactionRef: upiRef,
      });

      // Invalidate any older pending payment requests for this bill
      await db
        .update(paymentRequests)
        .set({ status: 'cancelled' })
        .where(
          and(
            eq(paymentRequests.billId, billId),
            eq(paymentRequests.restaurantId, restaurantId),
            eq(paymentRequests.status, 'pending'),
          ),
        );

      const [created] = await db
        .insert(paymentRequests)
        .values({
          id: generateUuidV7(),
          restaurantId,
          billId,
          amountPaise: duePaise,
          upiRef,
          qrPayload,
          status: 'pending',
        })
        .returning();

      return reply.status(201).send(created);
    },
  );
}
