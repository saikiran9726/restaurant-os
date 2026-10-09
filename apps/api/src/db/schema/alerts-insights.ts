import {
  pgTable,
  uuid,
  text,
  bigint,
  numeric,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';
import { users } from './users.js';
import type {
  AlertType,
  AlertSeverity,
  AlertStatus,
  AlertItemPayload,
  InsightKind,
  InsightPeriod,
  InsightEvidence,
} from '@restaurant-os/shared';

export const alertSettings = pgTable(
  'alert_settings',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    cashMismatchTolerancePaise: bigint('cash_mismatch_tolerance_paise', { mode: 'number' })
      .notNull()
      .default(5000),
    highExpenseMultiplier: numeric('high_expense_multiplier', { precision: 4, scale: 2 })
      .notNull()
      .default('1.50'),
    highExpenseMinAmountPaise: bigint('high_expense_min_amount_paise', { mode: 'number' })
      .notNull()
      .default(500000),
    upiPendingTimeoutHours: numeric('upi_pending_timeout_hours', { precision: 4, scale: 1 })
      .notNull()
      .default('2.0'),
    profitDeclinePointsThreshold: numeric('profit_decline_points_threshold', {
      precision: 4,
      scale: 1,
    })
      .notNull()
      .default('5.0'),
    regularCustomerInactiveDays: integer('regular_customer_inactive_days').notNull().default(30),
    enabledAlerts: jsonb('enabled_alerts').$type<Record<AlertType, boolean>>().notNull().default({
      cash_mismatch: true,
      low_stock: true,
      high_expense: true,
      payment_reconciliation: true,
      profit_decline: true,
    }),
    enabledInsights: jsonb('enabled_insights')
      .$type<Record<InsightKind, boolean>>()
      .notNull()
      .default({
        sales_change: true,
        top_seller: true,
        supply_cost_change: true,
        margin_change: true,
        unreturned_regulars: true,
        consumption_change: true,
      }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('uq_alert_settings_restaurant').on(table.restaurantId)],
);

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    type: text('type').$type<AlertType>().notNull(),
    severity: text('severity').$type<AlertSeverity>().notNull().default('warning'),
    dedupeKey: text('dedupe_key').notNull(),
    payload: jsonb('payload').$type<AlertItemPayload>().notNull(),
    firstSeen: timestamp('first_seen', { withTimezone: true }).defaultNow().notNull(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
    status: text('status').$type<AlertStatus>().notNull().default('open'),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    dismissReason: text('dismiss_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_alerts_restaurant_status_severity').on(
      table.restaurantId,
      table.status,
      table.severity,
    ),
  ],
);

export const insights = pgTable(
  'insights',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    period: text('period').$type<InsightPeriod>().notNull().default('daily'),
    kind: text('kind').$type<InsightKind>().notNull(),
    text: text('text').notNull(),
    evidence: jsonb('evidence').$type<InsightEvidence>().notNull().default({
      metricName: '',
      currentValue: '',
      details: {},
    }),
    materialityScore: integer('materiality_score').notNull().default(50),
    dismissed: boolean('dismissed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_insights_restaurant_dismissed').on(
      table.restaurantId,
      table.dismissed,
      table.createdAt,
    ),
  ],
);
