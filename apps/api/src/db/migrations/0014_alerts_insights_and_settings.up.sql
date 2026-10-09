-- Migration 0014: Alerts, Insights, and Alert Settings

-- 1. Create alert_settings table
CREATE TABLE IF NOT EXISTS alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  cash_mismatch_tolerance_paise BIGINT NOT NULL DEFAULT 5000,
  high_expense_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.50,
  high_expense_min_amount_paise BIGINT NOT NULL DEFAULT 500000,
  upi_pending_timeout_hours NUMERIC(4,1) NOT NULL DEFAULT 2.0,
  profit_decline_points_threshold NUMERIC(4,1) NOT NULL DEFAULT 5.0,
  regular_customer_inactive_days INTEGER NOT NULL DEFAULT 30,
  enabled_alerts JSONB NOT NULL DEFAULT '{"cash_mismatch":true,"low_stock":true,"high_expense":true,"payment_reconciliation":true,"profit_decline":true}'::jsonb,
  enabled_insights JSONB NOT NULL DEFAULT '{"sales_change":true,"top_seller":true,"supply_cost_change":true,"margin_change":true,"unreturned_regulars":true,"consumption_change":true}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_alert_settings_restaurant UNIQUE (restaurant_id)
);

-- Seed default settings for all existing restaurants
INSERT INTO alert_settings (restaurant_id)
SELECT id FROM restaurants
ON CONFLICT (restaurant_id) DO NOTHING;

-- 2. Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  dedupe_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'open',
  snoozed_until TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  dismiss_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_restaurant_status_severity ON alerts (restaurant_id, status, severity);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_open_dedupe ON alerts (restaurant_id, dedupe_key) WHERE status = 'open';

-- 3. Create insights table
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'daily',
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  materiality_score INTEGER NOT NULL DEFAULT 50,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for insights query
CREATE INDEX IF NOT EXISTS idx_insights_restaurant_dismissed ON insights (restaurant_id, dismissed, created_at DESC);
