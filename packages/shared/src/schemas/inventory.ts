import { z } from 'zod';

export const INVENTORY_UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'packet', 'dozen', 'custom'] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export const WASTE_REASONS = ['spoilage', 'spillage', 'expired', 'returned', 'other'] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

export const STOCK_MOVEMENT_TYPES = [
  'purchase',
  'usage',
  'waste',
  'adjustment',
  'stock_count',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

// --- Schemas ---

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(100),
  unit: z.enum(INVENTORY_UNITS).default('kg'),
  category: z.string().trim().default('General'),
  reorderLevel: z.number().nonnegative().default(0),
  currentStock: z.number().default(0),
  initialCostPaisePerUnit: z.number().int().nonnegative().optional(),
});
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

export const updateInventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  unit: z.enum(INVENTORY_UNITS).optional(),
  category: z.string().trim().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
});
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required').max(100),
  phone: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  active: z.boolean().default(true),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const purchaseLineInputSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPricePaise: z.number().int().nonnegative('Unit price must be non-negative'),
  lineTotalPaise: z.number().int().nonnegative('Line total must be non-negative'),
});
export type PurchaseLineInput = z.infer<typeof purchaseLineInputSchema>;

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid().optional().nullable(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  invoiceRef: z.string().trim().optional().nullable(),
  paidStatus: z.enum(['paid', 'unpaid']).default('unpaid'),
  note: z.string().trim().optional().nullable(),
  lines: z.array(purchaseLineInputSchema).min(1, 'Purchase must have at least one line item'),
});
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export const updatePurchaseSchema = z.object({
  supplierId: z.string().uuid().optional().nullable(),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  invoiceRef: z.string().trim().optional().nullable(),
  paidStatus: z.enum(['paid', 'unpaid']).optional(),
  note: z.string().trim().optional().nullable(),
  lines: z
    .array(purchaseLineInputSchema)
    .min(1, 'Purchase must have at least one line item')
    .optional(),
});
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;

export const recordUsageSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().positive('Usage quantity must be positive'),
  reason: z.string().trim().default('Kitchen consumption'),
  movementDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type RecordUsageInput = z.infer<typeof recordUsageSchema>;

export const recordWasteSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().positive('Waste quantity must be positive'),
  reason: z.enum(WASTE_REASONS),
  movementDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  note: z.string().trim().optional().nullable(),
});
export type RecordWasteInput = z.infer<typeof recordWasteSchema>;

export const stockCountLineSchema = z.object({
  itemId: z.string().uuid(),
  countedStock: z.number().nonnegative('Counted stock cannot be negative'),
});
export type StockCountLineInput = z.infer<typeof stockCountLineSchema>;

export const recordStockCountSchema = z.object({
  movementDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  note: z.string().trim().optional().nullable(),
  counts: z.array(stockCountLineSchema).min(1, 'At least one item must be counted'),
});
export type RecordStockCountInput = z.infer<typeof recordStockCountSchema>;

export const inventoryCsvImportRowSchema = z.object({
  name: z.string().trim().min(1),
  unit: z.enum(INVENTORY_UNITS).default('kg'),
  category: z.string().trim().default('General'),
  currentStock: z.number().nonnegative().default(0),
  reorderLevel: z.number().nonnegative().default(0),
  costPricePerUnit: z.number().nonnegative().default(0),
});
export type InventoryCsvImportRow = z.infer<typeof inventoryCsvImportRowSchema>;

export const commitInventoryCsvImportSchema = z.object({
  rows: z.array(inventoryCsvImportRowSchema).min(1, 'Must provide at least one valid row'),
});
export type CommitInventoryCsvImportInput = z.infer<typeof commitInventoryCsvImportSchema>;

// --- Output Types ---

export interface InventoryItemOutput {
  id: string;
  restaurantId: string;
  name: string;
  unit: InventoryUnit;
  category: string;
  currentStock: number;
  reorderLevel: number;
  active: boolean;
  lastPurchasePricePaisePerUnit: number;
  avgCostPaisePerUnit: number;
  status: 'ok' | 'low' | 'out';
  lastSupplierName?: string | null;
  lastPurchaseDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierOutput {
  id: string;
  restaurantId: string;
  name: string;
  phone: string | null;
  notes: string | null;
  active: boolean;
  totalPurchasesCount?: number;
  totalSpendPaise?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseLineOutput {
  id: string;
  purchaseId: string;
  itemId: string;
  itemName: string;
  itemUnit: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface PurchaseOutput {
  id: string;
  restaurantId: string;
  supplierId: string | null;
  supplierName?: string | null;
  purchaseDate: string;
  invoiceRef: string | null;
  totalPaise: number;
  paidStatus: 'paid' | 'unpaid';
  note: string | null;
  createdBy: string | null;
  createdByName?: string | null;
  lines: PurchaseLineOutput[];
  createdAt: string;
  updatedAt: string;
}

export interface StockMovementOutput {
  id: string;
  restaurantId: string;
  itemId: string;
  itemName?: string;
  itemUnit?: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  refPurchaseId: string | null;
  movementDate: string;
  costSnapshotPaisePerUnit: number;
  createdBy: string | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface StockCountSummaryOutput {
  itemId: string;
  itemName: string;
  unit: string;
  previousStock: number;
  countedStock: number;
  variance: number;
  impliedUsage: number;
  costImpactPaise: number;
}
