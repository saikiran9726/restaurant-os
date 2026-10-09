import { z } from 'zod';
import type { InsightCardData } from '../analytics/insights-engine.js';

export const salesReportFilterSchema = z.object({
  range: z.enum(['today', 'yesterday', 'weekly', 'monthly', 'custom']).default('today'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type SalesReportFilter = z.infer<typeof salesReportFilterSchema>;

export const eodCloseDaySchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  openingCashPaise: z.number().int().nonnegative(),
  openingCashEdited: z.boolean().default(false),
  openingCashEditReason: z.string().trim().optional(),
  actualCashPaise: z.number().int().nonnegative(),
  cashDifferenceNote: z.string().trim().optional(),
  acknowledgedUnresolved: z
    .array(
      z.object({
        type: z.enum(['open_order', 'unpaid_bill', 'pending_upi', 'pending_sync']),
        id: z.string(),
        title: z.string().optional(),
        reason: z.string().optional(),
      }),
    )
    .default([]),
  denominations: z.record(z.string(), z.number().int().nonnegative()).optional(),
});
export type EodCloseDayInput = z.infer<typeof eodCloseDaySchema>;

export const eodReopenSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  overridePin: z.string().min(4).max(6),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters'),
});
export type EodReopenInput = z.infer<typeof eodReopenSchema>;

export const addCashExpenseSchema = z.object({
  amountPaise: z.number().int().positive('Expense amount must be greater than zero'),
  category: z.string().trim().min(1).default('supplies'),
  note: z.string().trim().optional(),
  paidFromTill: z.boolean().default(true),
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type AddCashExpenseInput = z.infer<typeof addCashExpenseSchema>;

export interface SalesReportKpis {
  netSalesPaise: number;
  grossSalesPaise: number;
  ordersCount: number;
  billsCount: number;
  aovPaise: number; // Average Order Value
  discountsPaise: number;
  taxCollectedPaise: number;
  serviceChargePaise: number;
  roundOffPaise: number;
  refundsPaise: number;
  cancelledBillsCount: number;
}

export interface SalesChartDataPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "9 Oct" or "14:00"
  netSalesPaise: number;
  ordersCount: number;
}

export interface HourlyHeatmapPoint {
  hour: number; // 0-23
  label: string; // "12 PM"
  netSalesPaise: number;
  ordersCount: number;
}

export interface CategorySalesPoint {
  categoryId: string;
  categoryName: string;
  revenuePaise: number;
  quantity: number;
  sharePercent: number;
}

export interface OrderTypeBreakdownPoint {
  type: 'dine_in' | 'takeaway';
  netSalesPaise: number;
  ordersCount: number;
  sharePercent: number;
}

export interface PaymentMixPoint {
  method: 'cash' | 'upi' | 'card';
  amountPaise: number;
  count: number;
  sharePercent: number;
}

export interface SalesReportResponse {
  range: string;
  startDate: string;
  endDate: string;
  isSingleDay: boolean;
  kpis: SalesReportKpis;
  insights: InsightCardData[];
  chartData: SalesChartDataPoint[];
  hourlyHeatmap: HourlyHeatmapPoint[];
  categories: CategorySalesPoint[];
  orderTypes: OrderTypeBreakdownPoint[];
  paymentMix: PaymentMixPoint[];
}

export interface ItemPerformanceRow {
  itemId: string;
  itemName: string;
  categoryName: string;
  quantitySold: number;
  revenuePaise: number;
  daysOnMenu: number;
  isNewItem: boolean; // true if added < 7 days ago
}

export interface ItemsReportResponse {
  startDate: string;
  endDate: string;
  bestSellers: ItemPerformanceRow[];
  worstPerformers: ItemPerformanceRow[]; // Filtered with daysOnMenu >= 7 to avoid penalizing new additions
  allPerformers: ItemPerformanceRow[];
}

export interface CustomerAnalyticsResponse {
  totalCustomersSeen: number;
  newCustomersCount: number;
  returningCustomersCount: number;
  returningSharePercent: number;
  totalLoyaltyPointsRedeemed: number;
  totalLoyaltyDiscountPaise: number;
  billsWithLoyaltyCount: number;
  loyaltyBillSharePercent: number;
}

export interface UnresolvedItem {
  id: string;
  type: 'open_order' | 'unpaid_bill' | 'pending_upi' | 'pending_sync';
  title: string;
  details: string;
  amountPaise?: number;
  createdAt: string;
}

export interface EodPreCheckStatus {
  businessDate: string;
  canClose: boolean;
  unresolvedCount: number;
  openOrders: UnresolvedItem[];
  unpaidBills: UnresolvedItem[];
  pendingUpiPayments: UnresolvedItem[];
  pendingSyncItems: UnresolvedItem[];
  summary: {
    grossSalesPaise: number;
    netSalesPaise: number;
    cashSalesPaise: number;
    upiSalesPaise: number;
    cardSalesPaise: number;
    discountsPaise: number;
    cancellationsCount: number;
    refundsPaise: number;
    billsCount: number;
  };
  cashReconciliation: {
    openingCashPaise: number;
    cashSalesPaise: number;
    cashExpensesPaise: number;
    cashRefundsPaise: number;
    expectedClosingCashPaise: number;
  };
  expenses: Array<{
    id: string;
    amountPaise: number;
    category: string;
    note: string | null;
    paidFromTill: boolean;
    createdAt: string;
  }>;
  existingSummary: DailySummaryOutput | null;
}

export interface DailySummaryOutput {
  id: string;
  restaurantId: string;
  businessDate: string;
  status: 'closed' | 'reopened';
  grossSalesPaise: number;
  netSalesPaise: number;
  discountsPaise: number;
  taxCollectedPaise: number;
  serviceChargePaise: number;
  roundOffPaise: number;
  billsCount: number;
  ordersCount: number;
  cancelledBillsCount: number;
  refundsPaise: number;
  cashSalesPaise: number;
  upiSalesPaise: number;
  cardSalesPaise: number;
  openingCashPaise: number;
  openingCashEdited: boolean;
  openingCashEditReason: string | null;
  cashExpensesPaise: number;
  cashRefundsPaise: number;
  expectedCashPaise: number;
  actualCashPaise: number;
  cashDifferencePaise: number;
  cashDifferenceNote: string | null;
  unresolvedItems: any[];
  denominations: Record<string, number> | null;
  closedBy: string | null;
  closedByName?: string | null;
  closedAt: string;
  locked: boolean;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
}
