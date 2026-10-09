import { pgTable, uuid, text, timestamp, numeric, integer, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';

export const restaurantSettings = pgTable('restaurant_settings', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .unique()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  gstin: text('gstin'),
  taxMode: text('tax_mode').notNull().default('exclusive'),
  defaultGstRateBp: integer('default_gst_rate_bp').notNull().default(500),
  serviceChargePercent: numeric('service_charge_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('0.00'),
  billFooter: text('bill_footer').notNull().default('Thank you for dining with us!'),
  kitchenLateThresholdMinutes: integer('kitchen_late_threshold_minutes').notNull().default(15),
  kitchenOverdueThresholdMinutes: integer('kitchen_overdue_threshold_minutes')
    .notNull()
    .default(30),
  discountCapOwnerPercent: integer('discount_cap_owner_percent').notNull().default(100),
  discountCapManagerPercent: integer('discount_cap_manager_percent').notNull().default(25),
  discountCapCashierPercent: integer('discount_cap_cashier_percent').notNull().default(10),
  upiVpa: text('upi_vpa'),
  upiPayeeName: text('upi_payee_name'),
  receiptHeaderLines: text('receipt_header_lines')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  receiptFooterLines: text('receipt_footer_lines')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  receiptShowGstin: boolean('receipt_show_gstin').notNull().default(true),
  receiptShowCustomer: boolean('receipt_show_customer').notNull().default(true),
  receiptShowItemNotes: boolean('receipt_show_item_notes').notNull().default(false),
  receiptShowServiceCharge: boolean('receipt_show_service_charge').notNull().default(true),
  receiptShowQr: boolean('receipt_show_qr').notNull().default(true),
  rupeeSymbolMode: text('rupee_symbol_mode').notNull().default('text_rs'),
  customerPreferenceTags: text('customer_preference_tags')
    .array()
    .notNull()
    .default(
      sql`ARRAY['Less spicy', 'Extra spicy', 'No onion', 'No garlic', 'Jain', 'Vegan', 'Gluten free']::text[]`,
    ),
  segmentRegularMinVisits: integer('segment_regular_min_visits').notNull().default(4),
  segmentHighValueMinSpentPaise: integer('segment_high_value_min_spent_paise')
    .notNull()
    .default(500000),
  segmentInactiveDays: integer('segment_inactive_days').notNull().default(45),
  customerConsentWording: text('customer_consent_wording')
    .notNull()
    .default(
      'I agree to store contact details and dining preferences to personalize future orders.',
    ),
  businessDayStartHour: integer('business_day_start_hour').notNull().default(5),
  cashTolerancePaise: integer('cash_tolerance_paise').notNull().default(0),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const kitchens = pgTable('kitchens', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Main Kitchen'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
