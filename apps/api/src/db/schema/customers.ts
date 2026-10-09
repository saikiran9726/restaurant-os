import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  bigint,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';

export const customers = pgTable('customers', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name'),
  phone: text('phone').notNull(),
  email: text('email'),
  birthday: text('birthday'), // Stored as YYYY-MM-DD
  preferences: jsonb('preferences')
    .notNull()
    .default(sql`'{"tags": [], "note": ""}'::jsonb`),
  consentRecorded: boolean('consent_recorded').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastVisitAt: timestamp('last_visit_at', { withTimezone: true }),
  visitCount: integer('visit_count').notNull().default(0),
  totalSpentPaise: bigint('total_spent_paise', { mode: 'number' }).notNull().default(0),
  notes: text('notes'),
});
