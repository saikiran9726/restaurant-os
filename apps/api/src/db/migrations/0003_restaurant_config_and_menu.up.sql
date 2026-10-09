-- Migration 0003: Restaurant Profile, Kitchens, Tables, Menu, Modifiers, and Trigram Search (Up)

-- 1. Enable pg_trgm extension for fast trigram and fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Kitchens table (one default kitchen)
CREATE TABLE IF NOT EXISTS kitchens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Kitchen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Restaurant Settings table
CREATE TABLE IF NOT EXISTS restaurant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  gstin TEXT,
  tax_mode TEXT NOT NULL DEFAULT 'exclusive', -- 'inclusive' or 'exclusive'
  default_gst_rate_bp INT NOT NULL DEFAULT 500, -- 500 basis points = 5.00%
  service_charge_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  bill_footer TEXT NOT NULL DEFAULT 'Thank you for dining with us!',
  kitchen_late_threshold_minutes INT NOT NULL DEFAULT 15,
  kitchen_overdue_threshold_minutes INT NOT NULL DEFAULT 30,
  discount_cap_owner_percent INT NOT NULL DEFAULT 100,
  discount_cap_manager_percent INT NOT NULL DEFAULT 25,
  discount_cap_cashier_percent INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tables table
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 4,
  section TEXT NOT NULL DEFAULT 'Main Floor',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_restaurant_label ON tables(restaurant_id, label) WHERE active = true;

-- 5. Menu Categories table
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_restaurant_name ON menu_categories(restaurant_id, lower(name)) WHERE active = true;

-- 6. Modifier Groups table
CREATE TABLE IF NOT EXISTS modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  min_selections INT NOT NULL DEFAULT 0,
  max_selections INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Modifiers table (individual options within a group)
CREATE TABLE IF NOT EXISTS modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta_paise INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Menu Items table
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  is_veg BOOLEAN NOT NULL DEFAULT true,
  price_paise INT NOT NULL CHECK (price_paise >= 0),
  tax_rate_bp INT NOT NULL DEFAULT 500, -- Default 5%
  available BOOLEAN NOT NULL DEFAULT true,
  oos_reason TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1, -- Optimistic concurrency
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique item name per category for active items
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_restaurant_cat_name ON menu_items(restaurant_id, category_id, lower(name)) WHERE active = true;

-- Trigram gin indexes on item name and aliases for ultra-fast fuzzy and partial search
CREATE INDEX IF NOT EXISTS idx_menu_items_name_trgm ON menu_items USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_menu_items_aliases_trgm ON menu_items USING gin (array_to_string(aliases, ' ') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);

-- 9. Item Modifier Groups join table
CREATE TABLE IF NOT EXISTS item_modifier_groups (
  item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, modifier_group_id)
);
