-- Migration 0004: Orders, Order Items, Tables Status & Sync Commands (Up)

-- 1. Extend tables with current_order_id and status
ALTER TABLE tables ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available';
-- status: 'available' | 'occupied' | 'ordering' | 'preparing' | 'ready' | 'payment_pending'
ALTER TABLE tables ADD COLUMN IF NOT EXISTS current_order_id UUID;

-- 2. Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY, -- RFC 9562 UUIDv7 generated on client
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'dine_in', -- 'dine_in' | 'takeaway'
  guests INT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'saved' | 'billed' | 'cancelled'
  customer_id UUID, -- column reserved for future phases
  special_instructions TEXT,
  subtotal_paise INT NOT NULL DEFAULT 0,
  tax_paise INT NOT NULL DEFAULT 0,
  total_paise INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  version INT NOT NULL DEFAULT 1, -- Optimistic concurrency
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Add foreign key constraint to tables.current_order_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tables_current_order'
  ) THEN
    ALTER TABLE tables ADD CONSTRAINT fk_tables_current_order FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Order Items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  name_snapshot TEXT NOT NULL,
  price_paise_snapshot INT NOT NULL,
  tax_rate_bp_snapshot INT NOT NULL DEFAULT 500,
  qty INT NOT NULL DEFAULT 1,
  modifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'cancelled'
  cancelled_reason TEXT,
  line_no INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item_created ON order_items(item_id, created_at DESC);

-- 4. Sync Commands table for idempotency
CREATE TABLE IF NOT EXISTS sync_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  command_type TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_commands_key ON sync_commands(idempotency_key);
