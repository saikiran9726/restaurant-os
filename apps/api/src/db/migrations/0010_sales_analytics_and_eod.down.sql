-- Migration 0010 down: Revert sales analytics, daily summaries, and minimal expenses

DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS daily_summaries CASCADE;

ALTER TABLE restaurant_settings DROP COLUMN IF EXISTS timezone;
ALTER TABLE restaurant_settings DROP COLUMN IF EXISTS cash_tolerance_paise;
ALTER TABLE restaurant_settings DROP COLUMN IF EXISTS business_day_start_hour;

DROP INDEX IF EXISTS idx_payments_restaurant_business_date_method;
DROP INDEX IF EXISTS idx_bills_restaurant_business_date;

ALTER TABLE payments DROP COLUMN IF EXISTS business_date;
ALTER TABLE bills DROP COLUMN IF EXISTS business_date;
