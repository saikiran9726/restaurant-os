-- Migration 0015 Down: Drop sync, local hub, device registry, and conflict reviews

DROP TABLE IF EXISTS conflict_reviews CASCADE;
DROP TABLE IF EXISTS dead_letter_commands CASCADE;
DROP TABLE IF EXISTS sync_cursors CASCADE;
DROP TABLE IF EXISTS sync_events CASCADE;
DROP TABLE IF EXISTS hub_registry CASCADE;
DROP TABLE IF EXISTS device_registry CASCADE;
