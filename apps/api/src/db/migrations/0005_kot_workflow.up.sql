-- Migration 0005: Kitchen Order Tickets (KOT), Item Status Lifecycle, OOS Tracking (Up)

-- 1. Extend order_items with kot_state
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kot_state TEXT NOT NULL DEFAULT 'unsent';
-- 'unsent' | 'sent' | 'updated'

-- 2. Extend menu_items with OOS tracking audit columns
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS oos_set_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS oos_set_at TIMESTAMPTZ;

-- 3. KOT Counters table (sequential numbers per restaurant per day)
CREATE TABLE IF NOT EXISTS kot_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  last_kot_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_kot_counter_restaurant_date UNIQUE (restaurant_id, business_date)
);

-- 4. KOTs table
CREATE TABLE IF NOT EXISTS kots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  kot_number INT NOT NULL,
  provisional_label TEXT,
  type TEXT NOT NULL DEFAULT 'new', -- 'new' | 'additional' | 'modified'
  status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'preparing' | 'ready' | 'served' | 'cancelled'
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  seen_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kots_status_created_at ON kots(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kots_order_id ON kots(order_id);
CREATE INDEX IF NOT EXISTS idx_kots_restaurant_created_at ON kots(restaurant_id, created_at DESC);

-- 5. KOT Items table
CREATE TABLE IF NOT EXISTS kot_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kot_id UUID NOT NULL REFERENCES kots(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  qty INT NOT NULL DEFAULT 1,
  action TEXT NOT NULL DEFAULT 'add', -- 'add' | 'cancel' | 'update'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'done' | 'cancelled'
  note_snapshot TEXT,
  done_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kot_items_kot_id ON kot_items(kot_id);
CREATE INDEX IF NOT EXISTS idx_kot_items_order_item_id ON kot_items(order_item_id);
