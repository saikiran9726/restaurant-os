import { z } from 'zod';

export const orderTypeSchema = z.enum(['dine_in', 'takeaway']);
export type OrderType = z.infer<typeof orderTypeSchema>;

export const orderStatusSchema = z.enum(['open', 'saved', 'billed', 'cancelled']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderItemModifierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  priceDeltaPaise: z.number().int().default(0),
});

export const orderItemInputSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.number().int().min(1).max(99),
  modifiers: z.array(orderItemModifierSchema).default([]),
  note: z.string().trim().max(200).optional(),
});

export const createOrderSchema = z.object({
  id: z.string().uuid(), // Client UUIDv7
  tableId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  type: orderTypeSchema.default('dine_in'),
  guests: z.number().int().min(1).max(50).default(2),
  specialInstructions: z.string().trim().max(300).optional(),
  items: z.array(orderItemInputSchema).min(1, 'Order must contain at least 1 item'),
});

export const updateOrderSchema = z.object({
  tableId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  type: orderTypeSchema.optional(),
  guests: z.number().int().min(1).max(50).optional(),
  specialInstructions: z.string().trim().max(300).optional(),
  version: z.number().int(), // Mandatory for optimistic concurrency check
  items: z.array(orderItemInputSchema).min(1, 'Order must contain at least 1 item'),
});

export const orderItemOutputSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  itemId: z.string().uuid(),
  nameSnapshot: z.string(),
  pricePaiseSnapshot: z.number().int(),
  taxRateBpSnapshot: z.number().int(),
  qty: z.number().int(),
  modifiers: z.array(orderItemModifierSchema),
  note: z.string().nullable().optional(),
  status: z.string(),
  lineNo: z.number().int(),
  createdAt: z.coerce.date().optional(),
});

export const orderOutputSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid().nullable().optional(),
  tableLabel: z.string().optional(),
  type: orderTypeSchema,
  guests: z.number().int(),
  status: orderStatusSchema,
  specialInstructions: z.string().nullable().optional(),
  subtotalPaise: z.number().int(),
  taxPaise: z.number().int(),
  totalPaise: z.number().int(),
  createdBy: z.string().uuid().nullable().optional(),
  createdByName: z.string().optional(),
  version: z.number().int(),
  items: z.array(orderItemOutputSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const frequentItemOutputSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string(),
  isVeg: z.boolean(),
  pricePaise: z.number().int(),
  categoryName: z.string().optional(),
  totalSold: z.number().int(),
});

export const recentOrderOutputSchema = z.object({
  id: z.string().uuid(),
  tableId: z.string().uuid().nullable().optional(),
  tableLabel: z.string().optional(),
  type: orderTypeSchema,
  totalPaise: z.number().int(),
  createdAt: z.coerce.date(),
  itemSummary: z.string(),
  items: z.array(
    z.object({
      itemId: z.string().uuid(),
      name: z.string(),
      qty: z.number().int(),
      pricePaise: z.number().int(),
      modifiers: z.array(orderItemModifierSchema).default([]),
      available: z.boolean(),
    }),
  ),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderOutput = z.infer<typeof orderOutputSchema>;
export type OrderItemOutput = z.infer<typeof orderItemOutputSchema>;
export type FrequentItemOutput = z.infer<typeof frequentItemOutputSchema>;
export type RecentOrderOutput = z.infer<typeof recentOrderOutputSchema>;
