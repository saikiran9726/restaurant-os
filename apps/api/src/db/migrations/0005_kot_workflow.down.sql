-- Migration 0005: Kitchen Order Tickets (KOT), Item Status Lifecycle, OOS Tracking (Down)

DROP TABLE IF EXISTS kot_items;
DROP TABLE IF EXISTS kots;
DROP TABLE IF EXISTS kot_counters;

ALTER TABLE menu_items DROP COLUMN IF EXISTS oos_set_at;
ALTER TABLE menu_items DROP COLUMN IF EXISTS oos_set_by;

ALTER TABLE order_items DROP COLUMN IF EXISTS kot_state;
