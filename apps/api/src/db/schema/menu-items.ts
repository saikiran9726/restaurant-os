import { pgTable, uuid, text, timestamp, boolean, integer, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';
import { menuCategories } from './menu-categories.js';
import { modifierGroups } from './modifiers.js';
import { users } from './users.js';

export const menuItems = pgTable('menu_items', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => menuCategories.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  aliases: text('aliases')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  isVeg: boolean('is_veg').notNull().default(true),
  pricePaise: integer('price_paise').notNull(),
  taxRateBp: integer('tax_rate_bp').notNull().default(500),
  available: boolean('available').notNull().default(true),
  oosReason: text('oos_reason'),
  oosSetBy: uuid('oos_set_by').references(() => users.id, { onDelete: 'set null' }),
  oosSetAt: timestamp('oos_set_at', { withTimezone: true }),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const itemModifierGroups = pgTable(
  'item_modifier_groups',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    modifierGroupId: uuid('modifier_group_id')
      .notNull()
      .references(() => modifierGroups.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.itemId, table.modifierGroupId] }),
  }),
);
