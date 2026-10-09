-- Migration 0013: Restaurant Health Models and Snapshots

-- 1. Create health_models table
CREATE TABLE IF NOT EXISTS health_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  window_days INTEGER NOT NULL DEFAULT 30,
  weights JSONB NOT NULL DEFAULT '{"sales_performance":15,"profitability":20,"customer_retention":12,"food_cost":15,"inventory_efficiency":8,"waste":8,"kitchen_efficiency":10,"payment_reconciliation":12}'::jsonb,
  targets JSONB NOT NULL DEFAULT '{"salesGrowthPercent":10,"targetMarginPercent":20,"repeatRatePercent":40,"targetFoodCostPercent":32,"inStockTargetPercent":90,"targetWastePercent":3,"kitchenOnTimePercent":85,"paymentCleanPercent":95}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_health_models_restaurant_version UNIQUE (restaurant_id, version)
);

CREATE INDEX IF NOT EXISTS idx_health_models_restaurant_version ON health_models (restaurant_id, version DESC);

-- Seed default model (v1) for all existing restaurants
INSERT INTO health_models (restaurant_id, version, window_days)
SELECT id, 1, 30 FROM restaurants
ON CONFLICT (restaurant_id, version) DO NOTHING;

-- 2. Create health_snapshots table
CREATE TABLE IF NOT EXISTS health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  model_version INTEGER NOT NULL DEFAULT 1,
  overall_score INTEGER,
  score_band TEXT NOT NULL DEFAULT 'insufficient_data',
  confidence TEXT NOT NULL DEFAULT 'low',
  factors_used INTEGER NOT NULL DEFAULT 0,
  total_factors INTEGER NOT NULL DEFAULT 8,
  factor_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasons_for_change JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_health_snapshots_restaurant_date UNIQUE (restaurant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_restaurant_date ON health_snapshots (restaurant_id, snapshot_date DESC);
