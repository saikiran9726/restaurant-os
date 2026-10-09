-- Migration 0008 Down

ALTER TABLE restaurant_settings
  DROP COLUMN IF EXISTS customer_consent_wording,
  DROP COLUMN IF EXISTS segment_inactive_days,
  DROP COLUMN IF EXISTS segment_high_value_min_spent_paise,
  DROP COLUMN IF EXISTS segment_regular_min_visits,
  DROP COLUMN IF EXISTS customer_preference_tags;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS fk_orders_customer;

DROP TABLE IF EXISTS customers CASCADE;
