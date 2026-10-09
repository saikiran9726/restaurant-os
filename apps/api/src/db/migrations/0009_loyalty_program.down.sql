-- Migration 0009 Down: Revert Loyalty Program & Ledger

ALTER TABLE bills DROP COLUMN IF EXISTS loyalty_points_redeemed;
ALTER TABLE bills DROP COLUMN IF EXISTS loyalty_discount_paise;

DROP TABLE IF EXISTS loyalty_rewards CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
DROP TABLE IF EXISTS loyalty_accounts CASCADE;
DROP TABLE IF EXISTS loyalty_settings CASCADE;
