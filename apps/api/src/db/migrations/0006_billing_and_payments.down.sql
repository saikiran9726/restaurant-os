-- Migration 0006 Down: Drop refunds, payments, bill_lines, bills, and bill_counters

DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bill_lines CASCADE;
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS bill_counters CASCADE;
