import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  unique,
  jsonb,
  bigint,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';
import { users } from './users.js';

export const dailySummaries = pgTable(
  'daily_summaries',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    businessDate: text('business_date').notNull(),
    status: text('status').notNull().default('closed'), // 'closed' | 'reopened'
    grossSalesPaise: bigint('gross_sales_paise', { mode: 'number' }).notNull().default(0),
    netSalesPaise: bigint('net_sales_paise', { mode: 'number' }).notNull().default(0),
    discountsPaise: bigint('discounts_paise', { mode: 'number' }).notNull().default(0),
    taxCollectedPaise: bigint('tax_collected_paise', { mode: 'number' }).notNull().default(0),
    serviceChargePaise: bigint('service_charge_paise', { mode: 'number' }).notNull().default(0),
    roundOffPaise: bigint('round_off_paise', { mode: 'number' }).notNull().default(0),
    billsCount: integer('bills_count').notNull().default(0),
    ordersCount: integer('orders_count').notNull().default(0),
    cancelledBillsCount: integer('cancelled_bills_count').notNull().default(0),
    refundsPaise: bigint('refunds_paise', { mode: 'number' }).notNull().default(0),
    cashSalesPaise: bigint('cash_sales_paise', { mode: 'number' }).notNull().default(0),
    upiSalesPaise: bigint('upi_sales_paise', { mode: 'number' }).notNull().default(0),
    cardSalesPaise: bigint('card_sales_paise', { mode: 'number' }).notNull().default(0),
    openingCashPaise: bigint('opening_cash_paise', { mode: 'number' }).notNull().default(0),
    openingCashEdited: boolean('opening_cash_edited').notNull().default(false),
    openingCashEditReason: text('opening_cash_edit_reason'),
    cashExpensesPaise: bigint('cash_expenses_paise', { mode: 'number' }).notNull().default(0),
    cashRefundsPaise: bigint('cash_refunds_paise', { mode: 'number' }).notNull().default(0),
    expectedCashPaise: bigint('expected_cash_paise', { mode: 'number' }).notNull().default(0),
    actualCashPaise: bigint('actual_cash_paise', { mode: 'number' }).notNull().default(0),
    cashDifferencePaise: bigint('cash_difference_paise', { mode: 'number' }).notNull().default(0),
    cashDifferenceNote: text('cash_difference_note'),
    unresolvedItems: jsonb('unresolved_items')
      .notNull()
      .default(sql`'[]'::jsonb`),
    denominations: jsonb('denominations'),
    closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
    closedAt: timestamp('closed_at', { withTimezone: true }).defaultNow().notNull(),
    locked: boolean('locked').notNull().default(true),
    reopenedAt: timestamp('reopened_at', { withTimezone: true }),
    reopenedBy: uuid('reopened_by').references(() => users.id, { onDelete: 'set null' }),
    reopenReason: text('reopen_reason'),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uqRestaurantDate: unique('uq_daily_summaries_restaurant_date').on(
      table.restaurantId,
      table.businessDate,
    ),
  }),
);

export { expenses } from './expenses.js';
