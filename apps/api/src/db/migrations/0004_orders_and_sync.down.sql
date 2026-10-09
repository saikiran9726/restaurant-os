-- Migration 0004: Orders, Order Items, Tables Status & Sync Commands (Down)

DROP TABLE IF EXISTS sync_commands CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
ALTER TABLE tables DROP CONSTRAINT IF EXISTS fk_tables_current_order;
ALTER TABLE tables DROP COLUMN IF EXISTS current_order_id;
ALTER TABLE tables DROP COLUMN IF EXISTS status;
DROP TABLE IF EXISTS orders CASCADE;
