/**
 * Inventory Core Math & Costing Engine.
 *
 * All money amounts are integer paise (1 INR = 100 paise).
 * Quantities are numeric up to 3 decimal places (e.g. 2.500 kg).
 */

export interface CostCalculationParams {
  currentStock: number;
  currentAvgCostPaisePerUnit: number;
  purchaseQuantity: number;
  purchaseTotalPaise: number;
}

/**
 * Calculates new weighted-average cost after a purchase:
 * New Avg Cost = (Current Stock * Current Avg Cost + Purchase Total) / (Current Stock + Purchase Quantity)
 * If current stock is <= 0 or empty, avg cost equals purchase unit price.
 */
export function calculateWeightedAverageCostPaise(params: CostCalculationParams): number {
  const { currentStock, currentAvgCostPaisePerUnit, purchaseQuantity, purchaseTotalPaise } = params;

  if (purchaseQuantity <= 0) {
    return currentAvgCostPaisePerUnit;
  }

  // If previous stock is non-positive, newly purchased stock sets the cost basis
  if (currentStock <= 0) {
    return Math.round(purchaseTotalPaise / purchaseQuantity);
  }

  const existingTotalValuePaise = currentStock * currentAvgCostPaisePerUnit;
  const newTotalValuePaise = existingTotalValuePaise + purchaseTotalPaise;
  const newTotalStock = currentStock + purchaseQuantity;

  return Math.round(newTotalValuePaise / newTotalStock);
}

/**
 * Converts line quantity and unit price / line total:
 * When given qty and totalPaise -> unitPricePaise = round(totalPaise / qty)
 * When given qty and unitPricePaise -> totalPaise = round(qty * unitPricePaise)
 */
export function calculateLinePricing(params: {
  quantity: number;
  unitPricePaise?: number;
  lineTotalPaise?: number;
}): { unitPricePaise: number; lineTotalPaise: number } {
  const { quantity, unitPricePaise, lineTotalPaise } = params;

  if (quantity <= 0) {
    return { unitPricePaise: 0, lineTotalPaise: 0 };
  }

  if (lineTotalPaise !== undefined && lineTotalPaise !== null) {
    const computedUnitPrice = Math.round(lineTotalPaise / quantity);
    return { unitPricePaise: computedUnitPrice, lineTotalPaise };
  }

  if (unitPricePaise !== undefined && unitPricePaise !== null) {
    const computedTotal = Math.round(quantity * unitPricePaise);
    return { unitPricePaise, lineTotalPaise: computedTotal };
  }

  return { unitPricePaise: 0, lineTotalPaise: 0 };
}

/**
 * Calculates waste cost from quantity and average cost:
 * wasteCostPaise = round(wasteQuantity * avgCostPaisePerUnit)
 */
export function calculateWasteCostPaise(
  wasteQuantity: number,
  avgCostPaisePerUnit: number,
): number {
  if (wasteQuantity <= 0 || avgCostPaisePerUnit <= 0) return 0;
  return Math.round(wasteQuantity * avgCostPaisePerUnit);
}

/**
 * Calculates stock count variance and implied usage:
 * Implied Usage = (previousStock + periodPurchases - waste - periodAdjustments) - countedStock
 * Variance = countedStock - previousExpectedStock
 */
export function calculateStockCountVariance(params: {
  previousStock: number;
  countedStock: number;
}): { variance: number; isShortage: boolean; isSurplus: boolean } {
  const { previousStock, countedStock } = params;
  const variance = Number((countedStock - previousStock).toFixed(3));
  return {
    variance,
    isShortage: variance < 0,
    isSurplus: variance > 0,
  };
}
