import {
  type HealthFactorId,
  type HealthModelWeights,
  type HealthModelTargets,
  type HealthFactorEvaluation,
  type HealthScoreReasonForChange,
  type HealthImprovementSuggestion,
  type HealthScoreResult,
  type HealthScoreBand,
  type HealthConfidence,
  DEFAULT_HEALTH_WEIGHTS,
  DEFAULT_HEALTH_TARGETS,
} from './health-types.js';

export interface RawHealthInputs {
  sales: {
    hasData: boolean;
    currentWindowNetRevenuePaise: number;
    previousWindowNetRevenuePaise: number;
    daysWithSalesCount: number;
  };
  profitability: {
    hasData: boolean;
    revenuePaise: number;
    operatingExpensesPaise: number;
    suppliesCostPaise: number;
    estimatedMarginPercent: number | null;
  };
  retention: {
    hasData: boolean;
    activeCustomersCount: number;
    repeatCustomersCount: number; // 2+ visits
    repeatRatePercent: number | null;
  };
  foodCost: {
    hasData: boolean;
    revenuePaise: number;
    suppliesCostPaise: number;
    suppliesPercentOfRevenue: number | null;
  };
  inventory: {
    hasData: boolean;
    totalActiveItems: number;
    lowOrOutOfStockItems: number;
    inStockPercent: number | null;
    avgAuditVariancePercent: number;
  };
  waste: {
    hasData: boolean;
    wasteCostPaise: number;
    suppliesCostPaise: number;
    wastePercentOfSupplies: number | null;
  };
  kitchen: {
    hasData: boolean;
    totalKotsCount: number;
    onTimeKotsCount: number;
    onTimePercent: number | null;
  };
  payment: {
    hasData: boolean;
    totalBillsCount: number;
    cleanBillsCount: number; // No unresolved pending UPI
    closedDaysCount: number;
    matchedCashDaysCount: number; // |cash mismatch| <= Rs 50
    reconciliationScorePercent: number | null;
  };
}

/**
 * Helper to clamp values strictly between min and max.
 */
export function clamp(val: number, min: number, max: number): number {
  if (isNaN(val)) return min;
  return Math.min(Math.max(val, min), max);
}

/**
 * 1. Sales Performance Sub-Score:
 * 100 at >= +10% growth vs prior window
 * 50 at flat (0% growth)
 * 0 at <= -20% growth
 * Linear interpolation in between.
 */
export function computeSalesScore(growthPercent: number | null, targetGrowth: number = 10): number {
  if (growthPercent === null) return 0;
  if (growthPercent >= targetGrowth) return 100;
  if (growthPercent <= -20) return 0;

  if (growthPercent >= 0) {
    // 0% -> 50, targetGrowth% (e.g. 10%) -> 100
    const factor = growthPercent / targetGrowth;
    return clamp(Math.round(50 + factor * 50), 0, 100);
  } else {
    // -20% -> 0, 0% -> 50
    // growthPercent is between -20 and 0
    const factor = (growthPercent - -20) / 20; // 0 at -20, 1 at 0
    return clamp(Math.round(factor * 50), 0, 100);
  }
}

/**
 * 2. Profitability Sub-Score:
 * 100 at >= targetMarginPercent (default 20%)
 * 0 at <= 0% margin
 * Linear in between: (margin / target) * 100
 */
export function computeProfitabilityScore(
  marginPercent: number | null,
  targetMargin: number = 20,
): number {
  if (marginPercent === null || targetMargin <= 0) return 0;
  if (marginPercent <= 0) return 0;
  if (marginPercent >= targetMargin) return 100;
  return clamp(Math.round((marginPercent / targetMargin) * 100), 0, 100);
}

/**
 * 3. Customer Retention Sub-Score:
 * 100 at >= repeatRateTarget (default 40%)
 * Linear from 0% repeat to target: (repeatRate / target) * 100
 */
export function computeRetentionScore(
  repeatRatePercent: number | null,
  targetRepeatRate: number = 40,
): number {
  if (repeatRatePercent === null || targetRepeatRate <= 0) return 0;
  if (repeatRatePercent >= targetRepeatRate) return 100;
  if (repeatRatePercent <= 0) return 0;
  return clamp(Math.round((repeatRatePercent / targetRepeatRate) * 100), 0, 100);
}

/**
 * 4. Food / Supply Cost Sub-Score:
 * Lower is better.
 * 100 at <= targetFoodCostPercent (default 32%)
 * 0 at >= targetFoodCostPercent + 15% (e.g. 47%)
 * Linear in between: 100 - ((cost - target) / 15) * 100
 */
export function computeFoodCostScore(
  foodCostPercent: number | null,
  targetFoodCost: number = 32,
): number {
  if (foodCostPercent === null) return 0;
  if (foodCostPercent <= targetFoodCost) return 100;
  const maxTolerance = 15;
  if (foodCostPercent >= targetFoodCost + maxTolerance) return 0;

  const excess = foodCostPercent - targetFoodCost;
  const score = 100 - (excess / maxTolerance) * 100;
  return clamp(Math.round(score), 0, 100);
}

/**
 * 5. Inventory Efficiency Sub-Score:
 * Based on in-stock percentage (items not low or zero) vs target (default 90%).
 * 100 at >= 90% in-stock.
 * Degrades linearly to 0 at <= 50% in-stock.
 * Variance penalty applied if average count variance > 5%.
 */
export function computeInventoryScore(
  inStockPercent: number | null,
  targetInStock: number = 90,
  auditVariancePercent: number = 0,
): number {
  if (inStockPercent === null) return 0;
  let baseScore = 0;
  if (inStockPercent >= targetInStock) {
    baseScore = 100;
  } else if (inStockPercent <= 50) {
    baseScore = 0;
  } else {
    baseScore = ((inStockPercent - 50) / (targetInStock - 50)) * 100;
  }

  // Deduct 2 points for each percentage point of stock count variance over 5%
  let penalty = 0;
  if (auditVariancePercent > 5) {
    penalty = (auditVariancePercent - 5) * 2;
  }

  return clamp(Math.round(baseScore - penalty), 0, 100);
}

/**
 * 6. Waste Management Sub-Score:
 * Lower waste is better.
 * 100 at <= targetWastePercent (default 3%)
 * 0 at >= targetWastePercent + 7% (e.g. 10%)
 * Linear in between.
 */
export function computeWasteScore(wastePercent: number | null, targetWaste: number = 3): number {
  if (wastePercent === null) return 0;
  if (wastePercent <= targetWaste) return 100;
  const maxTolerance = 7;
  if (wastePercent >= targetWaste + maxTolerance) return 0;

  const excess = wastePercent - targetWaste;
  const score = 100 - (excess / maxTolerance) * 100;
  return clamp(Math.round(score), 0, 100);
}

/**
 * 7. Kitchen Efficiency Sub-Score:
 * Share of KOTs ready within warn threshold vs target (default 85%).
 * 100 at >= 85% on-time.
 * Degrades linearly to 0 at <= 50% on-time.
 */
export function computeKitchenScore(
  onTimePercent: number | null,
  targetOnTime: number = 85,
): number {
  if (onTimePercent === null) return 0;
  if (onTimePercent >= targetOnTime) return 100;
  if (onTimePercent <= 50) return 0;
  return clamp(Math.round(((onTimePercent - 50) / (targetOnTime - 50)) * 100), 0, 100);
}

/**
 * 8. Payment Reconciliation Sub-Score:
 * Share of bills without pending/unresolved UPI + matched cash days vs target (default 95%).
 * 100 at >= 95%.
 * Degrades linearly to 0 at <= 75%.
 */
export function computePaymentScore(
  reconciliationPercent: number | null,
  targetReconciliation: number = 95,
): number {
  if (reconciliationPercent === null) return 0;
  if (reconciliationPercent >= targetReconciliation) return 100;
  if (reconciliationPercent <= 75) return 0;
  return clamp(
    Math.round(((reconciliationPercent - 75) / (targetReconciliation - 75)) * 100),
    0,
    100,
  );
}

/**
 * Determines status for a factor score.
 */
export function getFactorStatus(
  isIncluded: boolean,
  score: number | null,
): 'good' | 'warning' | 'critical' | 'excluded' {
  if (!isIncluded || score === null) return 'excluded';
  if (score >= 80) return 'good';
  if (score >= 50) return 'warning';
  return 'critical';
}

/**
 * Maps an overall 0-100 score into a descriptive band.
 */
export function getScoreBand(score: number | null): HealthScoreBand {
  if (score === null) return 'insufficient_data';
  if (score >= 80) return 'strong';
  if (score >= 65) return 'stable';
  if (score >= 50) return 'needs_attention';
  return 'at_risk';
}

/**
 * Evaluates the 8 factors from raw inputs, applying missing data rules and weight renormalisation.
 */
export function evaluateHealthScore({
  inputs,
  weights = DEFAULT_HEALTH_WEIGHTS,
  targets = DEFAULT_HEALTH_TARGETS,
  previousSnapshotFactorScores,
  windowDays = 30,
  modelVersion = 1,
}: {
  inputs: RawHealthInputs;
  weights?: HealthModelWeights;
  targets?: HealthModelTargets;
  previousSnapshotFactorScores?: HealthFactorEvaluation[] | null;
  windowDays?: number;
  modelVersion?: number;
}): HealthScoreResult {
  const factorEvaluations: HealthFactorEvaluation[] = [];

  // 1. Sales Performance
  let salesGrowth: number | null = null;
  if (inputs.sales.hasData && inputs.sales.previousWindowNetRevenuePaise > 0) {
    salesGrowth =
      ((inputs.sales.currentWindowNetRevenuePaise - inputs.sales.previousWindowNetRevenuePaise) /
        inputs.sales.previousWindowNetRevenuePaise) *
      100;
  } else if (inputs.sales.hasData && inputs.sales.currentWindowNetRevenuePaise > 0) {
    salesGrowth = 100; // New sales established
  }

  const isSalesIncluded = inputs.sales.hasData && inputs.sales.daysWithSalesCount >= 1;
  const rawSalesScore = isSalesIncluded
    ? computeSalesScore(salesGrowth, targets.salesGrowthPercent)
    : null;
  factorEvaluations.push({
    id: 'sales_performance',
    name: 'Sales Performance',
    weight: weights.sales_performance,
    normalizedWeight: 0,
    rawScore: rawSalesScore,
    contributionPoints: 0,
    currentDisplayValue:
      salesGrowth !== null
        ? `${salesGrowth >= 0 ? '+' : ''}${salesGrowth.toFixed(1)}% revenue trend`
        : 'No sales data',
    targetDisplayValue: `≥ +${targets.salesGrowthPercent}% growth`,
    isIncluded: isSalesIncluded,
    exclusionReason: isSalesIncluded
      ? null
      : 'Need at least 1 closed day with recorded sales in comparison window',
    status: getFactorStatus(isSalesIncluded, rawSalesScore),
    formulaExplanation:
      'Net sales growth compared to previous window: 100 at ≥ +10%, 50 flat, 0 at ≤ -20% (linear interpolation)',
    inputsSummary: {
      currentRevenuePaise: inputs.sales.currentWindowNetRevenuePaise,
      previousRevenuePaise: inputs.sales.previousWindowNetRevenuePaise,
      growthPercent: salesGrowth !== null ? Math.round(salesGrowth * 10) / 10 : null,
    },
  });

  // 2. Profitability
  const isProfitabilityIncluded =
    inputs.profitability.hasData && inputs.profitability.revenuePaise > 0;
  const rawProfitScore = isProfitabilityIncluded
    ? computeProfitabilityScore(
        inputs.profitability.estimatedMarginPercent,
        targets.targetMarginPercent,
      )
    : null;
  factorEvaluations.push({
    id: 'profitability',
    name: 'Operating Profitability',
    weight: weights.profitability,
    normalizedWeight: 0,
    rawScore: rawProfitScore,
    contributionPoints: 0,
    currentDisplayValue:
      inputs.profitability.estimatedMarginPercent !== null
        ? `${inputs.profitability.estimatedMarginPercent.toFixed(1)}% operating margin`
        : 'No margin data',
    targetDisplayValue: `≥ ${targets.targetMarginPercent}% margin`,
    isIncluded: isProfitabilityIncluded,
    exclusionReason: isProfitabilityIncluded
      ? null
      : 'Requires logged revenue and operating overhead in evaluation window',
    status: getFactorStatus(isProfitabilityIncluded, rawProfitScore),
    formulaExplanation: `Operating profit margin vs target: 100 at ≥ ${targets.targetMarginPercent}%, 0 at ≤ 0% margin`,
    inputsSummary: {
      revenuePaise: inputs.profitability.revenuePaise,
      operatingExpensesPaise: inputs.profitability.operatingExpensesPaise,
      suppliesCostPaise: inputs.profitability.suppliesCostPaise,
      marginPercent: inputs.profitability.estimatedMarginPercent,
    },
  });

  // 3. Customer Retention
  const isRetentionIncluded =
    inputs.retention.hasData && inputs.retention.activeCustomersCount >= 3;
  const rawRetentionScore = isRetentionIncluded
    ? computeRetentionScore(inputs.retention.repeatRatePercent, targets.repeatRatePercent)
    : null;
  factorEvaluations.push({
    id: 'customer_retention',
    name: 'Customer Retention',
    weight: weights.customer_retention,
    normalizedWeight: 0,
    rawScore: rawRetentionScore,
    contributionPoints: 0,
    currentDisplayValue:
      inputs.retention.repeatRatePercent !== null
        ? `${inputs.retention.repeatRatePercent.toFixed(1)}% repeat guests`
        : 'Insufficient customer visits',
    targetDisplayValue: `≥ ${targets.repeatRatePercent}% repeat visits`,
    isIncluded: isRetentionIncluded,
    exclusionReason: isRetentionIncluded
      ? null
      : 'Requires at least 3 active customers with visit history',
    status: getFactorStatus(isRetentionIncluded, rawRetentionScore),
    formulaExplanation: `Repeat customer rate vs target: 100 at ≥ ${targets.repeatRatePercent}%, linear to 0%`,
    inputsSummary: {
      activeCount: inputs.retention.activeCustomersCount,
      repeatCount: inputs.retention.repeatCustomersCount,
      repeatRatePercent: inputs.retention.repeatRatePercent,
    },
  });

  // 4. Food / Supply Cost
  const isFoodCostIncluded = inputs.foodCost.hasData && inputs.foodCost.revenuePaise > 0;
  const rawFoodCostScore = isFoodCostIncluded
    ? computeFoodCostScore(inputs.foodCost.suppliesPercentOfRevenue, targets.targetFoodCostPercent)
    : null;
  factorEvaluations.push({
    id: 'food_cost',
    name: 'Food & Supply Cost',
    weight: weights.food_cost,
    normalizedWeight: 0,
    rawScore: rawFoodCostScore,
    contributionPoints: 0,
    currentDisplayValue:
      inputs.foodCost.suppliesPercentOfRevenue !== null
        ? `${inputs.foodCost.suppliesPercentOfRevenue.toFixed(1)}% of revenue`
        : 'No supply cost data',
    targetDisplayValue: `≤ ${targets.targetFoodCostPercent}% target`,
    isIncluded: isFoodCostIncluded,
    exclusionReason: isFoodCostIncluded
      ? null
      : 'Requires recorded revenue and inventory purchases in window',
    status: getFactorStatus(isFoodCostIncluded, rawFoodCostScore),
    formulaExplanation: `Supply cost % of net revenue: 100 at ≤ ${targets.targetFoodCostPercent}%, 0 at ≥ ${targets.targetFoodCostPercent + 15}% (lower is better)`,
    inputsSummary: {
      revenuePaise: inputs.foodCost.revenuePaise,
      suppliesCostPaise: inputs.foodCost.suppliesCostPaise,
      suppliesPercent: inputs.foodCost.suppliesPercentOfRevenue,
    },
  });

  // 5. Inventory Efficiency
  const isInventoryIncluded = inputs.inventory.hasData && inputs.inventory.totalActiveItems > 0;
  const rawInventoryScore = isInventoryIncluded
    ? computeInventoryScore(
        inputs.inventory.inStockPercent,
        targets.inStockTargetPercent,
        inputs.inventory.avgAuditVariancePercent,
      )
    : null;
  factorEvaluations.push({
    id: 'inventory_efficiency',
    name: 'Inventory Efficiency',
    weight: weights.inventory_efficiency,
    normalizedWeight: 0,
    rawScore: rawInventoryScore,
    contributionPoints: 0,
    currentDisplayValue:
      inputs.inventory.inStockPercent !== null
        ? `${inputs.inventory.inStockPercent.toFixed(1)}% healthy stock`
        : 'No active items',
    targetDisplayValue: `≥ ${targets.inStockTargetPercent}% in-stock`,
    isIncluded: isInventoryIncluded,
    exclusionReason: isInventoryIncluded ? null : 'Requires active items in inventory catalog',
    status: getFactorStatus(isInventoryIncluded, rawInventoryScore),
    formulaExplanation: `Share of ingredients above reorder level with penalty for stock count variance > 5%`,
    inputsSummary: {
      totalItems: inputs.inventory.totalActiveItems,
      lowStockItems: inputs.inventory.lowOrOutOfStockItems,
      inStockPercent: inputs.inventory.inStockPercent,
      variancePercent: inputs.inventory.avgAuditVariancePercent,
    },
  });

  // 6. Waste Management
  const isWasteIncluded = inputs.waste.hasData && inputs.waste.suppliesCostPaise > 0;
  const rawWasteScore = isWasteIncluded
    ? computeWasteScore(inputs.waste.wastePercentOfSupplies, targets.targetWastePercent)
    : null;
  factorEvaluations.push({
    id: 'waste',
    name: 'Kitchen Waste',
    weight: weights.waste,
    normalizedWeight: 0,
    rawScore: rawWasteScore,
    contributionPoints: 0,
    currentDisplayValue:
      inputs.waste.wastePercentOfSupplies !== null
        ? `${inputs.waste.wastePercentOfSupplies.toFixed(1)}% of supplies cost`
        : 'No waste/supply data',
    targetDisplayValue: `≤ ${targets.targetWastePercent}% target`,
    isIncluded: isWasteIncluded,
    exclusionReason: isWasteIncluded ? null : 'Requires recorded supplies cost in window',
    status: getFactorStatus(isWasteIncluded, rawWasteScore),
    formulaExplanation: `Recorded waste cost % of total supplies: 100 at ≤ ${targets.targetWastePercent}%, 0 at ≥ ${targets.targetWastePercent + 7}% (lower is better)`,
    inputsSummary: {
      wasteCostPaise: inputs.waste.wasteCostPaise,
      suppliesCostPaise: inputs.waste.suppliesCostPaise,
      wastePercent: inputs.waste.wastePercentOfSupplies,
    },
  });

  // 7. Kitchen Efficiency
  const isKitchenIncluded = inputs.kitchen.hasData && inputs.kitchen.totalKotsCount >= 5;
  const rawKitchenScore = isKitchenIncluded
    ? computeKitchenScore(inputs.kitchen.onTimePercent, targets.kitchenOnTimePercent)
    : null;
  factorEvaluations.push({
    id: 'kitchen_efficiency',
    name: 'Kitchen Speed',
    weight: weights.kitchen_efficiency,
    normalizedWeight: 0,
    rawScore: rawKitchenScore,
    contributionPoints: 0,
    currentDisplayValue:
      inputs.kitchen.onTimePercent !== null
        ? `${inputs.kitchen.onTimePercent.toFixed(1)}% on-time tickets`
        : 'Fewer than 5 KOTs',
    targetDisplayValue: `≥ ${targets.kitchenOnTimePercent}% on-time`,
    isIncluded: isKitchenIncluded,
    exclusionReason: isKitchenIncluded
      ? null
      : 'Requires at least 5 completed kitchen tickets (KOTs)',
    status: getFactorStatus(isKitchenIncluded, rawKitchenScore),
    formulaExplanation: `KOTs prepared within threshold: 100 at ≥ ${targets.kitchenOnTimePercent}%, 0 at ≤ 50%`,
    inputsSummary: {
      totalKots: inputs.kitchen.totalKotsCount,
      onTimeKots: inputs.kitchen.onTimeKotsCount,
      onTimePercent: inputs.kitchen.onTimePercent,
    },
  });

  // 8. Payment Reconciliation
  const isPaymentIncluded = inputs.payment.hasData && inputs.payment.totalBillsCount >= 3;
  const rawPaymentScore = isPaymentIncluded
    ? computePaymentScore(inputs.payment.reconciliationScorePercent, targets.paymentCleanPercent)
    : null;
  factorEvaluations.push({
    id: 'payment_reconciliation',
    name: 'Payment Reconciliation',
    weight: weights.payment_reconciliation,
    normalizedWeight: 0,
    rawScore: rawPaymentScore,
    contributionPoints: 0,
    currentDisplayValue:
      inputs.payment.reconciliationScorePercent !== null
        ? `${inputs.payment.reconciliationScorePercent.toFixed(1)}% clean settlements`
        : 'Fewer than 3 bills',
    targetDisplayValue: `≥ ${targets.paymentCleanPercent}% clean`,
    isIncluded: isPaymentIncluded,
    exclusionReason: isPaymentIncluded ? null : 'Requires at least 3 settled bills in window',
    status: getFactorStatus(isPaymentIncluded, rawPaymentScore),
    formulaExplanation: `Share of bills with resolved UPI & verified till cash: 100 at ≥ ${targets.paymentCleanPercent}%, 0 at ≤ 75%`,
    inputsSummary: {
      totalBills: inputs.payment.totalBillsCount,
      cleanBills: inputs.payment.cleanBillsCount,
      closedDays: inputs.payment.closedDaysCount,
      matchedCashDays: inputs.payment.matchedCashDaysCount,
      reconciliationPercent: inputs.payment.reconciliationScorePercent,
    },
  });

  // Renormalisation logic:
  // Missing data rule: a factor without enough data is EXCLUDED and remaining weights are renormalised.
  const includedFactors = factorEvaluations.filter((f) => f.isIncluded);
  const totalAvailableWeight = includedFactors.reduce((sum, f) => sum + f.weight, 0);

  // Check if we have sufficient overall data (need >= 14 days of closed sales or >= 3 included factors)
  const isSufficientData = includedFactors.length >= 3 && inputs.sales.daysWithSalesCount >= 1;

  let overallScore: number | null = null;
  let totalContribution = 0;

  if (isSufficientData && totalAvailableWeight > 0) {
    for (const factor of factorEvaluations) {
      if (factor.isIncluded && factor.rawScore !== null) {
        // Renormalize weight so included weights sum exactly to 100
        factor.normalizedWeight = Math.round((factor.weight / totalAvailableWeight) * 1000) / 10;
        factor.contributionPoints =
          Math.round(((factor.rawScore * factor.normalizedWeight) / 100) * 10) / 10;
        totalContribution += factor.contributionPoints;
      } else {
        factor.normalizedWeight = 0;
        factor.contributionPoints = 0;
      }
    }
    overallScore = clamp(Math.round(totalContribution), 0, 100);
  } else {
    for (const factor of factorEvaluations) {
      factor.normalizedWeight = 0;
      factor.contributionPoints = 0;
    }
  }

  // Confidence Calculation
  let confidence: HealthConfidence = 'low';
  if (includedFactors.length >= 7 && inputs.sales.daysWithSalesCount >= 14) {
    confidence = 'high';
  } else if (includedFactors.length >= 5 && inputs.sales.daysWithSalesCount >= 7) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Reasons for Change (Delta Attribution vs previous snapshot)
  const reasonsForChange: HealthScoreReasonForChange[] = [];
  if (previousSnapshotFactorScores && previousSnapshotFactorScores.length > 0) {
    for (const factor of factorEvaluations) {
      const prevFactor = previousSnapshotFactorScores.find((pf) => pf.id === factor.id);
      if (prevFactor) {
        const delta =
          Math.round((factor.contributionPoints - prevFactor.contributionPoints) * 10) / 10;
        if (Math.abs(delta) >= 0.5) {
          const sign = delta > 0 ? '+' : '';
          let explanation = `${sign}${delta} pts from ${factor.name}: current ${factor.currentDisplayValue} vs target ${factor.targetDisplayValue}`;
          if (prevFactor.currentDisplayValue !== factor.currentDisplayValue) {
            explanation = `${sign}${delta} pts from ${factor.name}: changed from ${prevFactor.currentDisplayValue} to ${factor.currentDisplayValue}`;
          }
          reasonsForChange.push({
            factorId: factor.id,
            factorName: factor.name,
            deltaPoints: delta,
            explanation,
          });
        }
      }
    }

    // Sort reasons by negative impact first if score declined, or positive first if score improved
    reasonsForChange.sort((a, b) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints));
  }

  // Rule-Based Improvement Suggestions (top 3 potential point gains)
  const suggestions: HealthImprovementSuggestion[] = [];
  const improvementCandidates = factorEvaluations
    .filter((f) => f.isIncluded && f.rawScore !== null && f.rawScore < 95)
    .map((f) => {
      const potentialGain =
        Math.round((((100 - f.rawScore!) * f.normalizedWeight) / 100) * 10) / 10;
      return { factor: f, potentialGain };
    })
    .sort((a, b) => b.potentialGain - a.potentialGain);

  const top3 = improvementCandidates.slice(0, 3);
  for (const item of top3) {
    const f = item.factor;
    const gain = item.potentialGain;
    switch (f.id) {
      case 'food_cost':
        suggestions.push({
          factorId: f.id,
          factorName: f.name,
          title: 'Optimize Food & Supplies Purchases',
          description: `Supply cost is currently ${f.currentDisplayValue} (target ${f.targetDisplayValue}). Negotiate bulk rates with frequent suppliers or inspect prep yields.`,
          actionUrl: '/owner/purchases',
          potentialGainPoints: gain,
        });
        break;
      case 'waste':
        suggestions.push({
          factorId: f.id,
          factorName: f.name,
          title: 'Reduce Kitchen Spoilage & Trim Waste',
          description: `Logged kitchen waste is ${f.currentDisplayValue} (target ${f.targetDisplayValue}). Review high-waste items and store bulk perishables at proper temperature.`,
          actionUrl: '/owner/inventory',
          potentialGainPoints: gain,
        });
        break;
      case 'profitability':
        suggestions.push({
          factorId: f.id,
          factorName: f.name,
          title: 'Tighten Operating Overhead',
          description: `Operating margin is ${f.currentDisplayValue} (target ${f.targetDisplayValue}). Audit electricity usage and evaluate non-essential recurring subscriptions.`,
          actionUrl: '/owner/expenses',
          potentialGainPoints: gain,
        });
        break;
      case 'sales_performance':
        suggestions.push({
          factorId: f.id,
          factorName: f.name,
          title: 'Boost Slow-Shift Revenue',
          description: `Sales revenue trend is ${f.currentDisplayValue}. Introduce lunch specials or weekday promotions to drive table turns during off-peak hours.`,
          actionUrl: '/owner/sales',
          potentialGainPoints: gain,
        });
        break;
      case 'customer_retention':
        suggestions.push({
          factorId: f.id,
          factorName: f.name,
          title: 'Re-Engage Lapsed & First-Time Guests',
          description: `Repeat visitor share is ${f.currentDisplayValue} (target ${f.targetDisplayValue}). Prompt waitstaff to enroll guests into the loyalty rewards program.`,
          actionUrl: '/owner/loyalty',
          potentialGainPoints: gain,
        });
        break;
      case 'inventory_efficiency':
        suggestions.push({
          factorId: f.id,
          factorName: f.name,
          title: 'Restock Critical Ingredients',
          description: `Healthy stock ratio is ${f.currentDisplayValue}. Several ingredients are near or below safety reorder levels risking stock-outs.`,
          actionUrl: '/owner/inventory',
          potentialGainPoints: gain,
        });
        break;
      case 'kitchen_efficiency':
        suggestions.push({
          factorId: f.id,
          factorName: f.name,
          title: 'Streamline Rush Prep Stations',
          description: `Ticket prep speed is ${f.currentDisplayValue} (target ${f.targetDisplayValue}). Examine station bottlenecks and prep mise en place ahead of peak dinner rushes.`,
          actionUrl: '/kitchen',
          potentialGainPoints: gain,
        });
        break;
      case 'payment_reconciliation':
        suggestions.push({
          factorId: f.id,
          factorName: f.name,
          title: 'Reconcile Register Differences',
          description: `Settlement reconciliation is ${f.currentDisplayValue} (target ${f.targetDisplayValue}). Resolve pending UPI transactions and investigate till cash shortages.`,
          actionUrl: '/owner/close-day',
          potentialGainPoints: gain,
        });
        break;
    }
  }

  return {
    overallScore,
    scoreBand: getScoreBand(overallScore),
    confidence,
    factorsUsedCount: includedFactors.length,
    totalFactorsCount: 8,
    factors: factorEvaluations,
    reasonsForChange,
    suggestions,
    windowDays,
    modelVersion,
    isSufficientData,
    insufficientDataReason: isSufficientData
      ? null
      : 'Not enough data yet (need ≥ 14 days of closed sales and at least 3 active factors).',
  };
}
