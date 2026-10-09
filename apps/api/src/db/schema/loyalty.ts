import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';
import { customers } from './customers.js';
import { bills } from './bills.js';
import { users } from './users.js';

export const loyaltySettings = pgTable('loyalty_settings', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .unique()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  spendPaisePerBlock: integer('spend_paise_per_block').notNull().default(10000), // ₹100
  pointsPerBlock: integer('points_per_block').notNull().default(5),
  redeemPointsBlock: integer('redeem_points_block').notNull().default(500),
  redeemValuePaise: integer('redeem_value_paise').notNull().default(5000), // ₹50
  minRedeemPoints: integer('min_redeem_points').notNull().default(500),
  maxRedeemPercentOfBill: integer('max_redeem_percent_of_bill').notNull().default(50),
  pointsExpiryDays: integer('points_expiry_days'),
  earnOnDiscountedAmount: boolean('earn_on_discounted_amount').notNull().default(false),
  newAccountCooldownHours: integer('new_account_cooldown_hours').notNull().default(24),
  perDayRedeemCapPoints: integer('per_day_redeem_cap_points').notNull().default(5000),
  tiers: jsonb('tiers').notNull().default(sql`'[
    {"name": "Silver", "thresholdSpendPaise": 0, "earnMultiplier": 1},
    {"name": "Gold", "thresholdSpendPaise": 500000, "earnMultiplier": 1.25},
    {"name": "Platinum", "thresholdSpendPaise": 1500000, "earnMultiplier": 1.5}
  ]'::jsonb`),
  visitReward: jsonb('visit_reward')
    .notNull()
    .default(sql`'{"enabled": false, "everyNVisits": 5, "bonusPoints": 100}'::jsonb`),
  birthdayReward: jsonb('birthday_reward')
    .notNull()
    .default(sql`'{"enabled": false, "bonusPoints": 200, "minDaysRegistered": 30}'::jsonb`),
  referralReward: jsonb('referral_reward')
    .notNull()
    .default(
      sql`'{"enabled": false, "referrerBonusPoints": 100, "refereeBonusPoints": 50, "minBillPaiseToQualify": 20000, "maxReferralsPerReferrer": 5}'::jsonb`,
    ),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const loyaltyAccounts = pgTable('loyalty_accounts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .unique()
    .references(() => customers.id, { onDelete: 'cascade' }),
  pointsBalance: integer('points_balance').notNull().default(0),
  tier: text('tier').notNull().default('Silver'),
  lifetimePoints: integer('lifetime_points').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const loyaltyTransactions = pgTable(
  'loyalty_transactions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => loyaltyAccounts.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'earn' | 'redeem' | 'reversal' | 'adjust' | 'expire' | 'bonus'
    points: integer('points').notNull(),
    billId: uuid('bill_id').references(() => bills.id, { onDelete: 'set null' }),
    reason: text('reason'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uqBillType: unique('uq_loyalty_tx_bill_type').on(table.billId, table.type),
  }),
);

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  pointsRequired: integer('points_required').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
