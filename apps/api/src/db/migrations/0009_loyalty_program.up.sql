-- Migration 0009: Spend-based & Visit-based Loyalty Program with Append-Only Ledger

-- 1. loyalty_settings table (one row per restaurant)
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  spend_paise_per_block INTEGER NOT NULL DEFAULT 10000, -- ₹100
  points_per_block INTEGER NOT NULL DEFAULT 5, -- 5 pts
  redeem_points_block INTEGER NOT NULL DEFAULT 500, -- 500 pts
  redeem_value_paise INTEGER NOT NULL DEFAULT 5000, -- ₹50
  min_redeem_points INTEGER NOT NULL DEFAULT 500,
  max_redeem_percent_of_bill INTEGER NOT NULL DEFAULT 50, -- 50%
  points_expiry_days INTEGER,
  earn_on_discounted_amount BOOLEAN NOT NULL DEFAULT false,
  new_account_cooldown_hours INTEGER NOT NULL DEFAULT 24,
  per_day_redeem_cap_points INTEGER NOT NULL DEFAULT 5000,
  tiers JSONB NOT NULL DEFAULT '[
    {"name": "Silver", "thresholdSpendPaise": 0, "earnMultiplier": 1},
    {"name": "Gold", "thresholdSpendPaise": 500000, "earnMultiplier": 1.25},
    {"name": "Platinum", "thresholdSpendPaise": 1500000, "earnMultiplier": 1.5}
  ]'::jsonb,
  visit_reward JSONB NOT NULL DEFAULT '{"enabled": false, "everyNVisits": 5, "bonusPoints": 100}'::jsonb,
  birthday_reward JSONB NOT NULL DEFAULT '{"enabled": false, "bonusPoints": 200, "minDaysRegistered": 30}'::jsonb,
  referral_reward JSONB NOT NULL DEFAULT '{"enabled": false, "referrerBonusPoints": 100, "refereeBonusPoints": 50, "minBillPaiseToQualify": 20000, "maxReferralsPerReferrer": 5}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. loyalty_accounts table (cached balance & tier per customer)
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'Silver',
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_restaurant_customer ON loyalty_accounts(restaurant_id, customer_id);

-- 3. loyalty_transactions table (Append-only ledger)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'earn' | 'redeem' | 'reversal' | 'adjust' | 'expire' | 'bonus'
  points INTEGER NOT NULL, -- positive for credit (earn/adjust/bonus/reversal), negative for debit (redeem/expire/adjust)
  bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_loyalty_tx_bill_type UNIQUE (bill_id, type)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_account_created ON loyalty_transactions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_bill ON loyalty_transactions(bill_id);

-- 4. rewards table (optional simple rewards, e.g. Free drink for 300 pts)
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Extend bills table with loyalty redemption fields if not present
ALTER TABLE bills ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS loyalty_discount_paise INTEGER NOT NULL DEFAULT 0;
