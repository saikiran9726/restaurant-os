import { pgTable, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';
import { tables } from './tables.js';
import { users } from './users.js';
import { menuItems } from './menu-items.js';

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey(), // Client generated UUIDv7
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  tableId: uuid('table_id').references(() => tables.id, { onDelete: 'set null' }),
  type: text('type').notNull().default('dine_in'), // 'dine_in' | 'takeaway'
  guests: integer('guests').notNull().default(2),
  status: text('status').notNull().default('open'), // 'open' | 'saved' | 'billed' | 'cancelled'
  customerId: uuid('customer_id'),
  specialInstructions: text('special_instructions'),
  subtotalPaise: integer('subtotal_paise').notNull().default(0),
  taxPaise: integer('tax_paise').notNull().default(0),
  totalPaise: integer('total_paise').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id')
    .notNull()
    .references(() => menuItems.id, { onDelete: 'restrict' }),
  nameSnapshot: text('name_snapshot').notNull(),
  pricePaiseSnapshot: integer('price_paise_snapshot').notNull(),
  taxRateBpSnapshot: integer('tax_rate_bp_snapshot').notNull().default(500),
  qty: integer('qty').notNull().default(1),
  modifiers: jsonb('modifiers')
    .notNull()
    .default(sql`'[]'::jsonb`),
  note: text('note'),
  status: text('status').notNull().default('active'), // 'active' | 'cancelled'
  cancelledReason: text('cancelled_reason'),
  kotState: text('kot_state').notNull().default('unsent'), // 'unsent' | 'sent' | 'updated'
  lineNo: integer('line_no').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const syncCommands = pgTable('sync_commands', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  commandType: text('command_type').notNull(),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
