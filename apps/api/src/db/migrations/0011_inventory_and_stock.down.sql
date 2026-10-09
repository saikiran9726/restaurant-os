-- Migration 0011 Down: Drop inventory and stock tables

DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS purchase_lines CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
