-- Migration 0012: Expense Categories, Extended Expenses, and Monthly Evaluations

-- 1. Create expense_categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  counts_as_operating BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_expense_categories_restaurant_name UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_restaurant_active ON expense_categories (restaurant_id, active);

-- 2. Seed standard categories for all existing restaurants
INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Rent', 'Facility and kitchen space lease', true FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Salaries', 'Staff wages and payroll', true FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Electricity', 'Power utility bill', true FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Gas', 'Commercial LPG / pipeline gas', true FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Internet', 'Broadband and POS communications', true FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Maintenance', 'Kitchen equipment servicing and upkeep', true FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Cleaning', 'Detergents, hygiene and sanitation supplies', true FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Transport', 'Delivery logistics and fuel', true FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Marketing', 'Promotions and signage', true FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Repairs', 'Minor plumbing and electrical repairs', true FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Supplies (Direct)', 'Direct till kitchen supplies payouts', false FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO expense_categories (restaurant_id, name, description, counts_as_operating)
SELECT id, 'Other', 'Miscellaneous operational expense', true FROM restaurants
ON CONFLICT (restaurant_id, name) DO NOTHING;

-- 3. Extend expenses table
-- Add category_id, expense_date, month, description, reference, payment_source, edit tracking
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS month TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM');
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT 'Expense';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'till';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS last_edit_reason TEXT;

-- Backfill existing Phase 11 rows: map category text to newly seeded categories
UPDATE expenses e
SET
  category_id = ec.id,
  expense_date = COALESCE(e.date::date, CURRENT_DATE),
  month = to_char(COALESCE(e.date::date, CURRENT_DATE), 'YYYY-MM'),
  description = COALESCE(e.note, 'Till payout')
FROM expense_categories ec
WHERE e.restaurant_id = ec.restaurant_id
  AND ec.name = 'Supplies (Direct)'
  AND e.category_id IS NULL;

-- Indexes on expenses
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses (restaurant_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses (restaurant_id, month);

-- 4. Create monthly_evaluations table (snapshot storage)
CREATE TABLE IF NOT EXISTS monthly_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  revenue_paise BIGINT NOT NULL DEFAULT 0,
  supplies_cost_paise BIGINT NOT NULL DEFAULT 0,
  supplies_method TEXT NOT NULL DEFAULT 'purchases',
  operating_expenses_paise BIGINT NOT NULL DEFAULT 0,
  estimated_profit_paise BIGINT NOT NULL DEFAULT 0,
  profit_margin_percent NUMERIC(5, 2),
  completeness_percent INTEGER NOT NULL DEFAULT 0,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_monthly_evaluations_restaurant_month_version UNIQUE (restaurant_id, month, version)
);

CREATE INDEX IF NOT EXISTS idx_monthly_evaluations_restaurant_month ON monthly_evaluations (restaurant_id, month DESC);
