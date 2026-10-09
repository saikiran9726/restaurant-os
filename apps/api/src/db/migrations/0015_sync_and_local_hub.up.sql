-- Migration 0015: Sync, Local Hub, Device Registry, and Conflict Reviews

-- 1. Device Registry (devices active in restaurant)
CREATE TABLE IF NOT EXISTS device_registry (
  id TEXT PRIMARY KEY, -- Device UUID generated on client
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'waiter', -- 'waiter' | 'kitchen' | 'pos' | 'hub'
  app_version TEXT,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_registry_restaurant_role ON device_registry (restaurant_id, role);

-- 2. Local Hub Registry
CREATE TABLE IF NOT EXISTS hub_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Restaurant Local Hub',
  host_address TEXT NOT NULL, -- e.g. "192.168.1.100:3000"
  api_key_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_synced_seq BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_hub_registry_restaurant UNIQUE (restaurant_id)
);

-- 3. Monotonic Sequence Sync Events Log (authoritative server-assigned order)
CREATE TABLE IF NOT EXISTS sync_events (
  seq BIGSERIAL PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  command_id TEXT NOT NULL, -- Client command UUID
  idempotency_key TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g. 'order.create', 'order.update', 'kot.status', 'payment.record'
  payload JSONB NOT NULL,
  server_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  claimed_at TIMESTAMP WITH TIME ZONE, -- Client device time (informational)
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_events_restaurant_seq ON sync_events (restaurant_id, seq);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_events_restaurant_idempotency ON sync_events (restaurant_id, idempotency_key);

-- 4. Sync Cursors (tracks replication progress between Hub and Cloud or peers)
CREATE TABLE IF NOT EXISTS sync_cursors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  peer_id TEXT NOT NULL, -- 'cloud' or hub device_id
  last_seq BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_sync_cursors_restaurant_peer UNIQUE (restaurant_id, peer_id)
);

-- 5. Dead-Letter Commands (poison commands exceeding retry thresholds)
CREATE TABLE IF NOT EXISTS dead_letter_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'dead_letter', -- 'dead_letter' | 'replayed' | 'discarded'
  discard_reason TEXT,
  discarded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_restaurant_status ON dead_letter_commands (restaurant_id, status);

-- 6. Conflict Reviews (audit queue for conflicts such as duplicate payments, table collisions)
CREATE TABLE IF NOT EXISTS conflict_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'duplicate_payment' | 'table_collision' | 'order_concurrent_edit'
  reference_id TEXT NOT NULL, -- e.g. billId, tableId, orderId
  severity TEXT NOT NULL DEFAULT 'warning', -- 'warning' | 'critical'
  details JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'resolved' | 'acknowledged'
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conflict_reviews_restaurant_status ON conflict_reviews (restaurant_id, status);
