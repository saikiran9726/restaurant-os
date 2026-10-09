import type { FastifyRequest } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import {
  calculateLoyaltyEarn,
  determineCustomerTier,
  type LoyaltySettings,
  loyaltySettingsSchema,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { loyaltySettings, loyaltyAccounts, loyaltyTransactions } from '../db/schema/loyalty.js';
import { customers } from '../db/schema/customers.js';
import { bills } from '../db/schema/bills.js';
import { orders } from '../db/schema/orders.js';
import { recordAuditLog } from './audit.js';

/**
 * Gets or initializes default loyalty settings for a restaurant.
 */
export async function getOrCreateLoyaltySettings(
  restaurantId: string,
  tx: any = db,
): Promise<LoyaltySettings> {
  const [existing] = await tx
    .select()
    .from(loyaltySettings)
    .where(eq(loyaltySettings.restaurantId, restaurantId))
    .limit(1);

  if (existing) {
    return loyaltySettingsSchema.parse({
      enabled: existing.enabled,
      spendPaisePerBlock: existing.spendPaisePerBlock,
      pointsPerBlock: existing.pointsPerBlock,
      redeemPointsBlock: existing.redeemPointsBlock,
      redeemValuePaise: existing.redeemValuePaise,
      minRedeemPoints: existing.minRedeemPoints,
      maxRedeemPercentOfBill: existing.maxRedeemPercentOfBill,
      pointsExpiryDays: existing.pointsExpiryDays,
      earnOnDiscountedAmount: existing.earnOnDiscountedAmount,
      newAccountCooldownHours: existing.newAccountCooldownHours,
      perDayRedeemCapPoints: existing.perDayRedeemCapPoints,
      tiers: existing.tiers as any,
      visitReward: existing.visitReward as any,
      birthdayReward: existing.birthdayReward as any,
      referralReward: existing.referralReward as any,
    });
  }

  // Insert default settings
  const defaults = loyaltySettingsSchema.parse({});
  const [created] = await tx
    .insert(loyaltySettings)
    .values({
      restaurantId,
      enabled: defaults.enabled,
      spendPaisePerBlock: defaults.spendPaisePerBlock,
      pointsPerBlock: defaults.pointsPerBlock,
      redeemPointsBlock: defaults.redeemPointsBlock,
      redeemValuePaise: defaults.redeemValuePaise,
      minRedeemPoints: defaults.minRedeemPoints,
      maxRedeemPercentOfBill: defaults.maxRedeemPercentOfBill,
      pointsExpiryDays: defaults.pointsExpiryDays,
      earnOnDiscountedAmount: defaults.earnOnDiscountedAmount,
      newAccountCooldownHours: defaults.newAccountCooldownHours,
      perDayRedeemCapPoints: defaults.perDayRedeemCapPoints,
      tiers: defaults.tiers as any,
      visitReward: defaults.visitReward as any,
      birthdayReward: defaults.birthdayReward as any,
      referralReward: defaults.referralReward as any,
    })
    .returning();

  return defaults;
}

/**
 * Gets or initializes a customer's loyalty account with tier and balance.
 */
export async function getOrCreateLoyaltyAccount(
  restaurantId: string,
  customerId: string,
  tx: any = db,
) {
  const [existing] = await tx
    .select()
    .from(loyaltyAccounts)
    .where(
      and(
        eq(loyaltyAccounts.restaurantId, restaurantId),
        eq(loyaltyAccounts.customerId, customerId),
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [customer] = await tx
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.restaurantId, restaurantId)))
    .limit(1);

  const settings = await getOrCreateLoyaltySettings(restaurantId, tx);
  const tier = determineCustomerTier(customer?.totalSpentPaise || 0, settings.tiers);

  const [created] = await tx
    .insert(loyaltyAccounts)
    .values({
      restaurantId,
      customerId,
      pointsBalance: 0,
      tier: tier.name,
      lifetimePoints: 0,
    })
    .returning();

  return created!;
}

/**
 * Server-side hook triggered when a bill transitions to status 'paid'.
 * Idempotent: protected by UNIQUE(bill_id, type) on loyalty_transactions.
 */
export async function processBillPaidLoyaltyEarn(
  params: {
    restaurantId: string;
    billId: string;
    userId?: string | null;
    request?: FastifyRequest;
  },
  tx: any = db,
) {
  const { restaurantId, billId, userId, request } = params;

  // 1. Fetch bill and order to check customer attachment
  const [bill] = await tx
    .select()
    .from(bills)
    .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
    .limit(1);

  if (!bill || bill.status !== 'paid') return null;

  const [order] = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.id, bill.orderId), eq(orders.restaurantId, restaurantId)))
    .limit(1);

  if (!order || !order.customerId) return null;
  const customerId = order.customerId;

  // 2. Fetch customer & settings
  const [customer] = await tx
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.restaurantId, restaurantId)))
    .limit(1);

  if (!customer) return null;

  const settings = await getOrCreateLoyaltySettings(restaurantId, tx);
  if (!settings.enabled) return null;

  // 3. Check if earn transaction already recorded for this bill (idempotency)
  const [existingEarn] = await tx
    .select()
    .from(loyaltyTransactions)
    .where(and(eq(loyaltyTransactions.billId, billId), eq(loyaltyTransactions.type, 'earn')))
    .limit(1);

  if (existingEarn) {
    return existingEarn;
  }

  // 4. Calculate earn points using shared math engine
  // Excludes loyalty discount portion
  const loyaltyDiscountPaise = bill.loyaltyDiscountPaise || 0;
  const otherDiscountPaise = Math.max(0, (bill.discountPaise || 0) - loyaltyDiscountPaise);

  const earnResult = calculateLoyaltyEarn({
    billSubtotalPaise: bill.subtotalPaise,
    netPaidPaise: bill.totalPaise,
    loyaltyDiscountPaise,
    otherDiscountPaise,
    customerLifetimeSpendPaise: customer.totalSpentPaise || 0,
    settings,
  });

  const totalEarnPoints = earnResult.earnedPoints;

  // 5. Check Visit-Based Bonus (every Nth paid visit)
  let visitBonusPoints = 0;
  if (
    settings.visitReward.enabled &&
    customer.visitCount > 0 &&
    customer.visitCount % settings.visitReward.everyNVisits === 0
  ) {
    // Check if visit bonus already issued for this bill
    const [existingVisitBonus] = await tx
      .select()
      .from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.billId, billId), eq(loyaltyTransactions.type, 'bonus')))
      .limit(1);

    if (!existingVisitBonus) {
      visitBonusPoints = settings.visitReward.bonusPoints;
    }
  }

  const account = await getOrCreateLoyaltyAccount(restaurantId, customerId, tx);

  // 6. Record Earn Ledger entry
  let earnTx = null;
  if (totalEarnPoints > 0) {
    [earnTx] = await tx
      .insert(loyaltyTransactions)
      .values({
        restaurantId,
        accountId: account.id,
        customerId,
        type: 'earn',
        points: totalEarnPoints,
        billId,
        reason: `Earned on Bill #${bill.billNumber} (${earnResult.tierName} Tier)`,
        createdBy: userId || null,
      })
      .returning();
  }

  // 7. Record Visit Bonus Ledger entry if applicable
  if (visitBonusPoints > 0) {
    await tx.insert(loyaltyTransactions).values({
      restaurantId,
      accountId: account.id,
      customerId,
      type: 'bonus',
      points: visitBonusPoints,
      billId,
      reason: `Milestone Visit Bonus (Visit #${customer.visitCount})`,
      createdBy: userId || null,
    });
  }

  // 8. Update cached balance and tier on loyalty_accounts
  const totalCredited = totalEarnPoints + visitBonusPoints;
  const newTier = determineCustomerTier(customer.totalSpentPaise || 0, settings.tiers);

  await tx
    .update(loyaltyAccounts)
    .set({
      pointsBalance: sql`${loyaltyAccounts.pointsBalance} + ${totalCredited}`,
      lifetimePoints: sql`${loyaltyAccounts.lifetimePoints} + ${totalCredited}`,
      tier: newTier.name,
      updatedAt: new Date(),
    })
    .where(eq(loyaltyAccounts.id, account.id));

  if (request && earnTx) {
    await recordAuditLog({
      restaurantId,
      userId: userId || undefined,
      action: 'loyalty.earn',
      entity: 'loyalty_transaction',
      entityId: earnTx.id,
      after: earnTx,
      request,
    });
  }

  return earnTx;
}

/**
 * Server-side hook triggered when a bill is cancelled or refunded.
 * Anti-abuse:
 * - If bill earned points, creates reversal transaction (debit earned points).
 * - If bill had redeemed points, returns them back to customer (credit redeemed points).
 */
export async function processBillReversalLoyalty(
  params: {
    restaurantId: string;
    billId: string;
    reason: string;
    userId?: string | null;
    request?: FastifyRequest;
  },
  tx: any = db,
) {
  const { restaurantId, billId, reason, userId, request } = params;

  // 1. Fetch all transactions associated with this bill
  const existingTxs = await tx
    .select()
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.billId, billId),
        eq(loyaltyTransactions.restaurantId, restaurantId),
      ),
    );

  if (existingTxs.length === 0) return;

  const earnTxs = existingTxs.filter((t: any) => t.type === 'earn' || t.type === 'bonus');
  const redeemTxs = existingTxs.filter((t: any) => t.type === 'redeem');
  const hasReversal = existingTxs.some((t: any) => t.type === 'reversal');

  if (hasReversal) return; // Already reversed

  const customerId = existingTxs[0]!.customerId;
  const accountId = existingTxs[0]!.accountId;

  let netReversalPoints = 0;

  // A. Reverse earned points (negative ledger debit)
  const totalEarned = earnTxs.reduce((sum: number, t: any) => sum + t.points, 0);
  if (totalEarned > 0) {
    netReversalPoints -= totalEarned;
  }

  // B. Return redeemed points (positive ledger credit)
  const totalRedeemed = redeemTxs.reduce((sum: number, t: any) => sum + Math.abs(t.points), 0);
  if (totalRedeemed > 0) {
    netReversalPoints += totalRedeemed;
  }

  // Create append-only reversal ledger entry
  const [reversalTx] = await tx
    .insert(loyaltyTransactions)
    .values({
      restaurantId,
      accountId,
      customerId,
      type: 'reversal',
      points: netReversalPoints,
      billId,
      reason: `Reversal for Bill cancellation/refund: ${reason}`,
      createdBy: userId || null,
    })
    .returning();

  // Update cached balance on loyalty_accounts (prevent negative balance via Math.max(0))
  await tx
    .update(loyaltyAccounts)
    .set({
      pointsBalance: sql`GREATEST(0, ${loyaltyAccounts.pointsBalance} + ${netReversalPoints})`,
      updatedAt: new Date(),
    })
    .where(eq(loyaltyAccounts.id, accountId));

  if (request) {
    await recordAuditLog({
      restaurantId,
      userId: userId || undefined,
      action: 'loyalty.reversal',
      entity: 'loyalty_transaction',
      entityId: reversalTx!.id,
      after: reversalTx,
      request,
    });
  }

  return reversalTx;
}
