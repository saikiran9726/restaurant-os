import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';
import { users } from './users.js';
import type {
  HealthModelWeights,
  HealthModelTargets,
  HealthFactorEvaluation,
  HealthScoreReasonForChange,
  HealthImprovementSuggestion,
} from '@restaurant-os/shared';

export const healthModels = pgTable(
  'health_models',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(1),
    windowDays: integer('window_days').notNull().default(30),
    weights: jsonb('weights').$type<HealthModelWeights>().notNull(),
    targets: jsonb('targets').$type<HealthModelTargets>().notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_health_models_restaurant_version').on(table.restaurantId, table.version),
    index('idx_health_models_restaurant_version').on(table.restaurantId, table.version),
  ],
);

export const healthSnapshots = pgTable(
  'health_snapshots',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    snapshotDate: date('snapshot_date').notNull(),
    modelVersion: integer('model_version').notNull().default(1),
    overallScore: integer('overall_score'), // null if insufficient data
    scoreBand: text('score_band').notNull().default('insufficient_data'),
    confidence: text('confidence').notNull().default('low'),
    factorsUsed: integer('factors_used').notNull().default(0),
    totalFactors: integer('total_factors').notNull().default(8),
    factorScores: jsonb('factor_scores').$type<HealthFactorEvaluation[]>().notNull().default([]),
    reasonsForChange: jsonb('reasons_for_change')
      .$type<HealthScoreReasonForChange[]>()
      .notNull()
      .default([]),
    suggestions: jsonb('suggestions').$type<HealthImprovementSuggestion[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_health_snapshots_restaurant_date').on(table.restaurantId, table.snapshotDate),
    index('idx_health_snapshots_restaurant_date').on(table.restaurantId, table.snapshotDate),
  ],
);
