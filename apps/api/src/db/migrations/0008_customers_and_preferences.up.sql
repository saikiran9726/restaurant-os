-- Migration 0008: Customers, Preferences, Visit Memory, and Configurable Segments

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  birthday DATE,
  preferences JSONB NOT NULL DEFAULT '{"tags": [], "note": ""}'::jsonb,
  consent_recorded BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_visit_at TIMESTAMPTZ,
  visit_count INTEGER NOT NULL DEFAULT 0,
  total_spent_paise BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  CONSTRAINT uq_customers_restaurant_phone UNIQUE (restaurant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_restaurant_phone ON customers(restaurant_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_last_visit ON customers(restaurant_id, last_visit_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_spent ON customers(restaurant_id, total_spent_paise DESC);

-- 2. Link orders.customer_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_orders_customer'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT fk_orders_customer
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Extend restaurant_settings for Customer Preference Tags & Segment Rules
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS customer_preference_tags TEXT[] NOT NULL DEFAULT ARRAY['Less spicy', 'Extra spicy', 'No onion', 'No garlic', 'Jain', 'Vegan', 'Gluten free']::text[],
  ADD COLUMN IF NOT EXISTS segment_regular_min_visits INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS segment_high_value_min_spent_paise INTEGER NOT NULL DEFAULT 500000,
  ADD COLUMN IF NOT EXISTS segment_inactive_days INTEGER NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS customer_consent_wording TEXT NOT NULL DEFAULT 'I agree to store contact details and dining preferences to personalize future orders.';
