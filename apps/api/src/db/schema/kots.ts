import { pgTable, uuid, text, timestamp, integer, date, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';
import { users } from './users.js';
import { orders, orderItems } from './orders.js';

export const kotCounters = pgTable(
  'kot_counters',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    businessDate: date('business_date').notNull(),
    lastKotNumber: integer('last_kot_number').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uqRestaurantDate: unique('uq_kot_counter_restaurant_date').on(
      table.restaurantId,
      table.businessDate,
    ),
  }),
);

export const kots = pgTable('kots', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  kotNumber: integer('kot_number').notNull(),
  provisionalLabel: text('provisional_label'),
  type: text('type').notNull().default('new'), // 'new' | 'additional' | 'modified'
  status: text('status').notNull().default('new'), // 'new' | 'preparing' | 'ready' | 'served' | 'cancelled'
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  servedAt: timestamp('served_at', { withTimezone: true }),
  seenAt: timestamp('seen_at', { withTimezone: true }),
});

export const kotItems = pgTable('kot_items', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  kotId: uuid('kot_id')
    .notNull()
    .references(() => kots.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id')
    .notNull()
    .references(() => orderItems.id, { onDelete: 'cascade' }),
  qty: integer('qty').notNull().default(1),
  action: text('action').notNull().default('add'), // 'add' | 'cancel' | 'update'
  status: text('status').notNull().default('pending'), // 'pending' | 'done' | 'cancelled'
  noteSnapshot: text('note_snapshot'),
  doneAt: timestamp('done_at', { withTimezone: true }),
  cancelledReason: text('cancelled_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
