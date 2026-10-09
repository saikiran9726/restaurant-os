import { z } from 'zod';

export const BillStatusEnum = z.enum([
  'draft',
  'unpaid',
  'partially_paid',
  'paid',
  'cancelled',
  'refunded',
]);

export const PaymentMethodEnum = z.enum(['cash', 'upi', 'card']);

export const PaymentStatusEnum = z.enum([
  'recorded',
  'pending_confirmation',
  'confirmed',
  'failed',
  'reversed',
]);

export const DiscountTypeEnum = z.enum(['percent', 'flat']);

export const CreateBillSchema = z.object({
  discount: z
    .object({
      type: DiscountTypeEnum,
      value: z.number().nonnegative(),
      reason: z.string().trim().min(1, 'Discount reason is required'),
      overridePin: z.string().trim().min(4).max(6).optional(),
    })
    .optional()
    .nullable(),
  serviceChargePercent: z.number().min(0).max(100).optional(),
  roundOffEnabled: z.boolean().optional().default(true),
  idempotencyKey: z.string().trim().min(1).optional(),
});

export const ApplyDiscountSchema = z.object({
  type: DiscountTypeEnum,
  value: z.number().nonnegative('Discount value must be non-negative'),
  reason: z.string().trim().min(1, 'Discount reason is required'),
  overridePin: z.string().trim().min(4).max(6).optional(),
});

export const RecordPaymentSchema = z.object({
  method: PaymentMethodEnum,
  amountPaise: z.number().int().positive('Payment amount must be positive'),
  tenderedPaise: z.number().int().nonnegative().optional(), // For cash transactions
  reference: z.string().trim().optional(), // Card approval code / last 4 or UPI ref
  idempotencyKey: z.string().trim().min(1, 'Idempotency key is required'),
});

export const ConfirmPaymentSchema = z.object({
  idempotencyKey: z.string().trim().min(1).optional(),
});

export const CancelBillSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason is required (minimum 3 characters)'),
  overridePin: z.string().trim().min(4).max(6).optional(),
});

export const RefundBillSchema = z.object({
  paymentId: z.string().uuid().optional().nullable(),
  amountPaise: z.number().int().positive('Refund amount must be positive'),
  method: PaymentMethodEnum,
  reason: z.string().trim().min(3, 'Refund reason is required (minimum 3 characters)'),
  idempotencyKey: z.string().trim().min(1).optional(),
});

export const BillFilterSchema = z.object({
  status: BillStatusEnum.optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
  tableId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  paymentMethod: PaymentMethodEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateBillInput = z.infer<typeof CreateBillSchema>;
export type ApplyDiscountInput = z.infer<typeof ApplyDiscountSchema>;
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentSchema>;
export type CancelBillInput = z.infer<typeof CancelBillSchema>;
export type RefundBillInput = z.infer<typeof RefundBillSchema>;
export type BillFilterInput = z.infer<typeof BillFilterSchema>;
export type BillStatus = z.infer<typeof BillStatusEnum>;
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;
export type DiscountType = z.infer<typeof DiscountTypeEnum>;
