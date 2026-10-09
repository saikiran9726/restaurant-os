import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { restaurants } from './restaurants.js';
import { bills } from './bills.js';

export const paymentRequests = pgTable('payment_requests', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  billId: uuid('bill_id')
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  amountPaise: integer('amount_paise').notNull(),
  upiRef: text('upi_ref').notNull(),
  qrPayload: text('qr_payload').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'confirmed', 'expired', 'cancelled'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
