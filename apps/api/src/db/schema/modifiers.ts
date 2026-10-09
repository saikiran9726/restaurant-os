import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';

export const modifierGroups = pgTable('modifier_groups', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  minSelections: integer('min_selections').notNull().default(0),
  maxSelections: integer('max_selections').notNull().default(1),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const modifiers = pgTable('modifiers', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  modifierGroupId: uuid('modifier_group_id')
    .notNull()
    .references(() => modifierGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  priceDeltaPaise: integer('price_delta_paise').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
