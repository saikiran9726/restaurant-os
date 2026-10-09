-- Migration 0010: Sales Analytics & End-of-Day Closing (EOD) with Cash Reconciliation

-- 1. Add business_date to bills
ALTER TABLE bills ADD COLUMN IF NOT EXISTS business_date TEXT;
CREATE INDEX IF NOT EXISTS idx_bills_restaurant_business_date ON bills (restaurant_id, business_date);

-- 2. Add business_date to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS business_date TEXT;
CREATE INDEX IF NOT EXISTS idx_payments_restaurant_business_date_method ON payments (restaurant_id, business_date, method);

-- 3. Backfill business_date for existing rows using Asia/Kolkata (UTC + 5:30) with 5:00 AM shift
UPDATE bills
SET business_date = to_char((created_at AT TIME ZONE 'Asia/Kolkata') - interval '5 hours', 'YYYY-MM-DD')
WHERE business_date IS NULL;

UPDATE payments
SET business_date = to_char((created_at AT TIME ZONE 'Asia/Kolkata') - interval '5 hours', 'YYYY-MM-DD')
WHERE business_date IS NULL;

-- 4. Alter restaurant_settings with business day & cash tolerance parameters
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS business_day_start_hour INTEGER NOT NULL DEFAULT 5;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS cash_tolerance_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- 5. Create daily_summaries table (locked snapshot per business date)
CREATE TABLE IF NOT EXISTS daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  business_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'closed',
  gross_sales_paise BIGINT NOT NULL DEFAULT 0,
  net_sales_paise BIGINT NOT NULL DEFAULT 0,
  discounts_paise BIGINT NOT NULL DEFAULT 0,
  tax_collected_paise BIGINT NOT NULL DEFAULT 0,
  service_charge_paise BIGINT NOT NULL DEFAULT 0,
  round_off_paise BIGINT NOT NULL DEFAULT 0,
  bills_count INTEGER NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  cancelled_bills_count INTEGER NOT NULL DEFAULT 0,
  refunds_paise BIGINT NOT NULL DEFAULT 0,
  cash_sales_paise BIGINT NOT NULL DEFAULT 0,
  upi_sales_paise BIGINT NOT NULL DEFAULT 0,
  card_sales_paise BIGINT NOT NULL DEFAULT 0,
  opening_cash_paise BIGINT NOT NULL DEFAULT 0,
  opening_cash_edited BOOLEAN NOT NULL DEFAULT false,
  opening_cash_edit_reason TEXT,
  cash_expenses_paise BIGINT NOT NULL DEFAULT 0,
  cash_refunds_paise BIGINT NOT NULL DEFAULT 0,
  expected_cash_paise BIGINT NOT NULL DEFAULT 0,
  actual_cash_paise BIGINT NOT NULL DEFAULT 0,
  cash_difference_paise BIGINT NOT NULL DEFAULT 0,
  cash_difference_note TEXT,
  unresolved_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  denominations JSONB,
  closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  locked BOOLEAN NOT NULL DEFAULT true,
  reopened_at TIMESTAMP WITH TIME ZONE,
  reopened_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reopen_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_daily_summaries_restaurant_date UNIQUE (restaurant_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_restaurant_date ON daily_summaries (restaurant_id, business_date);

-- 6. Minimal expenses table (for till cash payouts during shift)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  business_date TEXT NOT NULL,
  amount_paise BIGINT NOT NULL,
  category TEXT NOT NULL DEFAULT 'supplies',
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  note TEXT,
  paid_from_till BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_restaurant_business_date ON expenses (restaurant_id, business_date);
