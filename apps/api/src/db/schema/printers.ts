import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';
import { bills } from './bills.js';
import { users } from './users.js';

export const printerConfigurations = pgTable('printer_configurations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  transport: text('transport').notNull(), // 'bluetooth', 'usb', 'lan', 'browser'
  address: text('address').notNull().default(''),
  widthMm: integer('width_mm').notNull().default(80),
  codepage: text('codepage').notNull().default('CP437'),
  charsPerLine: integer('chars_per_line').notNull().default(48),
  autoCut: boolean('auto_cut').notNull().default(true),
  drawerPulse: boolean('drawer_pulse').notNull().default(false),
  isDefault: boolean('is_default').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const printJobs = pgTable('print_jobs', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  billId: uuid('bill_id')
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  printerId: uuid('printer_id').references(() => printerConfigurations.id, {
    onDelete: 'set null',
  }),
  jobType: text('job_type').notNull().default('bill'), // 'bill', 'reprint', 'duplicate', 'test'
  status: text('status').notNull().default('queued'), // 'queued', 'printing', 'printed', 'failed'
  attempts: integer('attempts').notNull().default(0),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const printEvents = pgTable('print_events', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  billId: uuid('bill_id')
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  type: text('type').notNull(), // 'print', 'reprint', 'duplicate', 'test'
  printerId: uuid('printer_id').references(() => printerConfigurations.id, {
    onDelete: 'set null',
  }),
  result: text('result').notNull(), // 'success', 'failed'
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
