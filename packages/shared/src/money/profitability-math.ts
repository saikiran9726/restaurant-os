/**
 * Monthly Profitability & Financial Math Engine.
 *
 * All money amounts are stored and calculated in integer paise (1 INR = 100 paise).
 * Estimates are clearly designated for management guidance, not audited tax advice.
 */

export interface CostOfSuppliesParams {
  method: 'consumption' | 'purchases';
  openingStockValuePaise?: number;
  monthPurchasesPaise: number;
  closingStockValuePaise?: number;
  hasOpeningAndClosingCounts: boolean;
}

export interface ProfitabilityCalculationInput {
  netSalesPaise: number; // Net sales excluding GST/taxes, net of discounts & refunds
  operatingExpensesPaise: number; // Sum of operating expenses
  monthPurchasesPaise: number;
  openingStockValuePaise?: number;
  closingStockValuePaise?: number;
  hasOpeningAndClosingCounts: boolean;
  wasteCostPaise?: number;
}

export interface ProfitabilityCalculationResult {
  revenuePaise: number;
  suppliesCostPaise: number;
  suppliesMethod: 'consumption' | 'purchases';
  suppliesMethodReason: string;
  wasteCostPaise: number;
  operatingExpensesPaise: number;
  estimatedProfitPaise: number;
  profitMarginPercent: number | null; // null if revenue <= 0
  suppliesPercentOfRevenue: number | null;
  expensesPercentOfRevenue: number | null;
}

/**
 * Calculates Cost of Supplies:
 * If both opening and closing stock count values exist -> Consumption method:
 *   Cost = Opening Stock Value + Purchases - Closing Stock Value
 * Otherwise -> Purchases method:
 *   Cost = Total Purchases in the month
 */
export function calculateCostOfSupplies(params: CostOfSuppliesParams): {
  suppliesCostPaise: number;
  method: 'consumption' | 'purchases';
  reason: string;
} {
  const {
    openingStockValuePaise = 0,
    monthPurchasesPaise,
    closingStockValuePaise = 0,
    hasOpeningAndClosingCounts,
  } = params;

  if (hasOpeningAndClosingCounts) {
    const consumptionCost = Math.max(
      0,
      openingStockValuePaise + monthPurchasesPaise - closingStockValuePaise,
    );
    return {
      suppliesCostPaise: consumptionCost,
      method: 'consumption',
      reason:
        'Consumption-based: Derived using opening stock value + purchases − closing stock value from verified monthly physical counts.',
    };
  }

  return {
    suppliesCostPaise: monthPurchasesPaise,
    method: 'purchases',
    reason:
      'Purchase-based: Derived directly from total verified supplier purchase invoices logged in the month (boundary stock counts were not both recorded).',
  };
}

/**
 * Computes estimated operating profit and key financial ratios:
 * Estimated Operating Profit = Revenue - Cost of Supplies - Operating Expenses
 * Margin % = (Estimated Operating Profit / Revenue) * 100
 */
export function calculateMonthlyProfitability(
  input: ProfitabilityCalculationInput,
): ProfitabilityCalculationResult {
  const {
    netSalesPaise,
    operatingExpensesPaise,
    monthPurchasesPaise,
    openingStockValuePaise,
    closingStockValuePaise,
    hasOpeningAndClosingCounts,
    wasteCostPaise = 0,
  } = input;

  const suppliesCalc = calculateCostOfSupplies({
    method: hasOpeningAndClosingCounts ? 'consumption' : 'purchases',
    openingStockValuePaise,
    monthPurchasesPaise,
    closingStockValuePaise,
    hasOpeningAndClosingCounts,
  });

  const revenuePaise = Math.max(0, netSalesPaise);
  const suppliesCostPaise = suppliesCalc.suppliesCostPaise;
  const estimatedProfitPaise = revenuePaise - suppliesCostPaise - operatingExpensesPaise;

  let profitMarginPercent: number | null = null;
  let suppliesPercentOfRevenue: number | null = null;
  let expensesPercentOfRevenue: number | null = null;

  if (revenuePaise > 0) {
    profitMarginPercent = Number(((estimatedProfitPaise / revenuePaise) * 100).toFixed(1));
    suppliesPercentOfRevenue = Number(((suppliesCostPaise / revenuePaise) * 100).toFixed(1));
    expensesPercentOfRevenue = Number(((operatingExpensesPaise / revenuePaise) * 100).toFixed(1));
  }

  return {
    revenuePaise,
    suppliesCostPaise,
    suppliesMethod: suppliesCalc.method,
    suppliesMethodReason: suppliesCalc.reason,
    wasteCostPaise,
    operatingExpensesPaise,
    estimatedProfitPaise,
    profitMarginPercent,
    suppliesPercentOfRevenue,
    expensesPercentOfRevenue,
  };
}

/**
 * Generates plain-English deterministic explanation comparing current month to previous month.
 */
export function explainMonthComparison(params: {
  currentProfitPaise: number;
  currentMarginPercent: number | null;
  currentSuppliesPercent: number | null;
  currentExpensesPercent: number | null;
  prevProfitPaise: number;
  prevMarginPercent: number | null;
  prevSuppliesPercent: number | null;
  prevExpensesPercent: number | null;
}): string {
  const { currentMarginPercent, currentSuppliesPercent, prevMarginPercent, prevSuppliesPercent } =
    params;

  if (currentMarginPercent === null || prevMarginPercent === null) {
    return 'Insufficient historical revenue data to generate a meaningful period comparison.';
  }

  const marginDiff = Number((currentMarginPercent - prevMarginPercent).toFixed(1));
  const absDiff = Math.abs(marginDiff);

  if (marginDiff > 0) {
    if (
      currentSuppliesPercent !== null &&
      prevSuppliesPercent !== null &&
      currentSuppliesPercent < prevSuppliesPercent
    ) {
      return `Operating margin expanded by ${absDiff} percentage points: supply costs improved from ${prevSuppliesPercent}% to ${currentSuppliesPercent}% of revenue.`;
    }
    return `Operating margin expanded by ${absDiff} percentage points compared to last month.`;
  } else if (marginDiff < 0) {
    if (
      currentSuppliesPercent !== null &&
      prevSuppliesPercent !== null &&
      currentSuppliesPercent > prevSuppliesPercent
    ) {
      return `Margin fell ${absDiff} points: supply cost rose from ${prevSuppliesPercent}% to ${currentSuppliesPercent}% of revenue.`;
    }
    return `Margin declined by ${absDiff} percentage points compared to last month.`;
  }

  return 'Operating profit margin held steady compared to the previous month.';
}
