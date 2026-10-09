import {
  pgTable,
  uuid,
  text,
  bigint,
  numeric,
  boolean,
  timestamp,
  date,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { restaurants } from './restaurants.js';
import { users } from './users.js';

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone'),
    notes: text('notes'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('uq_suppliers_restaurant_name').on(table.restaurantId, table.name),
    index('idx_suppliers_restaurant_active').on(table.restaurantId, table.active),
  ],
);

export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    unit: text('unit').notNull().default('kg'),
    category: text('category').notNull().default('General'),
    currentStock: numeric('current_stock', { precision: 12, scale: 3 }).notNull().default('0.000'),
    reorderLevel: numeric('reorder_level', { precision: 12, scale: 3 }).notNull().default('0.000'),
    active: boolean('active').notNull().default(true),
    lastPurchasePricePaisePerUnit: bigint('last_purchase_price_paise_per_unit', {
      mode: 'number',
    })
      .notNull()
      .default(0),
    avgCostPaisePerUnit: bigint('avg_cost_paise_per_unit', {
      mode: 'number',
    })
      .notNull()
      .default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('uq_inventory_items_restaurant_lower_name').on(table.restaurantId, table.name),
    index('idx_inventory_items_restaurant_active').on(table.restaurantId, table.active),
    index('idx_inventory_items_restaurant_stock').on(
      table.restaurantId,
      table.currentStock,
      table.reorderLevel,
    ),
  ],
);

export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id').references(() => suppliers.id, {
      onDelete: 'set null',
    }),
    purchaseDate: date('purchase_date').notNull().defaultNow(),
    invoiceRef: text('invoice_ref'),
    totalPaise: bigint('total_paise', { mode: 'number' }).notNull().default(0),
    paidStatus: text('paid_status').notNull().default('unpaid'), // 'paid' | 'unpaid'
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_purchases_restaurant_date').on(table.restaurantId, table.purchaseDate),
    index('idx_purchases_supplier').on(table.supplierId),
  ],
);

export const purchaseLines = pgTable(
  'purchase_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseId: uuid('purchase_id')
      .notNull()
      .references(() => purchases.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
    unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull(),
    lineTotalPaise: bigint('line_total_paise', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_purchase_lines_purchase').on(table.purchaseId),
    index('idx_purchase_lines_item').on(table.itemId),
  ],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'purchase' | 'usage' | 'waste' | 'adjustment' | 'stock_count'
    quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
    reason: text('reason').notNull(),
    refPurchaseId: uuid('ref_purchase_id').references(() => purchases.id, {
      onDelete: 'set null',
    }),
    movementDate: date('movement_date').notNull().defaultNow(),
    costSnapshotPaisePerUnit: bigint('cost_snapshot_paise_per_unit', {
      mode: 'number',
    })
      .notNull()
      .default(0),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_stock_movements_item_date').on(table.itemId, table.movementDate),
    index('idx_stock_movements_restaurant_date').on(table.restaurantId, table.movementDate),
    index('idx_stock_movements_ref_purchase').on(table.refPurchaseId),
  ],
);
