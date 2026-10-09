import { eq, and, desc, sql, gte, lte, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { healthModels, healthSnapshots } from '../db/schema/health.js';
import { dailySummaries } from '../db/schema/daily-summaries.js';
import { bills, payments } from '../db/schema/bills.js';
import {
  purchases,
  purchaseLines,
  inventoryItems,
  stockMovements,
} from '../db/schema/inventory.js';
import { expenses, expenseCategories } from '../db/schema/expenses.js';
import { kots } from '../db/schema/kots.js';
import { customers } from '../db/schema/customers.js';
import { restaurantSettings } from '../db/schema/restaurant-settings.js';
import {
  evaluateHealthScore,
  DEFAULT_HEALTH_WEIGHTS,
  DEFAULT_HEALTH_TARGETS,
  type RawHealthInputs,
  type HealthModelOutput,
  type HealthSnapshotOutput,
  type HealthScoreResult,
  type UpdateHealthModelInput,
} from '@restaurant-os/shared';

export class HealthService {
  /**
   * Fetch the current active model version for a restaurant.
   */
  static async getModel(restaurantId: string): Promise<HealthModelOutput> {
    const [model] = await db
      .select()
      .from(healthModels)
      .where(eq(healthModels.restaurantId, restaurantId))
      .orderBy(desc(healthModels.version))
      .limit(1);

    if (model) {
      return {
        id: model.id,
        restaurantId: model.restaurantId,
        version: model.version,
        windowDays: model.windowDays,
        weights: model.weights,
        targets: model.targets,
        createdAt: model.createdAt.toISOString(),
        updatedAt: model.updatedAt.toISOString(),
      };
    }

    // Initialize default version 1 model
    const [newModel] = await db
      .insert(healthModels)
      .values({
        restaurantId,
        version: 1,
        windowDays: 30,
        weights: DEFAULT_HEALTH_WEIGHTS,
        targets: DEFAULT_HEALTH_TARGETS,
      })
      .returning();

    return {
      id: newModel!.id,
      restaurantId: newModel!.restaurantId,
      version: newModel!.version,
      windowDays: newModel!.windowDays,
      weights: newModel!.weights,
      targets: newModel!.targets,
      createdAt: newModel!.createdAt.toISOString(),
      updatedAt: newModel!.updatedAt.toISOString(),
    };
  }

  /**
   * Update weights and targets, creating a new model version.
   */
  static async updateModel(
    restaurantId: string,
    userId: string,
    data: UpdateHealthModelInput,
  ): Promise<HealthModelOutput> {
    const current = await this.getModel(restaurantId);
    const newVersion = current.version + 1;

    const [created] = await db
      .insert(healthModels)
      .values({
        restaurantId,
        version: newVersion,
        windowDays: data.windowDays,
        weights: data.weights,
        targets: data.targets,
        createdBy: userId,
      })
      .returning();

    return {
      id: created!.id,
      restaurantId: created!.restaurantId,
      version: created!.version,
      windowDays: created!.windowDays,
      weights: created!.weights,
      targets: created!.targets,
      createdAt: created!.createdAt.toISOString(),
      updatedAt: created!.updatedAt.toISOString(),
    };
  }

  /**
   * Recompute the restaurant health score as of a specific date (defaults to today).
   */
  static async recomputeScore(
    restaurantId: string,
    asOfDateStr?: string,
  ): Promise<HealthScoreResult & { snapshotId: string; snapshotDate: string }> {
    const model = await this.getModel(restaurantId);
    const targetDate = asOfDateStr || new Date().toISOString().slice(0, 10);
    const windowDays = model.windowDays;

    // Calculate dates
    const asOf = new Date(targetDate);
    const windowStartDate = new Date(asOf);
    windowStartDate.setDate(windowStartDate.getDate() - windowDays);
    const windowStartStr = windowStartDate.toISOString().slice(0, 10);

    const prevWindowStartDate = new Date(windowStartDate);
    prevWindowStartDate.setDate(prevWindowStartDate.getDate() - windowDays);
    const prevWindowStartStr = prevWindowStartDate.toISOString().slice(0, 10);

    // 1. SALES AGGREGATION
    // Current Window
    const currentSummaries = await db
      .select()
      .from(dailySummaries)
      .where(
        and(
          eq(dailySummaries.restaurantId, restaurantId),
          gte(dailySummaries.businessDate, windowStartStr),
          lte(dailySummaries.businessDate, targetDate),
        ),
      );

    const currentRevenue = currentSummaries.reduce(
      (sum, row) => sum + Number(row.netSalesPaise),
      0,
    );
    const daysWithSales = currentSummaries.filter((r) => Number(r.netSalesPaise) > 0).length;

    // Previous Window
    const prevSummaries = await db
      .select()
      .from(dailySummaries)
      .where(
        and(
          eq(dailySummaries.restaurantId, restaurantId),
          gte(dailySummaries.businessDate, prevWindowStartStr),
          lt(dailySummaries.businessDate, windowStartStr),
        ),
      );

    const prevRevenue = prevSummaries.reduce((sum, row) => sum + Number(row.netSalesPaise), 0);

    // 2. SUPPLIES & PURCHASES
    const purchaseRows = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.restaurantId, restaurantId),
          gte(purchases.purchaseDate, windowStartStr),
          lte(purchases.purchaseDate, targetDate),
        ),
      );

    const suppliesCostPaise = purchaseRows.reduce((sum, row) => sum + Number(row.totalPaise), 0);

    // 3. OPERATING EXPENSES
    const expenseRows = await db
      .select({
        amountPaise: expenses.amountPaise,
        countsAsOperating: expenseCategories.countsAsOperating,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(
        and(
          eq(expenses.restaurantId, restaurantId),
          gte(expenses.expenseDate, windowStartStr),
          lte(expenses.expenseDate, targetDate),
        ),
      );

    const operatingExpensesPaise = expenseRows.reduce((sum, row) => {
      // Default to true if no category attached
      const isOperating = row.countsAsOperating !== null ? row.countsAsOperating : true;
      return isOperating ? sum + Number(row.amountPaise) : sum;
    }, 0);

    // Margin & Food Cost Ratios
    let estimatedMarginPercent: number | null = null;
    let suppliesPercentOfRevenue: number | null = null;

    if (currentRevenue > 0) {
      const estimatedProfit = currentRevenue - suppliesCostPaise - operatingExpensesPaise;
      estimatedMarginPercent = Math.round((estimatedProfit / currentRevenue) * 100 * 10) / 10;
      suppliesPercentOfRevenue = Math.round((suppliesCostPaise / currentRevenue) * 100 * 10) / 10;
    }

    // 4. CUSTOMER RETENTION
    const customerRows = await db
      .select()
      .from(customers)
      .where(eq(customers.restaurantId, restaurantId));

    const activeCustomers = customerRows.filter((c) => {
      if (!c.lastVisitAt) return false;
      const visitDate = c.lastVisitAt.toISOString().slice(0, 10);
      return visitDate >= windowStartStr && visitDate <= targetDate;
    });

    const repeatCustomers = activeCustomers.filter((c) => c.visitCount >= 2);
    const repeatRatePercent =
      activeCustomers.length > 0
        ? Math.round((repeatCustomers.length / activeCustomers.length) * 1000) / 10
        : null;

    // 5. INVENTORY EFFICIENCY
    const activeItems = await db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.restaurantId, restaurantId), eq(inventoryItems.active, true)));

    const lowOrOutOfStock = activeItems.filter(
      (item) =>
        Number(item.currentStock) <= Number(item.reorderLevel) || Number(item.currentStock) <= 0,
    );

    const inStockPercent =
      activeItems.length > 0
        ? Math.round(((activeItems.length - lowOrOutOfStock.length) / activeItems.length) * 1000) /
          10
        : null;

    // 6. WASTE
    const wasteMovements = await db
      .select({
        quantity: stockMovements.quantity,
        itemId: stockMovements.itemId,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.restaurantId, restaurantId),
          eq(stockMovements.type, 'waste'),
          gte(sql`to_char(${stockMovements.createdAt}, 'YYYY-MM-DD')`, windowStartStr),
          lte(sql`to_char(${stockMovements.createdAt}, 'YYYY-MM-DD')`, targetDate),
        ),
      );

    let wasteCostPaise = 0;
    for (const mov of wasteMovements) {
      const item = activeItems.find((i) => i.id === mov.itemId);
      const unitCost = item ? Number(item.avgCostPaisePerUnit) : 0;
      wasteCostPaise += Math.round(Math.abs(Number(mov.quantity)) * unitCost);
    }

    const wastePercentOfSupplies =
      suppliesCostPaise > 0
        ? Math.round((wasteCostPaise / suppliesCostPaise) * 100 * 10) / 10
        : null;

    // 7. KITCHEN EFFICIENCY
    const [settings] = await db
      .select()
      .from(restaurantSettings)
      .where(eq(restaurantSettings.restaurantId, restaurantId))
      .limit(1);

    const warnThresholdSeconds = 900; // 15 mins default
    const kotRows = await db
      .select()
      .from(kots)
      .where(
        and(
          eq(kots.restaurantId, restaurantId),
          gte(sql`to_char(${kots.createdAt}, 'YYYY-MM-DD')`, windowStartStr),
          lte(sql`to_char(${kots.createdAt}, 'YYYY-MM-DD')`, targetDate),
        ),
      );

    const readyKots = kotRows.filter((k) => k.readyAt !== null);
    const onTimeKots = readyKots.filter((k) => {
      if (!k.readyAt || !k.createdAt) return false;
      const durationSeconds = (k.readyAt.getTime() - k.createdAt.getTime()) / 1000;
      return durationSeconds <= warnThresholdSeconds;
    });

    const onTimePercent =
      readyKots.length >= 5 ? Math.round((onTimeKots.length / readyKots.length) * 1000) / 10 : null;

    // 8. PAYMENT RECONCILIATION
    const billRows = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.restaurantId, restaurantId),
          gte(sql`to_char(${bills.createdAt}, 'YYYY-MM-DD')`, windowStartStr),
          lte(sql`to_char(${bills.createdAt}, 'YYYY-MM-DD')`, targetDate),
        ),
      );

    const cleanBills = billRows.filter((b) => b.status === 'paid' || b.status === 'refunded');

    const matchedDays = currentSummaries.filter(
      (d) => Math.abs(Number(d.cashDifferencePaise)) <= 5000, // <= Rs 50 tolerance
    );

    let reconciliationScorePercent: number | null = null;
    if (billRows.length >= 3) {
      const billRatio = cleanBills.length / billRows.length;
      const cashRatio =
        currentSummaries.length > 0 ? matchedDays.length / currentSummaries.length : 1;
      reconciliationScorePercent = Math.round((0.6 * billRatio + 0.4 * cashRatio) * 1000) / 10;
    }

    // Assemble raw inputs
    const inputs: RawHealthInputs = {
      sales: {
        hasData: currentRevenue > 0 || prevRevenue > 0,
        currentWindowNetRevenuePaise: currentRevenue,
        previousWindowNetRevenuePaise: prevRevenue,
        daysWithSalesCount: daysWithSales,
      },
      profitability: {
        hasData: currentRevenue > 0,
        revenuePaise: currentRevenue,
        operatingExpensesPaise,
        suppliesCostPaise,
        estimatedMarginPercent,
      },
      retention: {
        hasData: activeCustomers.length >= 3,
        activeCustomersCount: activeCustomers.length,
        repeatCustomersCount: repeatCustomers.length,
        repeatRatePercent,
      },
      foodCost: {
        hasData: currentRevenue > 0 && suppliesCostPaise > 0,
        revenuePaise: currentRevenue,
        suppliesCostPaise,
        suppliesPercentOfRevenue,
      },
      inventory: {
        hasData: activeItems.length > 0,
        totalActiveItems: activeItems.length,
        lowOrOutOfStockItems: lowOrOutOfStock.length,
        inStockPercent,
        avgAuditVariancePercent: 0,
      },
      waste: {
        hasData: suppliesCostPaise > 0,
        wasteCostPaise,
        suppliesCostPaise,
        wastePercentOfSupplies,
      },
      kitchen: {
        hasData: readyKots.length >= 5,
        totalKotsCount: readyKots.length,
        onTimeKotsCount: onTimeKots.length,
        onTimePercent,
      },
      payment: {
        hasData: billRows.length >= 3,
        totalBillsCount: billRows.length,
        cleanBillsCount: cleanBills.length,
        closedDaysCount: currentSummaries.length,
        matchedCashDaysCount: matchedDays.length,
        reconciliationScorePercent,
      },
    };

    // Fetch prior snapshot for delta attribution
    const [prevSnapshot] = await db
      .select()
      .from(healthSnapshots)
      .where(
        and(
          eq(healthSnapshots.restaurantId, restaurantId),
          lt(healthSnapshots.snapshotDate, targetDate),
        ),
      )
      .orderBy(desc(healthSnapshots.snapshotDate))
      .limit(1);

    const evaluated = evaluateHealthScore({
      inputs,
      weights: model.weights,
      targets: model.targets,
      previousSnapshotFactorScores: prevSnapshot?.factorScores || null,
      windowDays: model.windowDays,
      modelVersion: model.version,
    });

    // Save snapshot (upsert by restaurant_id and snapshot_date)
    const [snapshot] = await db
      .insert(healthSnapshots)
      .values({
        restaurantId,
        snapshotDate: targetDate,
        modelVersion: model.version,
        overallScore: evaluated.overallScore,
        scoreBand: evaluated.scoreBand,
        confidence: evaluated.confidence,
        factorsUsed: evaluated.factorsUsedCount,
        totalFactors: evaluated.totalFactorsCount,
        factorScores: evaluated.factors,
        reasonsForChange: evaluated.reasonsForChange,
        suggestions: evaluated.suggestions,
      })
      .onConflictDoUpdate({
        target: [healthSnapshots.restaurantId, healthSnapshots.snapshotDate],
        set: {
          modelVersion: model.version,
          overallScore: evaluated.overallScore,
          scoreBand: evaluated.scoreBand,
          confidence: evaluated.confidence,
          factorsUsed: evaluated.factorsUsedCount,
          totalFactors: evaluated.totalFactorsCount,
          factorScores: evaluated.factors,
          reasonsForChange: evaluated.reasonsForChange,
          suggestions: evaluated.suggestions,
        },
      })
      .returning();

    return {
      ...evaluated,
      snapshotId: snapshot!.id,
      snapshotDate: targetDate,
    };
  }

  /**
   * Get the latest health score snapshot, or recompute if none exists.
   */
  static async getLatestScore(
    restaurantId: string,
  ): Promise<HealthScoreResult & { snapshotId: string; snapshotDate: string }> {
    const today = new Date().toISOString().slice(0, 10);
    const [latestSnapshot] = await db
      .select()
      .from(healthSnapshots)
      .where(eq(healthSnapshots.restaurantId, restaurantId))
      .orderBy(desc(healthSnapshots.snapshotDate))
      .limit(1);

    if (latestSnapshot && latestSnapshot.snapshotDate === today) {
      return {
        overallScore: latestSnapshot.overallScore,
        scoreBand: latestSnapshot.scoreBand as any,
        confidence: latestSnapshot.confidence as any,
        factorsUsedCount: latestSnapshot.factorsUsed,
        totalFactorsCount: latestSnapshot.totalFactors,
        factors: latestSnapshot.factorScores,
        reasonsForChange: latestSnapshot.reasonsForChange,
        suggestions: latestSnapshot.suggestions,
        windowDays: 30,
        modelVersion: latestSnapshot.modelVersion,
        isSufficientData: latestSnapshot.overallScore !== null,
        snapshotId: latestSnapshot.id,
        snapshotDate: latestSnapshot.snapshotDate,
      };
    }

    return this.recomputeScore(restaurantId, today);
  }

  /**
   * Get historical snapshots for trend visualization (up to 12).
   */
  static async getHistory(
    restaurantId: string,
    limit: number = 12,
  ): Promise<HealthSnapshotOutput[]> {
    const rows = await db
      .select()
      .from(healthSnapshots)
      .where(eq(healthSnapshots.restaurantId, restaurantId))
      .orderBy(desc(healthSnapshots.snapshotDate))
      .limit(limit);

    // Return chronological
    return rows.reverse().map((r) => ({
      id: r.id,
      restaurantId: r.restaurantId,
      snapshotDate: r.snapshotDate,
      modelVersion: r.modelVersion,
      overallScore: r.overallScore,
      scoreBand: r.scoreBand as any,
      confidence: r.confidence as any,
      factorsUsed: r.factorsUsed,
      totalFactors: r.totalFactors,
      factorScores: r.factorScores,
      reasonsForChange: r.reasonsForChange,
      suggestions: r.suggestions,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
