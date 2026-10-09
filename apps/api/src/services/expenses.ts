import { eq, and, sql, desc, asc, inArray, gte, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  expenseCategories,
  expenses,
  monthlyEvaluations,
  bills,
  purchases,
  stockMovements,
  dailySummaries,
  users,
} from '../db/schema/index.js';
import {
  calculateMonthlyProfitability,
  explainMonthComparison,
  type CreateExpenseCategoryInput,
  type UpdateExpenseCategoryInput,
  type CreateExpenseInput,
  type UpdateExpenseInput,
  type CopyRecurringExpensesInput,
  type SaveMonthlySnapshotInput,
  type ExpenseCategoryOutput,
  type ExpenseOutput,
  type ExpenseCategorySummary,
  type MonthCompletenessChecklist,
  type MonthlyReviewResponse,
  type MonthlyEvaluationSnapshotOutput,
  AppError,
} from '@restaurant-os/shared';

export class ExpensesService {
  // ===================== EXPENSE CATEGORIES =====================

  static async listCategories(restaurantId: string): Promise<ExpenseCategoryOutput[]> {
    const list = await db
      .select()
      .from(expenseCategories)
      .where(
        and(eq(expenseCategories.restaurantId, restaurantId), eq(expenseCategories.active, true)),
      )
      .orderBy(asc(expenseCategories.name));

    return list.map((c) => ({
      id: c.id,
      restaurantId: c.restaurantId,
      name: c.name,
      description: c.description,
      countsAsOperating: c.countsAsOperating,
      active: c.active,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  static async createCategory(
    restaurantId: string,
    input: CreateExpenseCategoryInput,
  ): Promise<ExpenseCategoryOutput> {
    const [existing] = await db
      .select({ id: expenseCategories.id })
      .from(expenseCategories)
      .where(
        and(
          eq(expenseCategories.restaurantId, restaurantId),
          sql`lower(${expenseCategories.name}) = lower(${input.name})`,
        ),
      )
      .limit(1);

    if (existing) {
      throw AppError.badRequest(`Category "${input.name}" already exists`);
    }

    const [created] = await db
      .insert(expenseCategories)
      .values({
        restaurantId,
        name: input.name,
        description: input.description || null,
        countsAsOperating: input.countsAsOperating !== undefined ? input.countsAsOperating : true,
      })
      .returning();

    return {
      id: created!.id,
      restaurantId: created!.restaurantId,
      name: created!.name,
      description: created!.description,
      countsAsOperating: created!.countsAsOperating,
      active: created!.active,
      createdAt: created!.createdAt.toISOString(),
      updatedAt: created!.updatedAt.toISOString(),
    };
  }

  static async updateCategory(
    restaurantId: string,
    categoryId: string,
    input: UpdateExpenseCategoryInput,
  ): Promise<ExpenseCategoryOutput> {
    const [existing] = await db
      .select()
      .from(expenseCategories)
      .where(
        and(eq(expenseCategories.id, categoryId), eq(expenseCategories.restaurantId, restaurantId)),
      )
      .limit(1);

    if (!existing) {
      throw AppError.notFound('Expense category not found');
    }

    const [updated] = await db
      .update(expenseCategories)
      .set({
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        countsAsOperating:
          input.countsAsOperating !== undefined
            ? input.countsAsOperating
            : existing.countsAsOperating,
        active: input.active !== undefined ? input.active : existing.active,
        updatedAt: new Date(),
      })
      .where(eq(expenseCategories.id, categoryId))
      .returning();

    return {
      id: updated!.id,
      restaurantId: updated!.restaurantId,
      name: updated!.name,
      description: updated!.description,
      countsAsOperating: updated!.countsAsOperating,
      active: updated!.active,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  // ===================== EXPENSES CRUD =====================

  static async listExpenses(params: {
    restaurantId: string;
    month?: string; // YYYY-MM
    categoryId?: string;
    paymentSource?: string;
  }): Promise<ExpenseOutput[]> {
    const { restaurantId, month, categoryId, paymentSource } = params;

    const query = db
      .select({
        id: expenses.id,
        restaurantId: expenses.restaurantId,
        categoryId: expenses.categoryId,
        categoryName: expenseCategories.name,
        countsAsOperating: expenseCategories.countsAsOperating,
        amountPaise: expenses.amountPaise,
        expenseDate: expenses.expenseDate,
        month: expenses.month,
        description: expenses.description,
        reference: expenses.reference,
        paymentSource: expenses.paymentSource,
        paidFromTill: expenses.paidFromTill,
        createdBy: expenses.createdBy,
        createdByName: users.name,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(users, eq(expenses.createdBy, users.id))
      .where(
        and(
          eq(expenses.restaurantId, restaurantId),
          month ? eq(expenses.month, month) : undefined,
          categoryId ? eq(expenses.categoryId, categoryId) : undefined,
          paymentSource ? eq(expenses.paymentSource, paymentSource) : undefined,
        ),
      )
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));

    const rows = await query;

    return rows.map((r) => ({
      id: r.id,
      restaurantId: r.restaurantId,
      categoryId: r.categoryId || '',
      categoryName: r.categoryName || 'General',
      countsAsOperating: r.countsAsOperating !== null ? r.countsAsOperating : true,
      amountPaise: r.amountPaise,
      expenseDate: String(r.expenseDate),
      month: r.month,
      description: r.description,
      reference: r.reference,
      paymentSource: r.paymentSource as any,
      paidFromTill: r.paidFromTill,
      createdBy: r.createdBy,
      createdByName: r.createdByName,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  static async createExpense(
    restaurantId: string,
    userId: string,
    input: CreateExpenseInput,
  ): Promise<ExpenseOutput> {
    const month = input.expenseDate.slice(0, 7); // YYYY-MM

    const [category] = await db
      .select()
      .from(expenseCategories)
      .where(
        and(
          eq(expenseCategories.id, input.categoryId),
          eq(expenseCategories.restaurantId, restaurantId),
        ),
      )
      .limit(1);

    if (!category) {
      throw AppError.notFound('Expense category not found');
    }

    const [created] = await db
      .insert(expenses)
      .values({
        restaurantId,
        categoryId: input.categoryId,
        amountPaise: input.amountPaise,
        businessDate: input.expenseDate,
        expenseDate: input.expenseDate as any,
        month,
        description: input.description,
        reference: input.reference || null,
        paymentSource: input.paymentSource,
        paidFromTill: input.paymentSource === 'till',
        createdBy: userId,
      })
      .returning();

    return {
      id: created!.id,
      restaurantId: created!.restaurantId,
      categoryId: category.id,
      categoryName: category.name,
      countsAsOperating: category.countsAsOperating,
      amountPaise: created!.amountPaise,
      expenseDate: String(created!.expenseDate),
      month: created!.month,
      description: created!.description,
      reference: created!.reference,
      paymentSource: created!.paymentSource as any,
      paidFromTill: created!.paidFromTill,
      createdBy: userId,
      createdAt: created!.createdAt.toISOString(),
      updatedAt: created!.updatedAt.toISOString(),
    };
  }

  static async updateExpense(
    restaurantId: string,
    expenseId: string,
    userId: string,
    input: UpdateExpenseInput,
  ): Promise<ExpenseOutput> {
    const [existing] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.restaurantId, restaurantId)))
      .limit(1);

    if (!existing) {
      throw AppError.notFound('Expense record not found');
    }

    const newDate = input.expenseDate ?? String(existing.expenseDate);
    const newMonth = newDate.slice(0, 7);

    const [updated] = await db
      .update(expenses)
      .set({
        categoryId: input.categoryId ?? existing.categoryId,
        amountPaise: input.amountPaise ?? existing.amountPaise,
        expenseDate: newDate as any,
        businessDate: newDate,
        month: newMonth,
        description: input.description ?? existing.description,
        reference: input.reference !== undefined ? input.reference : existing.reference,
        paymentSource: input.paymentSource ?? existing.paymentSource,
        paidFromTill: (input.paymentSource ?? existing.paymentSource) === 'till',
        edited: true,
        lastEditReason: input.editReason,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId))
      .returning();

    const [cat] = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, updated!.categoryId!))
      .limit(1);

    return {
      id: updated!.id,
      restaurantId: updated!.restaurantId,
      categoryId: cat?.id || '',
      categoryName: cat?.name || 'General',
      countsAsOperating: cat?.countsAsOperating ?? true,
      amountPaise: updated!.amountPaise,
      expenseDate: String(updated!.expenseDate),
      month: updated!.month,
      description: updated!.description,
      reference: updated!.reference,
      paymentSource: updated!.paymentSource as any,
      paidFromTill: updated!.paidFromTill,
      createdBy: updated!.createdBy,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  static async deleteExpense(
    restaurantId: string,
    expenseId: string,
  ): Promise<{ success: boolean; deletedExpense: any }> {
    const [existing] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.restaurantId, restaurantId)))
      .limit(1);

    if (!existing) {
      throw AppError.notFound('Expense record not found');
    }

    await db.delete(expenses).where(eq(expenses.id, expenseId));
    return { success: true, deletedExpense: existing };
  }

  /**
   * "Copy last month's recurring" helper:
   * Duplicates selected items from source month to target month on targetDate.
   */
  static async copyRecurringExpenses(
    restaurantId: string,
    userId: string,
    input: CopyRecurringExpensesInput,
  ): Promise<{ copiedCount: number; newExpenses: ExpenseOutput[] }> {
    const sourceExpenses = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.restaurantId, restaurantId), inArray(expenses.id, input.expenseIds)));

    const createdList: ExpenseOutput[] = [];

    for (const item of sourceExpenses) {
      const created = await this.createExpense(restaurantId, userId, {
        categoryId: item.categoryId!,
        amountPaise: item.amountPaise,
        expenseDate: input.targetDate,
        description: item.description,
        reference: item.reference,
        paymentSource: item.paymentSource as any,
      });
      createdList.push(created);
    }

    return {
      copiedCount: createdList.length,
      newExpenses: createdList,
    };
  }

  // ===================== MONTH EVALUATION / REVIEW =====================

  static async getMonthlyReview(
    restaurantId: string,
    monthStr: string, // YYYY-MM
  ): Promise<MonthlyReviewResponse> {
    const [yearStr, mNumStr] = monthStr.split('-');
    const year = parseInt(yearStr!, 10);
    const monthIndex = parseInt(mNumStr!, 10) - 1; // 0-indexed

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const startDate = `${monthStr}-01`;
    const endDate = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

    // 1. Data Completeness Checklist
    // Closed days count from daily_summaries
    const closedSummaries = await db
      .select()
      .from(dailySummaries)
      .where(
        and(
          eq(dailySummaries.restaurantId, restaurantId),
          gte(dailySummaries.businessDate, startDate),
          lte(dailySummaries.businessDate, endDate),
          eq(dailySummaries.status, 'closed'),
        ),
      );

    const closedDaysCount = closedSummaries.length;
    const unclosedDaysCount = Math.max(0, daysInMonth - closedDaysCount);

    // Check key expense categories entered (Rent, Salaries, Utilities)
    const monthExpenses = await db
      .select({
        id: expenses.id,
        amountPaise: expenses.amountPaise,
        categoryId: expenses.categoryId,
        categoryName: expenseCategories.name,
        countsAsOperating: expenseCategories.countsAsOperating,
        paymentSource: expenses.paymentSource,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(eq(expenses.restaurantId, restaurantId), eq(expenses.month, monthStr)));

    const hasRentExpense = monthExpenses.some((e) =>
      e.categoryName?.toLowerCase().includes('rent'),
    );
    const hasSalariesExpense = monthExpenses.some((e) =>
      e.categoryName?.toLowerCase().includes('salar'),
    );
    const hasUtilitiesExpense = monthExpenses.some(
      (e) =>
        e.categoryName?.toLowerCase().includes('electric') ||
        e.categoryName?.toLowerCase().includes('gas') ||
        e.categoryName?.toLowerCase().includes('water'),
    );

    // Check boundary stock counts: opening count near start, closing count near end
    const stockCounts = await db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.restaurantId, restaurantId),
          eq(stockMovements.type, 'stock_count'),
          gte(stockMovements.movementDate, startDate as any),
          lte(stockMovements.movementDate, endDate as any),
        ),
      );

    const hasOpeningStockCount = stockCounts.some(
      (s) => String(s.movementDate) <= `${monthStr}-05`,
    );
    const hasClosingStockCount = stockCounts.some(
      (s) => String(s.movementDate) >= `${monthStr}-${daysInMonth - 4}`,
    );

    const missingItems: string[] = [];
    if (closedDaysCount < daysInMonth)
      missingItems.push(`${unclosedDaysCount} unclosed business days`);
    if (!hasRentExpense) missingItems.push('Rent expense not logged');
    if (!hasSalariesExpense) missingItems.push('Salaries / wages expense not logged');
    if (!hasUtilitiesExpense) missingItems.push('Electricity / Gas utility bill not logged');
    if (!hasClosingStockCount)
      missingItems.push('Closing physical stock count missing (using purchase costing method)');

    let completenessScore = 0;
    if (daysInMonth > 0) completenessScore += (closedDaysCount / daysInMonth) * 40;
    if (hasRentExpense) completenessScore += 20;
    if (hasSalariesExpense) completenessScore += 20;
    if (hasUtilitiesExpense) completenessScore += 10;
    if (hasClosingStockCount) completenessScore += 10;
    const completenessPercent = Math.min(100, Math.round(completenessScore));

    const completeness: MonthCompletenessChecklist = {
      daysInMonth,
      closedDaysCount,
      unclosedDaysCount,
      isAllDaysClosed: closedDaysCount >= daysInMonth,
      hasRentExpense,
      hasSalariesExpense,
      hasUtilitiesExpense,
      hasOpeningStockCount,
      hasClosingStockCount,
      completenessPercent,
      missingItems,
    };

    // 2. Revenue (Net sales excluding GST/taxes, net of discounts and refunds)
    const monthBills = await db
      .select({
        subtotalPaise: bills.subtotalPaise,
        discountPaise: bills.discountPaise,
        refundsPaise: sql<number>`coalesce((select sum(amount_paise) from refunds where refunds.bill_id = bills.id), 0)`,
        status: bills.status,
      })
      .from(bills)
      .where(
        and(
          eq(bills.restaurantId, restaurantId),
          gte(bills.businessDate, startDate),
          lte(bills.businessDate, endDate),
          inArray(bills.status, ['paid', 'partially_paid']),
        ),
      );

    let revenuePaise = 0;
    for (const b of monthBills) {
      const netForBill = Math.max(0, b.subtotalPaise - b.discountPaise - b.refundsPaise);
      revenuePaise += netForBill;
    }

    // 3. Purchases in month
    const monthPurchasesList = await db
      .select({ totalPaise: purchases.totalPaise })
      .from(purchases)
      .where(
        and(
          eq(purchases.restaurantId, restaurantId),
          gte(purchases.purchaseDate, startDate as any),
          lte(purchases.purchaseDate, endDate as any),
        ),
      );

    const monthPurchasesPaise = monthPurchasesList.reduce((sum, p) => sum + p.totalPaise, 0);

    // 4. Waste cost from waste movements
    const wasteList = await db
      .select({
        quantity: stockMovements.quantity,
        costSnapshot: stockMovements.costSnapshotPaisePerUnit,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.restaurantId, restaurantId),
          eq(stockMovements.type, 'waste'),
          gte(stockMovements.movementDate, startDate as any),
          lte(stockMovements.movementDate, endDate as any),
        ),
      );

    const wasteCostPaise = wasteList.reduce((sum, w) => {
      const qty = Math.abs(Number(w.quantity));
      return sum + Math.round(qty * w.costSnapshot);
    }, 0);

    // 5. Operating Expenses
    const operatingExpensesList = monthExpenses.filter((e) => e.countsAsOperating);
    const operatingExpensesPaise = operatingExpensesList.reduce((sum, e) => sum + e.amountPaise, 0);

    // 6. Profitability Math
    const profitability = calculateMonthlyProfitability({
      netSalesPaise: revenuePaise,
      operatingExpensesPaise,
      monthPurchasesPaise,
      hasOpeningAndClosingCounts: hasOpeningStockCount && hasClosingStockCount,
      wasteCostPaise,
    });

    // 7. Payment Method Mix from payments
    const paymentsSummary = await db
      .select({
        cashPaise: sql<number>`coalesce(sum(case when method = 'cash' then amount_paise else 0 end), 0)`,
        upiPaise: sql<number>`coalesce(sum(case when method = 'upi' then amount_paise else 0 end), 0)`,
        cardPaise: sql<number>`coalesce(sum(case when method = 'card' then amount_paise else 0 end), 0)`,
      })
      .from(bills)
      .innerJoin(sql`payments`, sql`payments.bill_id = bills.id`)
      .where(
        and(
          eq(bills.restaurantId, restaurantId),
          gte(bills.businessDate, startDate),
          lte(bills.businessDate, endDate),
        ),
      );

    const paymentMethodMix = {
      cashPaise: Number(paymentsSummary[0]?.cashPaise || 0),
      upiPaise: Number(paymentsSummary[0]?.upiPaise || 0),
      cardPaise: Number(paymentsSummary[0]?.cardPaise || 0),
    };

    // 8. Previous Month Comparison
    const prevMonthDate = new Date(year, monthIndex - 1, 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const prevDays = new Date(
      prevMonthDate.getFullYear(),
      prevMonthDate.getMonth() + 1,
      0,
    ).getDate();
    const prevStart = `${prevMonthStr}-01`;
    const prevEnd = `${prevMonthStr}-${String(prevDays).padStart(2, '0')}`;

    // Get previous month bills
    const prevBills = await db
      .select({
        subtotalPaise: bills.subtotalPaise,
        discountPaise: bills.discountPaise,
      })
      .from(bills)
      .where(
        and(
          eq(bills.restaurantId, restaurantId),
          gte(bills.businessDate, prevStart),
          lte(bills.businessDate, prevEnd),
          inArray(bills.status, ['paid', 'partially_paid']),
        ),
      );

    const prevRevenuePaise = prevBills.reduce(
      (s, b) => s + Math.max(0, b.subtotalPaise - b.discountPaise),
      0,
    );

    const prevPurchases = await db
      .select({ totalPaise: purchases.totalPaise })
      .from(purchases)
      .where(
        and(
          eq(purchases.restaurantId, restaurantId),
          gte(purchases.purchaseDate, prevStart as any),
          lte(purchases.purchaseDate, prevEnd as any),
        ),
      );
    const prevSuppliesCostPaise = prevPurchases.reduce((s, p) => s + p.totalPaise, 0);

    const prevExp = await db
      .select({ amountPaise: expenses.amountPaise })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(
        and(
          eq(expenses.restaurantId, restaurantId),
          eq(expenses.month, prevMonthStr),
          eq(expenseCategories.countsAsOperating, true),
        ),
      );
    const prevOperatingExpensesPaise = prevExp.reduce((s, e) => s + e.amountPaise, 0);

    const prevProfitPaise = prevRevenuePaise - prevSuppliesCostPaise - prevOperatingExpensesPaise;
    const prevMarginPercent =
      prevRevenuePaise > 0 ? Number(((prevProfitPaise / prevRevenuePaise) * 100).toFixed(1)) : null;
    const prevSuppliesPercent =
      prevRevenuePaise > 0
        ? Number(((prevSuppliesCostPaise / prevRevenuePaise) * 100).toFixed(1))
        : null;

    const explanation = explainMonthComparison({
      currentProfitPaise: profitability.estimatedProfitPaise,
      currentMarginPercent: profitability.profitMarginPercent,
      currentSuppliesPercent: profitability.suppliesPercentOfRevenue,
      currentExpensesPercent: profitability.expensesPercentOfRevenue,
      prevProfitPaise,
      prevMarginPercent,
      prevSuppliesPercent,
      prevExpensesPercent:
        prevRevenuePaise > 0
          ? Number(((prevOperatingExpensesPaise / prevRevenuePaise) * 100).toFixed(1))
          : null,
    });

    const previousMonthComparison =
      prevRevenuePaise > 0
        ? {
            prevMonth: prevMonthStr,
            prevRevenuePaise,
            prevSuppliesCostPaise,
            prevOperatingExpensesPaise,
            prevProfitPaise,
            prevMarginPercent,
            explanation,
          }
        : null;

    // 9. Category Totals Breakdown
    const categories = await this.listCategories(restaurantId);
    const categoryTotals: ExpenseCategorySummary[] = categories.map((cat) => {
      const curSum = monthExpenses
        .filter((e) => e.categoryId === cat.id)
        .reduce((sum, e) => sum + e.amountPaise, 0);
      const curCount = monthExpenses.filter((e) => e.categoryId === cat.id).length;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        countsAsOperating: cat.countsAsOperating,
        currentMonthPaise: curSum,
        previousMonthPaise: 0,
        changePercent: null,
        count: curCount,
      };
    });

    // Check if saved snapshot exists
    const [savedSnap] = await db
      .select({ createdAt: monthlyEvaluations.createdAt })
      .from(monthlyEvaluations)
      .where(
        and(
          eq(monthlyEvaluations.restaurantId, restaurantId),
          eq(monthlyEvaluations.month, monthStr),
        ),
      )
      .orderBy(desc(monthlyEvaluations.version))
      .limit(1);

    const isCurrentMonth = monthStr === new Date().toISOString().slice(0, 7);

    return {
      month: monthStr,
      isCurrentMonth,
      completeness,
      revenuePaise: profitability.revenuePaise,
      suppliesCostPaise: profitability.suppliesCostPaise,
      suppliesMethod: profitability.suppliesMethod,
      suppliesMethodReason: profitability.suppliesMethodReason,
      wasteCostPaise: profitability.wasteCostPaise,
      operatingExpensesPaise: profitability.operatingExpensesPaise,
      estimatedProfitPaise: profitability.estimatedProfitPaise,
      profitMarginPercent: profitability.profitMarginPercent,
      suppliesPercentOfRevenue: profitability.suppliesPercentOfRevenue,
      expensesPercentOfRevenue: profitability.expensesPercentOfRevenue,
      paymentMethodMix,
      previousMonthComparison,
      categoryTotals,
      savedSnapshotAt: savedSnap?.createdAt ? savedSnap.createdAt.toISOString() : null,
    };
  }

  // ===================== SNAPSHOTS =====================

  static async saveMonthlySnapshot(
    restaurantId: string,
    userId: string,
    input: SaveMonthlySnapshotInput,
  ): Promise<MonthlyEvaluationSnapshotOutput> {
    const review = await this.getMonthlyReview(restaurantId, input.month);

    // Get max version for this month
    const existingSnaps = await db
      .select({ version: monthlyEvaluations.version })
      .from(monthlyEvaluations)
      .where(
        and(
          eq(monthlyEvaluations.restaurantId, restaurantId),
          eq(monthlyEvaluations.month, input.month),
        ),
      )
      .orderBy(desc(monthlyEvaluations.version))
      .limit(1);

    const nextVersion = (existingSnaps[0]?.version || 0) + 1;

    const [saved] = await db
      .insert(monthlyEvaluations)
      .values({
        restaurantId,
        month: input.month,
        version: nextVersion,
        revenuePaise: review.revenuePaise,
        suppliesCostPaise: review.suppliesCostPaise,
        suppliesMethod: review.suppliesMethod,
        operatingExpensesPaise: review.operatingExpensesPaise,
        estimatedProfitPaise: review.estimatedProfitPaise,
        profitMarginPercent:
          review.profitMarginPercent !== null ? String(review.profitMarginPercent) : null,
        completenessPercent: review.completeness.completenessPercent,
        inputs: {
          daysInMonth: review.completeness.daysInMonth,
          closedDaysCount: review.completeness.closedDaysCount,
          wasteCostPaise: review.wasteCostPaise,
          paymentMethodMix: review.paymentMethodMix,
        },
        outputs: {
          profitMarginPercent: review.profitMarginPercent,
          suppliesPercentOfRevenue: review.suppliesPercentOfRevenue,
          expensesPercentOfRevenue: review.expensesPercentOfRevenue,
        },
        note: input.note || null,
        createdBy: userId,
      })
      .returning();

    return {
      id: saved!.id,
      restaurantId: saved!.restaurantId,
      month: saved!.month,
      version: saved!.version,
      revenuePaise: saved!.revenuePaise,
      suppliesCostPaise: saved!.suppliesCostPaise,
      suppliesMethod: saved!.suppliesMethod,
      operatingExpensesPaise: saved!.operatingExpensesPaise,
      estimatedProfitPaise: saved!.estimatedProfitPaise,
      profitMarginPercent: saved!.profitMarginPercent ? Number(saved!.profitMarginPercent) : null,
      completenessPercent: saved!.completenessPercent,
      inputs: saved!.inputs as any,
      outputs: saved!.outputs as any,
      note: saved!.note,
      createdBy: saved!.createdBy,
      createdAt: saved!.createdAt.toISOString(),
    };
  }

  static async listSnapshots(restaurantId: string): Promise<MonthlyEvaluationSnapshotOutput[]> {
    const list = await db
      .select({
        id: monthlyEvaluations.id,
        restaurantId: monthlyEvaluations.restaurantId,
        month: monthlyEvaluations.month,
        version: monthlyEvaluations.version,
        revenuePaise: monthlyEvaluations.revenuePaise,
        suppliesCostPaise: monthlyEvaluations.suppliesCostPaise,
        suppliesMethod: monthlyEvaluations.suppliesMethod,
        operatingExpensesPaise: monthlyEvaluations.operatingExpensesPaise,
        estimatedProfitPaise: monthlyEvaluations.estimatedProfitPaise,
        profitMarginPercent: monthlyEvaluations.profitMarginPercent,
        completenessPercent: monthlyEvaluations.completenessPercent,
        inputs: monthlyEvaluations.inputs,
        outputs: monthlyEvaluations.outputs,
        note: monthlyEvaluations.note,
        createdBy: monthlyEvaluations.createdBy,
        createdByName: users.name,
        createdAt: monthlyEvaluations.createdAt,
      })
      .from(monthlyEvaluations)
      .leftJoin(users, eq(monthlyEvaluations.createdBy, users.id))
      .where(eq(monthlyEvaluations.restaurantId, restaurantId))
      .orderBy(desc(monthlyEvaluations.month), desc(monthlyEvaluations.version));

    return list.map((s) => ({
      id: s.id,
      restaurantId: s.restaurantId,
      month: s.month,
      version: s.version,
      revenuePaise: s.revenuePaise,
      suppliesCostPaise: s.suppliesCostPaise,
      suppliesMethod: s.suppliesMethod,
      operatingExpensesPaise: s.operatingExpensesPaise,
      estimatedProfitPaise: s.estimatedProfitPaise,
      profitMarginPercent: s.profitMarginPercent ? Number(s.profitMarginPercent) : null,
      completenessPercent: s.completenessPercent,
      inputs: s.inputs as any,
      outputs: s.outputs as any,
      note: s.note,
      createdBy: s.createdBy,
      createdByName: s.createdByName,
      createdAt: s.createdAt.toISOString(),
    }));
  }
}
