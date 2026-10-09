-- Migration 0006: Bills, Payments, Refunds, Bill Lines, and Daily Sequential Bill Counters

CREATE TABLE IF NOT EXISTS bill_counters (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, date)
);

CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  bill_number TEXT NOT NULL,
  subtotal_paise INTEGER NOT NULL,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  discount_type TEXT,
  discount_value INTEGER,
  discount_reason TEXT,
  service_charge_paise INTEGER NOT NULL DEFAULT 0,
  tax_paise INTEGER NOT NULL DEFAULT 0,
  round_off_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid',
  paid_at TIMESTAMPTZ,
  printed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_bills_restaurant_number UNIQUE (restaurant_id, bill_number),
  CONSTRAINT chk_bills_status CHECK (status IN ('draft', 'unpaid', 'partially_paid', 'paid', 'cancelled', 'refunded')),
  CONSTRAINT chk_bills_discount_type CHECK (discount_type IS NULL OR discount_type IN ('percent', 'flat'))
);

CREATE INDEX IF NOT EXISTS idx_bills_order_id ON bills(order_id);
CREATE INDEX IF NOT EXISTS idx_bills_restaurant_status ON bills(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(restaurant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bill_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  item_id UUID REFERENCES menu_items(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  subtotal_paise INTEGER NOT NULL,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  taxable_paise INTEGER NOT NULL DEFAULT 0,
  tax_rate_bp INTEGER NOT NULL DEFAULT 0,
  tax_paise INTEGER NOT NULL DEFAULT 0,
  cgst_paise INTEGER NOT NULL DEFAULT 0,
  sgst_paise INTEGER NOT NULL DEFAULT 0,
  modifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_lines_bill_id ON bill_lines(bill_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  tendered_paise INTEGER,
  change_paise INTEGER,
  status TEXT NOT NULL,
  reference TEXT,
  confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_payments_method CHECK (method IN ('cash', 'upi', 'card')),
  CONSTRAINT chk_payments_status CHECK (status IN ('recorded', 'pending_confirmation', 'confirmed', 'failed', 'reversed'))
);

CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_restaurant_status ON payments(restaurant_id, status);

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  method TEXT NOT NULL,
  reason TEXT NOT NULL,
  approved_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_refunds_method CHECK (method IN ('cash', 'upi', 'card'))
);

CREATE INDEX IF NOT EXISTS idx_refunds_bill_id ON refunds(bill_id);
