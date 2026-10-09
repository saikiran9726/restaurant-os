import { z } from 'zod';

export const PAYMENT_SOURCES = ['till', 'bank', 'upi', 'other'] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

// --- Schemas ---

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(50),
  description: z.string().trim().optional().nullable(),
  countsAsOperating: z.boolean().default(true),
});
export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;

export const updateExpenseCategorySchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().optional().nullable(),
  countsAsOperating: z.boolean().optional(),
  active: z.boolean().optional(),
});
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

export const createExpenseSchema = z.object({
  categoryId: z.string().uuid(),
  amountPaise: z.number().int().positive('Amount must be greater than zero'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().trim().min(1, 'Description is required').max(200),
  reference: z.string().trim().optional().nullable(),
  paymentSource: z.enum(PAYMENT_SOURCES).default('upi'),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  categoryId: z.string().uuid().optional(),
  amountPaise: z.number().int().positive().optional(),
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().trim().min(1).max(200).optional(),
  reference: z.string().trim().optional().nullable(),
  paymentSource: z.enum(PAYMENT_SOURCES).optional(),
  editReason: z.string().trim().min(3, 'Edit reason must be provided'),
});
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const copyRecurringExpensesSchema = z.object({
  sourceMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Source month must be YYYY-MM'),
  targetMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Target month must be YYYY-MM'),
  expenseIds: z.array(z.string().uuid()).min(1, 'Select at least one expense to copy'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type CopyRecurringExpensesInput = z.infer<typeof copyRecurringExpensesSchema>;

export const saveMonthlySnapshotSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  note: z.string().trim().optional().nullable(),
});
export type SaveMonthlySnapshotInput = z.infer<typeof saveMonthlySnapshotSchema>;

// --- Output Types ---

export interface ExpenseCategoryOutput {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  countsAsOperating: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseOutput {
  id: string;
  restaurantId: string;
  categoryId: string;
  categoryName: string;
  countsAsOperating: boolean;
  amountPaise: number;
  expenseDate: string;
  month: string; // YYYY-MM
  description: string;
  reference: string | null;
  paymentSource: PaymentSource;
  paidFromTill: boolean;
  createdBy: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCategorySummary {
  categoryId: string;
  categoryName: string;
  countsAsOperating: boolean;
  currentMonthPaise: number;
  previousMonthPaise: number;
  changePercent: number | null;
  count: number;
}

export interface MonthCompletenessChecklist {
  daysInMonth: number;
  closedDaysCount: number;
  unclosedDaysCount: number;
  isAllDaysClosed: boolean;
  hasRentExpense: boolean;
  hasSalariesExpense: boolean;
  hasUtilitiesExpense: boolean;
  hasOpeningStockCount: boolean;
  hasClosingStockCount: boolean;
  completenessPercent: number;
  missingItems: string[];
}

export interface MonthlyReviewResponse {
  month: string;
  isCurrentMonth: boolean;
  completeness: MonthCompletenessChecklist;
  revenuePaise: number;
  suppliesCostPaise: number;
  suppliesMethod: 'consumption' | 'purchases';
  suppliesMethodReason: string;
  wasteCostPaise: number;
  operatingExpensesPaise: number;
  estimatedProfitPaise: number;
  profitMarginPercent: number | null;
  suppliesPercentOfRevenue: number | null;
  expensesPercentOfRevenue: number | null;
  paymentMethodMix: {
    cashPaise: number;
    upiPaise: number;
    cardPaise: number;
  };
  previousMonthComparison: {
    prevMonth: string;
    prevRevenuePaise: number;
    prevSuppliesCostPaise: number;
    prevOperatingExpensesPaise: number;
    prevProfitPaise: number;
    prevMarginPercent: number | null;
    explanation: string;
  } | null;
  categoryTotals: ExpenseCategorySummary[];
  savedSnapshotAt?: string | null;
}

export interface MonthlyEvaluationSnapshotOutput {
  id: string;
  restaurantId: string;
  month: string;
  version: number;
  revenuePaise: number;
  suppliesCostPaise: number;
  suppliesMethod: string;
  operatingExpensesPaise: number;
  estimatedProfitPaise: number;
  profitMarginPercent: number | null;
  completenessPercent: number;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  note: string | null;
  createdBy: string | null;
  createdByName?: string | null;
  createdAt: string;
}
