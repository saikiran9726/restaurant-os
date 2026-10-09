import { pgTable, uuid, text, timestamp, integer, date, unique, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';
import { users } from './users.js';
import { orders, orderItems } from './orders.js';
import { menuItems } from './menu-items.js';

export const billCounters = pgTable(
  'bill_counters',
  {
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    lastNumber: integer('last_number').notNull().default(0),
  },
  (table) => ({
    pk: unique('uq_bill_counter_restaurant_date').on(table.restaurantId, table.date),
  }),
);

export const bills = pgTable(
  'bills',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    billNumber: text('bill_number').notNull(),
    subtotalPaise: integer('subtotal_paise').notNull(),
    discountPaise: integer('discount_paise').notNull().default(0),
    discountType: text('discount_type'), // 'percent' | 'flat' | null
    discountValue: integer('discount_value'),
    discountReason: text('discount_reason'),
    loyaltyPointsRedeemed: integer('loyalty_points_redeemed').notNull().default(0),
    loyaltyDiscountPaise: integer('loyalty_discount_paise').notNull().default(0),
    serviceChargePaise: integer('service_charge_paise').notNull().default(0),
    taxPaise: integer('tax_paise').notNull().default(0),
    roundOffPaise: integer('round_off_paise').notNull().default(0),
    totalPaise: integer('total_paise').notNull(),
    status: text('status').notNull().default('unpaid'), // 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'cancelled' | 'refunded'
    paidAt: timestamp('paid_at', { withTimezone: true }),
    printedCount: integer('printed_count').notNull().default(0),
    businessDate: text('business_date'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uqRestaurantNumber: unique('uq_bills_restaurant_number').on(
      table.restaurantId,
      table.billNumber,
    ),
  }),
);

export const billLines = pgTable('bill_lines', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  billId: uuid('bill_id')
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id').references(() => orderItems.id, { onDelete: 'set null' }),
  itemId: uuid('item_id')
    .notNull()
    .references(() => menuItems.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  qty: integer('qty').notNull(),
  pricePaise: integer('price_paise').notNull(),
  subtotalPaise: integer('subtotal_paise').notNull(),
  discountPaise: integer('discount_paise').notNull().default(0),
  taxablePaise: integer('taxable_paise').notNull().default(0),
  taxRateBp: integer('tax_rate_bp').notNull().default(0),
  taxPaise: integer('tax_paise').notNull().default(0),
  cgstPaise: integer('cgst_paise').notNull().default(0),
  sgstPaise: integer('sgst_paise').notNull().default(0),
  modifiers: jsonb('modifiers')
    .notNull()
    .default(sql`'[]'::jsonb`),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  billId: uuid('bill_id')
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  method: text('method').notNull(), // 'cash' | 'upi' | 'card'
  amountPaise: integer('amount_paise').notNull(),
  tenderedPaise: integer('tendered_paise'),
  changePaise: integer('change_paise'),
  status: text('status').notNull(), // 'recorded' | 'pending_confirmation' | 'confirmed' | 'failed' | 'reversed'
  reference: text('reference'),
  businessDate: text('business_date'),
  confirmedBy: uuid('confirmed_by').references(() => users.id, { onDelete: 'set null' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const refunds = pgTable('refunds', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  billId: uuid('bill_id')
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  amountPaise: integer('amount_paise').notNull(),
  method: text('method').notNull(), // 'cash' | 'upi' | 'card'
  reason: text('reason').notNull(),
  approvedBy: uuid('approved_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
