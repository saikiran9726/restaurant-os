-- Migration 0003: Restaurant Profile, Kitchens, Tables, Menu, Modifiers, and Trigram Search (Down)

DROP TABLE IF EXISTS item_modifier_groups CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS modifiers CASCADE;
DROP TABLE IF EXISTS modifier_groups CASCADE;
DROP TABLE IF EXISTS menu_categories CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS restaurant_settings CASCADE;
DROP TABLE IF EXISTS kitchens CASCADE;
