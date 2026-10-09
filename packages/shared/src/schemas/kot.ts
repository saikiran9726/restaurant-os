import { z } from 'zod';

export const kotTypeSchema = z.enum(['new', 'additional', 'modified']);
export type KotType = z.infer<typeof kotTypeSchema>;

export const kotStatusSchema = z.enum(['new', 'preparing', 'ready', 'served', 'cancelled']);
export type KotStatus = z.infer<typeof kotStatusSchema>;

export const kotItemActionSchema = z.enum(['add', 'cancel', 'update']);
export type KotItemAction = z.infer<typeof kotItemActionSchema>;

export const kotItemStatusSchema = z.enum(['pending', 'done', 'cancelled']);
export type KotItemStatus = z.infer<typeof kotItemStatusSchema>;

export const kotItemSchema = z.object({
  id: z.string().uuid(),
  kotId: z.string().uuid(),
  orderItemId: z.string().uuid(),
  name: z.string().optional(),
  qty: z.number().int(),
  action: kotItemActionSchema,
  status: kotItemStatusSchema,
  noteSnapshot: z.string().nullable().optional(),
  doneAt: z.coerce.date().nullable().optional(),
  cancelledReason: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
});

export const kotSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  kotNumber: z.number().int(),
  provisionalLabel: z.string().nullable().optional(),
  type: kotTypeSchema,
  status: kotStatusSchema,
  createdBy: z.string().uuid().nullable().optional(),
  createdByName: z.string().optional(),
  createdAt: z.coerce.date(),
  readyAt: z.coerce.date().nullable().optional(),
  servedAt: z.coerce.date().nullable().optional(),
  seenAt: z.coerce.date().nullable().optional(),
  items: z.array(kotItemSchema).default([]),
});

export const sendKotInputSchema = z.object({
  provisionalLabel: z.string().max(20).optional(),
  cancelledItems: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        reason: z.string().trim().min(1, 'Reason required for cancelling item'),
        managerPin: z.string().optional(),
      }),
    )
    .optional(),
});

export const updateKotStatusSchema = z.object({
  status: kotStatusSchema,
});

export const markItemOosSchema = z.object({
  reason: z.string().trim().max(100).optional(),
});

export type KotItemModel = z.infer<typeof kotItemSchema>;
export type KotModel = z.infer<typeof kotSchema>;
export type SendKotInput = z.infer<typeof sendKotInputSchema>;
