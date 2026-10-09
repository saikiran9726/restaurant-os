-- Migration 0007: Thermal Printing Configurations, Print Jobs, Print Events, Dynamic UPI Payment Requests, and Receipt Settings

-- 1. Printer Configurations
CREATE TABLE IF NOT EXISTS printer_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport IN ('bluetooth', 'usb', 'lan', 'browser')),
  address TEXT NOT NULL DEFAULT '',
  width_mm INTEGER NOT NULL DEFAULT 80 CHECK (width_mm IN (58, 80)),
  codepage TEXT NOT NULL DEFAULT 'CP437',
  chars_per_line INTEGER NOT NULL DEFAULT 48,
  auto_cut BOOLEAN NOT NULL DEFAULT true,
  drawer_pulse BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_printer_configurations_restaurant ON printer_configurations(restaurant_id);

-- 2. Print Jobs (server mirror of client print queue)
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  printer_id UUID REFERENCES printer_configurations(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL DEFAULT 'bill' CHECK (job_type IN ('bill', 'reprint', 'duplicate', 'test')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'printing', 'printed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_bill ON print_jobs(bill_id);

-- 3. Print Events (audit of every physical/browser print attempt)
CREATE TABLE IF NOT EXISTS print_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('print', 'reprint', 'duplicate', 'test')),
  printer_id UUID REFERENCES printer_configurations(id) ON DELETE SET NULL,
  result TEXT NOT NULL CHECK (result IN ('success', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_events_bill_id ON print_events(bill_id);
CREATE INDEX IF NOT EXISTS idx_print_events_restaurant ON print_events(restaurant_id, created_at DESC);

-- 4. Dynamic UPI Payment Requests (amount due snapshot + reference)
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  upi_ref TEXT NOT NULL,
  qr_payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_bill_id ON payment_requests(bill_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_upi_ref ON payment_requests(upi_ref);

-- 5. Extend restaurant_settings with UPI & Receipt layout toggles
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS upi_vpa TEXT,
  ADD COLUMN IF NOT EXISTS upi_payee_name TEXT,
  ADD COLUMN IF NOT EXISTS receipt_header_lines TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS receipt_footer_lines TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS receipt_show_gstin BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_customer BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_item_notes BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_show_service_charge BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_qr BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rupee_symbol_mode TEXT NOT NULL DEFAULT 'text_rs';
