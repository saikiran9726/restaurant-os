-- Migration 0011: Inventory, Purchases, Suppliers, and Stock Movements

-- 1. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_suppliers_restaurant_name UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_restaurant_active ON suppliers (restaurant_id, active);

-- 2. Inventory Items Table
-- Single unit per item (kg, g, L, ml, pcs, packet, dozen, custom)
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  category TEXT NOT NULL DEFAULT 'General',
  current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
  reorder_level NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
  active BOOLEAN NOT NULL DEFAULT true,
  last_purchase_price_paise_per_unit BIGINT NOT NULL DEFAULT 0,
  avg_cost_paise_per_unit BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_inventory_items_restaurant_lower_name UNIQUE (restaurant_id, lower(name))
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant_active ON inventory_items (restaurant_id, active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant_stock ON inventory_items (restaurant_id, current_stock, reorder_level);

-- 3. Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_ref TEXT,
  total_paise BIGINT NOT NULL DEFAULT 0,
  paid_status TEXT NOT NULL DEFAULT 'unpaid',
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchases_restaurant_date ON purchases (restaurant_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases (supplier_id);

-- 4. Purchase Lines Table
CREATE TABLE IF NOT EXISTS purchase_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 3) NOT NULL,
  unit_price_paise BIGINT NOT NULL,
  line_total_paise BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT chk_purchase_line_quantity CHECK (quantity > 0),
  CONSTRAINT chk_purchase_line_unit_price CHECK (unit_price_paise >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_lines_purchase ON purchase_lines (purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_item ON purchase_lines (item_id);

-- 5. Stock Movements Table
-- Immutable ledger of all movements: purchase, usage, waste, adjustment, stock_count
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL,
  reason TEXT NOT NULL,
  ref_purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cost_snapshot_paise_per_unit BIGINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_date ON stock_movements (item_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_restaurant_date ON stock_movements (restaurant_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref_purchase ON stock_movements (ref_purchase_id);
