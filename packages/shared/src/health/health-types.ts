export const HEALTH_FACTOR_IDS = [
  'sales_performance',
  'profitability',
  'customer_retention',
  'food_cost',
  'inventory_efficiency',
  'waste',
  'kitchen_efficiency',
  'payment_reconciliation',
] as const;

export type HealthFactorId = (typeof HEALTH_FACTOR_IDS)[number];

export type HealthScoreBand =
  'strong' | 'stable' | 'needs_attention' | 'at_risk' | 'insufficient_data';
export type HealthConfidence = 'high' | 'medium' | 'low';

export interface HealthModelWeights {
  sales_performance: number; // default 15
  profitability: number; // default 20
  customer_retention: number; // default 12
  food_cost: number; // default 15
  inventory_efficiency: number; // default 8
  waste: number; // default 8
  kitchen_efficiency: number; // default 10
  payment_reconciliation: number; // default 12
}

export interface HealthModelTargets {
  salesGrowthPercent: number; // default 10 (10% growth)
  targetMarginPercent: number; // default 20 (20% operating margin)
  repeatRatePercent: number; // default 40 (40% repeat visits)
  targetFoodCostPercent: number; // default 32 (32% of revenue)
  inStockTargetPercent: number; // default 90 (90% healthy stock)
  targetWastePercent: number; // default 3 (3% of supplies cost)
  kitchenOnTimePercent: number; // default 85 (85% on-time KOTs)
  paymentCleanPercent: number; // default 95 (95% clean payments)
}

export const DEFAULT_HEALTH_WEIGHTS: HealthModelWeights = {
  sales_performance: 15,
  profitability: 20,
  customer_retention: 12,
  food_cost: 15,
  inventory_efficiency: 8,
  waste: 8,
  kitchen_efficiency: 10,
  payment_reconciliation: 12,
};

export const DEFAULT_HEALTH_TARGETS: HealthModelTargets = {
  salesGrowthPercent: 10,
  targetMarginPercent: 20,
  repeatRatePercent: 40,
  targetFoodCostPercent: 32,
  inStockTargetPercent: 90,
  targetWastePercent: 3,
  kitchenOnTimePercent: 85,
  paymentCleanPercent: 95,
};

export interface HealthFactorEvaluation {
  id: HealthFactorId;
  name: string;
  weight: number; // Configured weight (e.g. 15)
  normalizedWeight: number; // Renormalized weight if some factors excluded
  rawScore: number | null; // 0–100 or null if excluded
  contributionPoints: number; // (rawScore * normalizedWeight) / 100
  currentDisplayValue: string; // e.g. "+12.4% sales growth" or "34.1% of revenue"
  targetDisplayValue: string; // e.g. "≥ +10% target" or "≤ 32% target"
  isIncluded: boolean;
  exclusionReason?: string | null;
  status: 'good' | 'warning' | 'critical' | 'excluded';
  formulaExplanation: string; // Plain-English formula definition
  inputsSummary: Record<string, any>;
}

export interface HealthScoreReasonForChange {
  factorId: HealthFactorId;
  factorName: string;
  deltaPoints: number; // e.g. -6 or +3
  explanation: string;
}

export interface HealthImprovementSuggestion {
  factorId: HealthFactorId;
  factorName: string;
  title: string;
  description: string;
  actionUrl: string;
  potentialGainPoints: number;
}

export interface HealthScoreResult {
  overallScore: number | null; // 0–100 or null if insufficient data
  scoreBand: HealthScoreBand;
  confidence: HealthConfidence;
  factorsUsedCount: number;
  totalFactorsCount: number;
  factors: HealthFactorEvaluation[];
  reasonsForChange: HealthScoreReasonForChange[];
  suggestions: HealthImprovementSuggestion[];
  windowDays: number;
  modelVersion: number;
  isSufficientData: boolean;
  insufficientDataReason?: string | null;
}

export interface HealthModelOutput {
  id: string;
  restaurantId: string;
  version: number;
  windowDays: number;
  weights: HealthModelWeights;
  targets: HealthModelTargets;
  createdAt: string;
  updatedAt: string;
}

export interface HealthSnapshotOutput {
  id: string;
  restaurantId: string;
  snapshotDate: string;
  modelVersion: number;
  overallScore: number | null;
  scoreBand: HealthScoreBand;
  confidence: HealthConfidence;
  factorsUsed: number;
  totalFactors: number;
  factorScores: HealthFactorEvaluation[];
  reasonsForChange: HealthScoreReasonForChange[];
  suggestions: HealthImprovementSuggestion[];
  createdAt: string;
}
