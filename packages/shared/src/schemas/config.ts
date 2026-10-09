import { z } from 'zod';

// ==========================================
// RESTAURANT PROFILE & SETTINGS
// ==========================================

export const taxModeSchema = z.enum(['inclusive', 'exclusive']);
export type TaxMode = z.infer<typeof taxModeSchema>;

export const restaurantSettingsSchema = z.object({
  id: z.string().uuid().optional(),
  restaurantId: z.string().uuid(),
  name: z.string().trim().min(1, 'Restaurant name is required').max(100),
  address: z.string().trim().max(300).default(''),
  phone: z.string().trim().max(20).default(''),
  gstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format')
    .or(z.literal(''))
    .optional(),
  taxMode: taxModeSchema.default('exclusive'),
  defaultGstRateBp: z.number().int().min(0).max(2800).default(500), // 500 bp = 5.00%
  serviceChargePercent: z.number().min(0).max(20).default(0), // e.g. 5%
  billFooter: z.string().trim().max(200).default('Thank you for dining with us!'),
  kitchenLateThresholdMinutes: z.number().int().min(1).max(60).default(15),
  kitchenOverdueThresholdMinutes: z.number().int().min(1).max(120).default(30),
  discountCapOwnerPercent: z.number().int().min(0).max(100).default(100),
  discountCapManagerPercent: z.number().int().min(0).max(100).default(25),
  discountCapCashierPercent: z.number().int().min(0).max(100).default(10),
  upiVpa: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}$/, 'Invalid UPI VPA format')
    .or(z.literal(''))
    .optional()
    .nullable(),
  upiPayeeName: z.string().trim().max(100).optional().nullable(),
  receiptHeaderLines: z.array(z.string()).default([]),
  receiptFooterLines: z.array(z.string()).default([]),
  receiptShowGstin: z.boolean().default(true),
  receiptShowCustomer: z.boolean().default(true),
  receiptShowItemNotes: z.boolean().default(false),
  receiptShowServiceCharge: z.boolean().default(true),
  receiptShowQr: z.boolean().default(true),
  rupeeSymbolMode: z.enum(['text_rs', 'symbol', 'image']).default('text_rs'),
  updatedAt: z.coerce.date().optional(),
});

export const updateRestaurantSettingsSchema = restaurantSettingsSchema.omit({
  id: true,
  restaurantId: true,
  updatedAt: true,
});

export type RestaurantSettings = z.infer<typeof restaurantSettingsSchema>;
export type UpdateRestaurantSettingsInput = z.infer<typeof updateRestaurantSettingsSchema>;

// ==========================================
// TABLES
// ==========================================

export const tableSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  label: z.string().trim().min(1, 'Table label is required').max(20),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(50).default(4),
  section: z.string().trim().max(50).default('Main Floor'),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const createTableSchema = z.object({
  label: z.string().trim().min(1, 'Table label is required').max(20),
  capacity: z.number().int().min(1).max(50).default(4),
  section: z.string().trim().max(50).default('Main Floor'),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateTableSchema = createTableSchema.partial();

export type TableModel = z.infer<typeof tableSchema>;
export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;

// ==========================================
// MENU CATEGORIES
// ==========================================

export const menuCategorySchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  name: z.string().trim().min(1, 'Category name is required').max(50),
  description: z.string().trim().max(200).optional(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true), // active=false means hidden
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const createMenuCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(50),
  description: z.string().trim().max(200).optional(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateMenuCategorySchema = createMenuCategorySchema.partial();

export const reorderCategoriesSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1),
});

export type MenuCategory = z.infer<typeof menuCategorySchema>;
export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;

// ==========================================
// MODIFIER GROUPS & MODIFIERS
// ==========================================

export const modifierOptionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Option name is required').max(50),
  priceDeltaPaise: z.number().int().default(0), // Can be positive or 0
  sortOrder: z.number().int().default(0),
});

export const modifierGroupSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  name: z.string().trim().min(1, 'Group name is required').max(50),
  description: z.string().trim().max(200).optional(),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(1).default(1),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  options: z.array(modifierOptionSchema).default([]),
});

export const createModifierGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(50),
  description: z.string().trim().max(200).optional(),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(1).default(1),
  sortOrder: z.number().int().default(0),
  options: z.array(modifierOptionSchema).default([]),
});

export const updateModifierGroupSchema = createModifierGroupSchema.partial();

export type ModifierOption = z.infer<typeof modifierOptionSchema>;
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;
export type CreateModifierGroupInput = z.infer<typeof createModifierGroupSchema>;
export type UpdateModifierGroupInput = z.infer<typeof updateModifierGroupSchema>;

// ==========================================
// MENU ITEMS
// ==========================================

export const menuItemSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1, 'Item name is required').max(100),
  aliases: z.array(z.string().trim().min(1)).default([]),
  isVeg: z.boolean().default(true),
  pricePaise: z.number().int().min(0, 'Price must be non-negative'),
  taxRateBp: z.number().int().min(0).max(2800).default(500), // 500 bp = 5.00%
  available: z.boolean().default(true),
  oosReason: z.string().trim().max(100).nullable().optional(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  version: z.number().int().default(1),
  modifierGroupIds: z.array(z.string().uuid()).default([]),
  categoryName: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const createMenuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1, 'Item name is required').max(100),
  aliases: z.array(z.string().trim().min(1)).default([]),
  isVeg: z.boolean().default(true),
  pricePaise: z.number().int().min(0, 'Price must be non-negative'),
  taxRateBp: z.number().int().min(0).max(2800).default(500),
  available: z.boolean().default(true),
  oosReason: z.string().trim().max(100).nullable().optional(),
  sortOrder: z.number().int().default(0),
  modifierGroupIds: z.array(z.string().uuid()).default([]),
});

export const updateMenuItemSchema = createMenuItemSchema.partial().extend({
  version: z.number().int().optional(), // Optimistic concurrency check
  active: z.boolean().optional(),
});

export const bulkVegToggleSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  isVeg: z.boolean(),
});

export const reorderItemsSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
});

export type MenuItem = z.infer<typeof menuItemSchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

// ==========================================
// CSV IMPORT / EXPORT
// ==========================================

export const csvImportRowSchema = z.object({
  category: z.string().trim().min(1, 'Category is required'),
  name: z.string().trim().min(1, 'Name is required'),
  vegNonVeg: z
    .string()
    .trim()
    .transform((val) => {
      const lower = val.toLowerCase();
      return lower === 'veg' || lower === 'v' || lower === 'true' || lower === 'yes';
    }),
  price: z
    .string()
    .trim()
    .transform((val) => {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0) {
        throw new Error(`Invalid price: ${val}`);
      }
      return Math.round(num * 100); // convert rupees to paise
    }),
  aliases: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return [];
      return val
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
    }),
  modifierGroups: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return [];
      return val
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
    }),
});

export interface CsvImportRowResult {
  rowNumber: number;
  data: {
    category: string;
    name: string;
    isVeg: boolean;
    pricePaise: number;
    aliases: string[];
    modifierGroups: string[];
  };
  errors: string[];
  isValid: boolean;
}

export interface CsvImportPreviewResponse {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: CsvImportRowResult[];
}

export const commitCsvImportSchema = z.object({
  dryRun: z.boolean().default(false),
  csvContent: z.string().min(1, 'CSV content cannot be empty'),
});
