import {
  pgTable,
  uuid,
  text,
  bigserial,
  bigint,
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

export const deviceRegistry = pgTable(
  'device_registry',
  {
    id: text('id').primaryKey(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role').notNull().default('waiter'),
    appVersion: text('app_version'),
    lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_device_registry_restaurant_role').on(table.restaurantId, table.role)],
);

export const hubRegistry = pgTable(
  'hub_registry',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    name: text('name').notNull().default('Restaurant Local Hub'),
    hostAddress: text('host_address').notNull(),
    apiKeyHash: text('api_key_hash').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }).defaultNow().notNull(),
    lastSyncedSeq: bigint('last_synced_seq', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('uq_hub_registry_restaurant').on(table.restaurantId)],
);

export const syncEvents = pgTable(
  'sync_events',
  {
    seq: bigserial('seq', { mode: 'number' }).primaryKey(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    commandId: text('command_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    serverTimestamp: timestamp('server_timestamp', { withTimezone: true }).defaultNow().notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_sync_events_restaurant_seq').on(table.restaurantId, table.seq),
    unique('uq_sync_events_restaurant_idempotency').on(table.restaurantId, table.idempotencyKey),
  ],
);

export const syncCursors = pgTable(
  'sync_cursors',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    peerId: text('peer_id').notNull(),
    lastSeq: bigint('last_seq', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('uq_sync_cursors_restaurant_peer').on(table.restaurantId, table.peerId)],
);

export const deadLetterCommands = pgTable(
  'dead_letter_commands',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    commandId: text('command_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    deviceId: text('device_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    errorMessage: text('error_message').notNull(),
    attempts: integer('attempts').notNull().default(1),
    status: text('status').notNull().default('dead_letter'), // 'dead_letter' | 'replayed' | 'discarded'
    discardReason: text('discard_reason'),
    discardedBy: uuid('discarded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_dead_letter_restaurant_status').on(table.restaurantId, table.status)],
);

export const conflictReviews = pgTable(
  'conflict_reviews',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'duplicate_payment' | 'table_collision' | 'order_concurrent_edit'
    referenceId: text('reference_id').notNull(),
    severity: text('severity').notNull().default('warning'),
    details: jsonb('details').notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'resolved' | 'acknowledged'
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolutionNote: text('resolution_note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_conflict_reviews_restaurant_status').on(table.restaurantId, table.status)],
);
