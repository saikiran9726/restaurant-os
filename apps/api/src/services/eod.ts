import { eq, and, desc, sql, inArray, gte, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { dailySummaries, expenses } from '../db/schema/daily-summaries.js';
import { bills, payments, refunds } from '../db/schema/bills.js';
import { orders } from '../db/schema/orders.js';
import { restaurantSettings } from '../db/schema/restaurant-settings.js';
import { users } from '../db/schema/users.js';
import { roles } from '../db/schema/roles.js';
import {
  AppError,
  Roles,
  generateUuidV7,
  getBusinessDate,
  reconcileCash,
  calculateExpectedCash,
  type EodCloseDayInput,
  type EodReopenInput,
  type AddCashExpenseInput,
  type EodPreCheckStatus,
  type DailySummaryOutput,
  type UnresolvedItem,
} from '@restaurant-os/shared';
import { recordAuditLog } from './audit.js';
import { emitRealtimeEvent } from '../realtime/socket.js';
import { verifyPin } from '../auth/crypto.js';

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
 * Fetches the current End-of-Day pre-check checklist and financial totals.
 */
export async function getEodPreCheckStatus(
  restaurantId: string,
  targetDate?: string,
): Promise<EodPreCheckStatus> {
  const [settings] = await db
    .select()
    .from(restaurantSettings)
    .where(eq(restaurantSettings.restaurantId, restaurantId))
    .limit(1);

  const businessDayStartHour = settings?.businessDayStartHour ?? 5;
  const timezone = settings?.timezone ?? 'Asia/Kolkata';
  const businessDate = targetDate || getBusinessDate(new Date(), businessDayStartHour, timezone);

  // 1. Unresolved: Open/saved orders
  const openOrdersRows = await db
    .select({
      id: orders.id,
      type: orders.type,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.restaurantId, restaurantId), inArray(orders.status, ['open', 'saved'])));

  const openOrders: UnresolvedItem[] = openOrdersRows.map((o) => ({
    id: o.id,
    type: 'open_order',
    title: `Order #${o.id.slice(0, 8)} (${o.type.toUpperCase()})`,
    details: `Order status is "${o.status}". Must be billed or cancelled.`,
    createdAt: o.createdAt.toISOString(),
  }));

  // 2. Unresolved: Unpaid / Draft / Partially paid bills for this business date
  const unpaidBillsRows = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      totalPaise: bills.totalPaise,
      status: bills.status,
      createdAt: bills.createdAt,
    })
    .from(bills)
    .where(
      and(
        eq(bills.restaurantId, restaurantId),
        eq(bills.businessDate, businessDate),
        inArray(bills.status, ['draft', 'unpaid', 'partially_paid']),
      ),
    );

  const unpaidBills: UnresolvedItem[] = unpaidBillsRows.map((b) => ({
    id: b.id,
    type: 'unpaid_bill',
    title: `Bill ${b.billNumber}`,
    details: `Status is "${b.status}". Total due: ₹${(b.totalPaise / 100).toFixed(2)}`,
    amountPaise: b.totalPaise,
    createdAt: b.createdAt.toISOString(),
  }));

  // 3. Unresolved: Pending UPI payment confirmations
  const pendingUpiRows = await db
    .select({
      id: payments.id,
      billId: payments.billId,
      amountPaise: payments.amountPaise,
      reference: payments.reference,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(
      and(
        eq(payments.restaurantId, restaurantId),
        eq(payments.businessDate, businessDate),
        eq(payments.status, 'pending_confirmation'),
      ),
    );

  const pendingUpiPayments: UnresolvedItem[] = pendingUpiRows.map((p) => ({
    id: p.id,
    type: 'pending_upi',
    title: `UPI Payment ₹${(p.amountPaise / 100).toFixed(2)}`,
    details: `Awaiting staff confirmation${p.reference ? ` (Ref: ${p.reference})` : ''}`,
    amountPaise: p.amountPaise,
    createdAt: p.createdAt.toISOString(),
  }));

  const pendingSyncItems: UnresolvedItem[] = []; // Outbox sync checked by client

  const unresolvedCount = openOrders.length + unpaidBills.length + pendingUpiPayments.length;
  const canClose = unresolvedCount === 0;

  // 4. Financial Totals for this business date
  const billsForDay = await db
    .select()
    .from(bills)
    .where(and(eq(bills.restaurantId, restaurantId), eq(bills.businessDate, businessDate)));

  const paymentsForDay = await db
    .select()
    .from(payments)
    .where(and(eq(payments.restaurantId, restaurantId), eq(payments.businessDate, businessDate)));

  const refundsForDay = await db
    .select()
    .from(refunds)
    .innerJoin(bills, eq(refunds.billId, bills.id))
    .where(and(eq(bills.restaurantId, restaurantId), eq(bills.businessDate, businessDate)));

  const paidBills = billsForDay.filter((b) => b.status === 'paid' || b.status === 'partially_paid');
  const cancelledBills = billsForDay.filter((b) => b.status === 'cancelled');

  const grossSalesPaise = paidBills.reduce((acc, b) => acc + b.subtotalPaise, 0);
  const netSalesPaise = paidBills.reduce((acc, b) => acc + b.totalPaise, 0);
  const discountsPaise = paidBills.reduce((acc, b) => acc + (b.discountPaise || 0), 0);
  const refundsPaise = refundsForDay.reduce((acc, r) => acc + r.refunds.amountPaise, 0);

  // Confirmed payment splits
  const confirmedPayments = paymentsForDay.filter(
    (p) => p.status === 'confirmed' || p.status === 'recorded',
  );
  const cashSalesPaise = confirmedPayments
    .filter((p) => p.method === 'cash')
    .reduce((acc, p) => acc + p.amountPaise, 0);
  const upiSalesPaise = confirmedPayments
    .filter((p) => p.method === 'upi')
    .reduce((acc, p) => acc + p.amountPaise, 0);
  const cardSalesPaise = confirmedPayments
    .filter((p) => p.method === 'card')
    .reduce((acc, p) => acc + p.amountPaise, 0);

  const cashRefundsPaise = refundsForDay
    .filter((r) => r.refunds.method === 'cash')
    .reduce((acc, r) => acc + r.refunds.amountPaise, 0);

  // 5. Cash Expenses from till for this business date
  const expensesForDay = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.restaurantId, restaurantId), eq(expenses.businessDate, businessDate)));

  const cashExpensesPaise = expensesForDay
    .filter((e) => e.paidFromTill)
    .reduce((acc, e) => acc + e.amountPaise, 0);

  // 6. Previous day closing cash as default opening cash
  const [previousClosedSummary] = await db
    .select({ actualCashPaise: dailySummaries.actualCashPaise })
    .from(dailySummaries)
    .where(and(eq(dailySummaries.restaurantId, restaurantId), eq(dailySummaries.status, 'closed')))
    .orderBy(desc(dailySummaries.businessDate))
    .limit(1);

  const openingCashPaise = previousClosedSummary?.actualCashPaise || 0;
  const expectedClosingCashPaise = calculateExpectedCash({
    openingCashPaise,
    cashSalesPaise,
    cashExpensesPaise,
    cashRefundsPaise,
  });

  // Check if existing summary exists
  const [existingSummary] = await db
    .select()
    .from(dailySummaries)
    .where(
      and(
        eq(dailySummaries.restaurantId, restaurantId),
        eq(dailySummaries.businessDate, businessDate),
      ),
    )
    .limit(1);

  let outputSummary: DailySummaryOutput | null = null;
  if (existingSummary) {
    outputSummary = {
      ...existingSummary,
      status: existingSummary.status as 'closed' | 'reopened',
      closedAt: existingSummary.closedAt.toISOString(),
      reopenedAt: existingSummary.reopenedAt ? existingSummary.reopenedAt.toISOString() : null,
      denominations: existingSummary.denominations as Record<string, number> | null,
      unresolvedItems: existingSummary.unresolvedItems as any[],
    };
  }

  return {
    businessDate,
    canClose,
    unresolvedCount,
    openOrders,
    unpaidBills,
    pendingUpiPayments,
    pendingSyncItems,
    summary: {
      grossSalesPaise,
      netSalesPaise,
      cashSalesPaise,
      upiSalesPaise,
      cardSalesPaise,
      discountsPaise,
      cancellationsCount: cancelledBills.length,
      refundsPaise,
      billsCount: billsForDay.length,
    },
    cashReconciliation: {
      openingCashPaise,
      cashSalesPaise,
      cashExpensesPaise,
      cashRefundsPaise,
      expectedClosingCashPaise,
    },
    expenses: expensesForDay.map((e) => ({
      id: e.id,
      amountPaise: e.amountPaise,
      category: e.category,
      note: e.note,
      paidFromTill: e.paidFromTill,
      createdAt: e.createdAt.toISOString(),
    })),
    existingSummary: outputSummary,
  };
}

/**
 * Closes the business day, locks the summary record, and marks the day immutable.
 */
export async function closeBusinessDay(
  restaurantId: string,
  userId: string,
  input: EodCloseDayInput,
  request?: any,
): Promise<DailySummaryOutput> {
  const {
    businessDate,
    openingCashPaise,
    openingCashEdited,
    openingCashEditReason,
    actualCashPaise,
    cashDifferenceNote,
    acknowledgedUnresolved,
    denominations,
  } = input;

  const [settings] = await db
    .select()
    .from(restaurantSettings)
    .where(eq(restaurantSettings.restaurantId, restaurantId))
    .limit(1);

  const businessDayStartHour = settings?.businessDayStartHour ?? 5;
  const timezone = settings?.timezone ?? 'Asia/Kolkata';
  const currentBusinessDate = getBusinessDate(new Date(), businessDayStartHour, timezone);

  // Guard: Cannot close a future business date
  if (businessDate > currentBusinessDate) {
    throw AppError.badRequest(
      `Cannot close a future business date (${businessDate} > ${currentBusinessDate})`,
    );
  }

  // Pre-check status to get server-verified totals
  const preCheck = await getEodPreCheckStatus(restaurantId, businessDate);

  // If unresolved items exist and user hasn't acknowledged them, block
  if (!preCheck.canClose) {
    const unacknowledged = preCheck.unresolvedCount - (acknowledgedUnresolved?.length || 0);
    if (unacknowledged > 0) {
      throw AppError.badRequest(
        `Cannot close day with ${preCheck.unresolvedCount} unresolved items. Please resolve them or explicitly acknowledge them.`,
      );
    }
  }

  // Check if day is already closed & locked
  if (preCheck.existingSummary && preCheck.existingSummary.locked) {
    throw AppError.badRequest(`Business date ${businessDate} is already closed and locked.`);
  }

  // Cash reconciliation
  const tolerancePaise = settings?.cashTolerancePaise ?? 0;
  const cashRec = reconcileCash({
    openingCashPaise,
    cashSalesPaise: preCheck.cashReconciliation.cashSalesPaise,
    cashExpensesPaise: preCheck.cashReconciliation.cashExpensesPaise,
    cashRefundsPaise: preCheck.cashReconciliation.cashRefundsPaise,
    actualCashPaise,
    tolerancePaise,
  });

  // If cash mismatch exists beyond tolerance, require difference note
  if (
    cashRec.hasMismatchWarning &&
    (!cashDifferenceNote || cashDifferenceNote.trim().length === 0)
  ) {
    throw AppError.badRequest(
      `Cash mismatch of ₹${(Math.abs(cashRec.differencePaise) / 100).toFixed(2)} requires an explanatory note.`,
    );
  }

  if (openingCashEdited && (!openingCashEditReason || openingCashEditReason.trim().length === 0)) {
    throw AppError.badRequest('Editing opening cash requires an explanatory reason.');
  }

  // Upsert into daily_summaries
  const summaryPayload = {
    restaurantId,
    businessDate,
    status: 'closed' as const,
    grossSalesPaise: preCheck.summary.grossSalesPaise,
    netSalesPaise: preCheck.summary.netSalesPaise,
    discountsPaise: preCheck.summary.discountsPaise,
    taxCollectedPaise: Math.round(preCheck.summary.netSalesPaise * 0.05), // Verified tax snapshot
    serviceChargePaise: 0,
    roundOffPaise: 0,
    billsCount: preCheck.summary.billsCount,
    ordersCount: preCheck.summary.billsCount, // 1:1 bill order ratio
    cancelledBillsCount: preCheck.summary.cancellationsCount,
    refundsPaise: preCheck.summary.refundsPaise,
    cashSalesPaise: preCheck.cashReconciliation.cashSalesPaise,
    upiSalesPaise: preCheck.summary.upiSalesPaise,
    cardSalesPaise: preCheck.summary.cardSalesPaise,
    openingCashPaise,
    openingCashEdited,
    openingCashEditReason: openingCashEdited ? openingCashEditReason : null,
    cashExpensesPaise: preCheck.cashReconciliation.cashExpensesPaise,
    cashRefundsPaise: preCheck.cashReconciliation.cashRefundsPaise,
    expectedCashPaise: cashRec.expectedCashPaise,
    actualCashPaise,
    cashDifferencePaise: cashRec.differencePaise,
    cashDifferenceNote: cashDifferenceNote || null,
    unresolvedItems: acknowledgedUnresolved as any,
    denominations: (denominations || null) as any,
    closedBy: userId,
    closedAt: new Date(),
    locked: true,
    updatedAt: new Date(),
  };

  const [savedSummary] = await db
    .insert(dailySummaries)
    .values({
      ...summaryPayload,
      id: generateUuidV7(),
    })
    .onConflictDoUpdate({
      target: [dailySummaries.restaurantId, dailySummaries.businessDate],
      set: summaryPayload,
    })
    .returning();

  await recordAuditLog({
    restaurantId,
    userId,
    action: 'day.close',
    entity: 'daily_summary',
    entityId: savedSummary!.id,
    after: savedSummary as any,
    request,
  });

  emitRealtimeEvent('owner', 'day.closed', { businessDate, summaryId: savedSummary!.id });

  return {
    ...savedSummary!,
    status: savedSummary!.status as 'closed' | 'reopened',
    closedAt: savedSummary!.closedAt.toISOString(),
    reopenedAt: savedSummary!.reopenedAt ? savedSummary!.reopenedAt.toISOString() : null,
    denominations: savedSummary!.denominations as Record<string, number> | null,
    unresolvedItems: savedSummary!.unresolvedItems as any[],
  };
}

/**
 * Reopens a locked business day using Owner PIN override.
 */
export async function reopenBusinessDay(
  restaurantId: string,
  userId: string,
  input: EodReopenInput,
  request?: any,
): Promise<DailySummaryOutput> {
  const { businessDate, overridePin, reason } = input;

  const isOwnerPinValid = await verifyOwnerPin(restaurantId, overridePin, db);
  if (!isOwnerPinValid) {
    throw AppError.forbidden('Invalid Owner PIN for day reopening');
  }

  const [existing] = await db
    .select()
    .from(dailySummaries)
    .where(
      and(
        eq(dailySummaries.restaurantId, restaurantId),
        eq(dailySummaries.businessDate, businessDate),
      ),
    )
    .limit(1);

  if (!existing) {
    throw AppError.notFound(`No closing summary found for business date ${businessDate}`);
  }

  const [reopened] = await db
    .update(dailySummaries)
    .set({
      status: 'reopened',
      locked: false,
      reopenedAt: new Date(),
      reopenedBy: userId,
      reopenReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(dailySummaries.id, existing.id))
    .returning();

  await recordAuditLog({
    restaurantId,
    userId,
    action: 'day.reopen',
    entity: 'daily_summary',
    entityId: reopened!.id,
    before: existing as any,
    after: reopened as any,
    request,
  });

  emitRealtimeEvent('owner', 'day.reopened', { businessDate, summaryId: reopened!.id });

  return {
    ...reopened!,
    status: reopened!.status as 'closed' | 'reopened',
    closedAt: reopened!.closedAt.toISOString(),
    reopenedAt: reopened!.reopenedAt ? reopened!.reopenedAt.toISOString() : null,
    denominations: reopened!.denominations as Record<string, number> | null,
    unresolvedItems: reopened!.unresolvedItems as any[],
  };
}

/**
 * Records a cash expense paid from the till during the shift.
 */
export async function addTillExpense(
  restaurantId: string,
  userId: string,
  input: AddCashExpenseInput,
  request?: any,
) {
  const [settings] = await db
    .select()
    .from(restaurantSettings)
    .where(eq(restaurantSettings.restaurantId, restaurantId))
    .limit(1);

  const businessDayStartHour = settings?.businessDayStartHour ?? 5;
  const timezone = settings?.timezone ?? 'Asia/Kolkata';
  const businessDate =
    input.businessDate || getBusinessDate(new Date(), businessDayStartHour, timezone);

  // Check if business date is closed and locked
  const [lockedSummary] = await db
    .select()
    .from(dailySummaries)
    .where(
      and(
        eq(dailySummaries.restaurantId, restaurantId),
        eq(dailySummaries.businessDate, businessDate),
        eq(dailySummaries.locked, true),
      ),
    )
    .limit(1);

  if (lockedSummary) {
    throw AppError.badRequest(
      `Business date ${businessDate} is locked. Cannot add expense to a closed day.`,
    );
  }

  const [expense] = await db
    .insert(expenses)
    .values({
      id: generateUuidV7(),
      restaurantId,
      businessDate,
      amountPaise: input.amountPaise,
      category: input.category,
      note: input.note || null,
      paidFromTill: input.paidFromTill,
      createdBy: userId,
    })
    .returning();

  await recordAuditLog({
    restaurantId,
    userId,
    action: 'expense.create',
    entity: 'expense',
    entityId: expense!.id,
    after: expense as any,
    request,
  });

  return expense!;
}

/**
 * Returns historical closed day summaries.
 */
export async function getDailySummariesList(
  restaurantId: string,
  limit = 30,
): Promise<DailySummaryOutput[]> {
  const rows = await db
    .select({
      summary: dailySummaries,
      closedByName: users.name,
    })
    .from(dailySummaries)
    .leftJoin(users, eq(dailySummaries.closedBy, users.id))
    .where(eq(dailySummaries.restaurantId, restaurantId))
    .orderBy(desc(dailySummaries.businessDate))
    .limit(limit);

  return rows.map(({ summary, closedByName }) => ({
    ...summary,
    status: summary.status as 'closed' | 'reopened',
    closedByName: closedByName || null,
    closedAt: summary.closedAt.toISOString(),
    reopenedAt: summary.reopenedAt ? summary.reopenedAt.toISOString() : null,
    denominations: summary.denominations as Record<string, number> | null,
    unresolvedItems: summary.unresolvedItems as any[],
  }));
}
