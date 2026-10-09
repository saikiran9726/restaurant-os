import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  Permissions,
  AppError,
  updateLoyaltySettingsSchema,
  manualLoyaltyAdjustSchema,
  type CustomerLoyaltyDetails,
  type LoyaltyOverviewSummary,
  calculateMaxRedeemable,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { loyaltySettings, loyaltyAccounts, loyaltyTransactions } from '../db/schema/loyalty.js';
import { customers } from '../db/schema/customers.js';
import { bills } from '../db/schema/bills.js';
import { users } from '../db/schema/users.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';
import { getOrCreateLoyaltySettings, getOrCreateLoyaltyAccount } from '../services/loyalty.js';

export async function registerLoyaltyRoutes(app: FastifyInstance): Promise<void> {
  // Register permissions in central route registry for automated audits
  registerRouteGuard({
    method: 'GET',
    url: '/loyalty/settings',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'PUT',
    url: '/loyalty/settings',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/customers/:id/loyalty',
    isPublic: false,
    permission: Permissions.CUSTOMER_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/loyalty/adjust',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE, // Owner-only
  });
  registerRouteGuard({
    method: 'GET',
    url: '/loyalty/overview',
    isPublic: false,
    permission: Permissions.REPORT_READ, // Owner-only
  });

  /**
   * GET /loyalty/settings - Fetch restaurant loyalty configuration
   */
  app.get(
    '/loyalty/settings',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const settings = await getOrCreateLoyaltySettings(authUser.restaurantId);
      return reply.send(settings);
    },
  );

  /**
   * PUT /loyalty/settings - Update restaurant loyalty configuration
   */
  app.put(
    '/loyalty/settings',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const { restaurantId, userId } = authUser;
      const body = updateLoyaltySettingsSchema.parse(request.body);

      // Validate tier thresholds are ascending
      if (body.tiers && body.tiers.length > 1) {
        for (let i = 1; i < body.tiers.length; i++) {
          if (body.tiers[i]!.thresholdSpendPaise <= body.tiers[i - 1]!.thresholdSpendPaise) {
            throw AppError.badRequest('Tier spend thresholds must be in strictly ascending order');
          }
        }
      }

      const existing = await getOrCreateLoyaltySettings(restaurantId);

      const [updated] = await db
        .update(loyaltySettings)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(loyaltySettings.restaurantId, restaurantId))
        .returning();

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'loyalty.settings_update',
        entity: 'loyalty_settings',
        entityId: updated!.id,
        before: existing,
        after: updated,
        request,
      });

      return reply.send(updated);
    },
  );

  /**
   * GET /customers/:id/loyalty - Get customer loyalty balance, tier, and transaction history
   * Waiters see balance & tier only; owners see full transaction history.
   */
  app.get(
    '/customers/:id/loyalty',
    { preHandler: [requirePermission(Permissions.CUSTOMER_READ)] },
    async (request: FastifyRequest, reply) => {
      const { id: customerId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, permissions } = authUser;
      const canManage = permissions.includes(Permissions.CUSTOMER_MANAGE);

      const [customer] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.restaurantId, restaurantId)))
        .limit(1);

      if (!customer) throw AppError.notFound('Customer not found');

      const settings = await getOrCreateLoyaltySettings(restaurantId);
      const account = await getOrCreateLoyaltyAccount(restaurantId, customerId);

      // Find active tier multiplier
      const activeTierObj = settings.tiers.find((t) => t.name === account.tier) || {
        earnMultiplier: 1,
      };

      // If owner, fetch full transaction history joined with bills and users
      let transactions: any[] = [];
      if (canManage) {
        const rows = await db
          .select({
            id: loyaltyTransactions.id,
            type: loyaltyTransactions.type,
            points: loyaltyTransactions.points,
            billId: loyaltyTransactions.billId,
            billNumber: bills.billNumber,
            reason: loyaltyTransactions.reason,
            createdBy: loyaltyTransactions.createdBy,
            createdByName: users.name,
            createdAt: loyaltyTransactions.createdAt,
          })
          .from(loyaltyTransactions)
          .leftJoin(bills, eq(loyaltyTransactions.billId, bills.id))
          .leftJoin(users, eq(loyaltyTransactions.createdBy, users.id))
          .where(
            and(
              eq(loyaltyTransactions.customerId, customerId),
              eq(loyaltyTransactions.restaurantId, restaurantId),
            ),
          )
          .orderBy(desc(loyaltyTransactions.createdAt))
          .limit(50);

        transactions = rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }));
      }

      const responsePayload: CustomerLoyaltyDetails = {
        account: {
          customerId: account.customerId,
          pointsBalance: account.pointsBalance,
          tier: account.tier,
          tierMultiplier: activeTierObj.earnMultiplier,
          lifetimePoints: account.lifetimePoints,
        },
        settings,
        transactions,
      };

      return reply.send(responsePayload);
    },
  );

  /**
   * POST /loyalty/adjust - Owner manual points adjustment (Credit or Debit)
   * Strictly audited with mandatory reason.
   */
  app.post(
    '/loyalty/adjust',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const { restaurantId, userId } = authUser;
      const body = manualLoyaltyAdjustSchema.parse(request.body);

      const result = await db.transaction(async (tx) => {
        const [customer] = await tx
          .select()
          .from(customers)
          .where(and(eq(customers.id, body.customerId), eq(customers.restaurantId, restaurantId)))
          .limit(1);

        if (!customer) throw AppError.notFound('Customer not found');

        const account = await getOrCreateLoyaltyAccount(restaurantId, body.customerId, tx);

        // Anti-abuse: points balance cannot drop below 0 on manual debit
        if (body.points < 0 && account.pointsBalance + body.points < 0) {
          throw AppError.badRequest(
            `Cannot adjust by ${body.points} points. Customer balance is only ${account.pointsBalance} points.`,
          );
        }

        // Insert append-only transaction
        const [adjustTx] = await tx
          .insert(loyaltyTransactions)
          .values({
            restaurantId,
            accountId: account.id,
            customerId: body.customerId,
            type: 'adjust',
            points: body.points,
            reason: `Manual Adjustment: ${body.reason}`,
            createdBy: userId,
          })
          .returning();

        // Update account points
        const [updatedAccount] = await tx
          .update(loyaltyAccounts)
          .set({
            pointsBalance: sql`${loyaltyAccounts.pointsBalance} + ${body.points}`,
            lifetimePoints:
              body.points > 0
                ? sql`${loyaltyAccounts.lifetimePoints} + ${body.points}`
                : loyaltyAccounts.lifetimePoints,
            updatedAt: new Date(),
          })
          .where(eq(loyaltyAccounts.id, account.id))
          .returning();

        await recordAuditLog({
          restaurantId,
          userId,
          action: 'loyalty.manual_adjust',
          entity: 'loyalty_account',
          entityId: account.id,
          before: { pointsBalance: account.pointsBalance },
          after: {
            pointsBalance: updatedAccount!.pointsBalance,
            adjustment: body.points,
            reason: body.reason,
          },
          request,
        });

        return {
          transaction: adjustTx,
          account: updatedAccount,
        };
      });

      return reply.send(result);
    },
  );

  /**
   * GET /loyalty/overview - Owner metrics: points issued, redeemed, outstanding liability in ₹
   * and reconciliation audit.
   */
  app.get(
    '/loyalty/overview',
    { preHandler: [requirePermission(Permissions.REPORT_READ)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const { restaurantId } = authUser;

      const settings = await getOrCreateLoyaltySettings(restaurantId);

      // Aggregates from accounts
      const [accountsAgg] = await db
        .select({
          totalAccounts: sql<number>`count(*)::int`,
          totalBalance: sql<number>`coalesce(sum(${loyaltyAccounts.pointsBalance}), 0)::int`,
          totalLifetime: sql<number>`coalesce(sum(${loyaltyAccounts.lifetimePoints}), 0)::int`,
        })
        .from(loyaltyAccounts)
        .where(eq(loyaltyAccounts.restaurantId, restaurantId));

      // Aggregates from ledger transactions
      const [txAgg] = await db
        .select({
          totalEarned: sql<number>`coalesce(sum(case when ${loyaltyTransactions.type} in ('earn', 'bonus') then ${loyaltyTransactions.points} else 0 end), 0)::int`,
          totalRedeemed: sql<number>`coalesce(sum(case when ${loyaltyTransactions.type} = 'redeem' then abs(${loyaltyTransactions.points}) else 0 end), 0)::int`,
          ledgerNetSum: sql<number>`coalesce(sum(${loyaltyTransactions.points}), 0)::int`,
        })
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.restaurantId, restaurantId));

      const totalActivePoints = accountsAgg?.totalBalance || 0;
      const totalPointsIssued = txAgg?.totalEarned || 0;
      const totalPointsRedeemed = txAgg?.totalRedeemed || 0;

      // Estimated liability in paise:
      // Each block gives redeemValuePaise (e.g., 500 pts = ₹50 -> 0.10 ₹/pt)
      const pointsBlock = settings.redeemPointsBlock || 500;
      const valuePerPointPaise = (settings.redeemValuePaise || 5000) / pointsBlock;
      const estimatedLiabilityPaise = Math.round(totalActivePoints * valuePerPointPaise);

      const redemptionRatePercent =
        totalPointsIssued > 0
          ? Number(((totalPointsRedeemed / totalPointsIssued) * 100).toFixed(1))
          : 0;

      // Reconciliation audit check: accounts total vs ledger net sum
      const ledgerNetSum = txAgg?.ledgerNetSum || 0;
      const mismatchesDetected = totalActivePoints === ledgerNetSum ? 0 : 1;

      const overview: LoyaltyOverviewSummary = {
        totalAccounts: accountsAgg?.totalAccounts || 0,
        totalPointsIssued,
        totalPointsRedeemed,
        totalActivePoints,
        estimatedLiabilityPaise,
        redemptionRatePercent,
        mismatchesDetected,
      };

      return reply.send(overview);
    },
  );
}
