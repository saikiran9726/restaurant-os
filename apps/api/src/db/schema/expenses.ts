import {
  pgTable,
  uuid,
  text,
  bigint,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  integer,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';
import { users } from './users.js';

export const expenseCategories = pgTable(
  'expense_categories',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    countsAsOperating: boolean('counts_as_operating').notNull().default(true),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_expense_categories_restaurant_name').on(table.restaurantId, table.name),
    index('idx_expense_categories_restaurant_active').on(table.restaurantId, table.active),
  ],
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => expenseCategories.id, {
      onDelete: 'set null',
    }),
    businessDate: text('business_date').notNull(), // Preserves Phase 11 day close integration
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
    category: text('category').notNull().default('supplies'), // Preserves backward compatibility
    date: timestamp('date', { withTimezone: true }).defaultNow().notNull(),
    expenseDate: date('expense_date').defaultNow().notNull(),
    month: text('month')
      .notNull()
      .default(sql`to_char(CURRENT_DATE, 'YYYY-MM')`),
    description: text('description').notNull().default('Expense'),
    reference: text('reference'),
    paymentSource: text('payment_source').notNull().default('till'), // 'till' | 'bank' | 'upi' | 'other'
    note: text('note'),
    paidFromTill: boolean('paid_from_till').notNull().default(true),
    edited: boolean('edited').notNull().default(false),
    lastEditReason: text('last_edit_reason'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_expenses_restaurant_business_date').on(table.restaurantId, table.businessDate),
    index('idx_expenses_category').on(table.categoryId),
    index('idx_expenses_expense_date').on(table.restaurantId, table.expenseDate),
    index('idx_expenses_month').on(table.restaurantId, table.month),
  ],
);

export const monthlyEvaluations = pgTable(
  'monthly_evaluations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    month: text('month').notNull(), // YYYY-MM
    version: integer('version').notNull().default(1),
    revenuePaise: bigint('revenue_paise', { mode: 'number' }).notNull().default(0),
    suppliesCostPaise: bigint('supplies_cost_paise', { mode: 'number' }).notNull().default(0),
    suppliesMethod: text('supplies_method').notNull().default('purchases'),
    operatingExpensesPaise: bigint('operating_expenses_paise', { mode: 'number' })
      .notNull()
      .default(0),
    estimatedProfitPaise: bigint('estimated_profit_paise', { mode: 'number' }).notNull().default(0),
    profitMarginPercent: numeric('profit_margin_percent', { precision: 5, scale: 2 }),
    completenessPercent: integer('completeness_percent').notNull().default(0),
    inputs: jsonb('inputs')
      .notNull()
      .default(sql`'{}'::jsonb`),
    outputs: jsonb('outputs')
      .notNull()
      .default(sql`'{}'::jsonb`),
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_monthly_evaluations_restaurant_month_version').on(
      table.restaurantId,
      table.month,
      table.version,
    ),
    index('idx_monthly_evaluations_restaurant_month').on(table.restaurantId, table.month),
  ],
);
