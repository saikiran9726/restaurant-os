-- Migration 0014 Down: Drop alerts, insights, and alert_settings

DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS insights;
DROP TABLE IF EXISTS alert_settings;
