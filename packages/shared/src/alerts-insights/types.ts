export const ALERT_TYPES = [
  'cash_mismatch',
  'low_stock',
  'high_expense',
  'payment_reconciliation',
  'profit_decline',
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ['critical', 'warning', 'info'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = ['open', 'resolved', 'snoozed', 'dismissed'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const INSIGHT_KINDS = [
  'sales_change',
  'top_seller',
  'supply_cost_change',
  'margin_change',
  'unreturned_regulars',
  'consumption_change',
] as const;
export type InsightKind = (typeof INSIGHT_KINDS)[number];

export const INSIGHT_PERIODS = ['daily', 'weekly', 'monthly'] as const;
export type InsightPeriod = (typeof INSIGHT_PERIODS)[number];

export interface AlertThresholdSettings {
  // Cash mismatch tolerance (paise) - default Rs 50 (5000 paise)
  cashMismatchTolerancePaise: number;
  // High expense multiplier vs trailing 3-month avg - default 1.5x
  highExpenseMultiplier: number;
  // Minimum expense amount to trigger alert (paise) - default Rs 5,000 (500,000 paise)
  highExpenseMinAmountPaise: number;
  // UPI pending confirmation timeout (hours) - default 2 hours
  upiPendingTimeoutHours: number;
  // Profit margin decline threshold (percentage points) - default 5.0 points
  profitDeclinePointsThreshold: number;
  // Regular customer absence threshold (days) - default 30 days
  regularCustomerInactiveDays: number;
  // Enable/disable flags per alert type
  enabledAlerts: Record<AlertType, boolean>;
  // Enable/disable flags per insight type
  enabledInsights: Record<InsightKind, boolean>;
}

export const DEFAULT_ALERT_SETTINGS: AlertThresholdSettings = {
  cashMismatchTolerancePaise: 5000, // ASSUMPTION: Rs 50 cash discrepancy tolerance
  highExpenseMultiplier: 1.5, // ASSUMPTION: 1.5x trailing 3-month avg
  highExpenseMinAmountPaise: 500000, // ASSUMPTION: Rs 5,000 minimum
  upiPendingTimeoutHours: 2, // ASSUMPTION: 2 hours unresolved UPI timeout
  profitDeclinePointsThreshold: 5.0, // ASSUMPTION: 5 percentage points margin drop
  regularCustomerInactiveDays: 30, // ASSUMPTION: 30 days without return
  enabledAlerts: {
    cash_mismatch: true,
    low_stock: true,
    high_expense: true,
    payment_reconciliation: true,
    profit_decline: true,
  },
  enabledInsights: {
    sales_change: true,
    top_seller: true,
    supply_cost_change: true,
    margin_change: true,
    unreturned_regulars: true,
    consumption_change: true,
  },
};

export interface AlertSettingsOutput extends AlertThresholdSettings {
  id: string;
  restaurantId: string;
  updatedAt: string;
}

export interface AlertItemPayload {
  title?: string;
  whatIsWrong: string;
  whyItMatters: string;
  primaryActionLabel?: string;
  primaryActionUrl?: string;
  actionLabel?: string;
  actionUrl?: string;
  metricValue?: string;
  thresholdValue?: string;
  items?: Array<{
    id: string;
    name: string;
    currentStock: number;
    reorderLevel: number;
    unit: string;
  }>;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AlertOutput {
  id: string;
  restaurantId: string;
  type: AlertType;
  severity: AlertSeverity;
  dedupeKey: string;
  payload: AlertItemPayload;
  firstSeen: string;
  lastSeen: string;
  status: AlertStatus;
  snoozedUntil?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  note?: string | null;
  dismissReason?: string | null;
  createdAt: string;
}

export interface InsightEvidence {
  metricName: string;
  currentValue: number | string;
  previousValue?: number | string | null;
  difference?: string | null;
  baselineValue?: number | string | null;
  changePercent?: number | null;
  sampleSize?: number;
  details: Record<string, any>;
}

export interface InsightOutput {
  id: string;
  restaurantId: string;
  period: InsightPeriod;
  kind: InsightKind;
  text: string;
  evidence: InsightEvidence;
  materialityScore: number; // 0–100 ranking importance
  createdAt: string;
  dismissed: boolean;
}
