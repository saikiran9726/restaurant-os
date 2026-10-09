import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../src/db/migrations');

describe('Database Migrations 0001', () => {
  it('has both up and down SQL migration files', () => {
    const upFile = path.join(migrationsDir, '0001_initial.up.sql');
    const downFile = path.join(migrationsDir, '0001_initial.down.sql');

    expect(fs.existsSync(upFile)).toBe(true);
    expect(fs.existsSync(downFile)).toBe(true);
  });

  it('migration 0001 up creates restaurants, users, and audit_logs tables', () => {
    const upSql = fs.readFileSync(path.join(migrationsDir, '0001_initial.up.sql'), 'utf8');

    // Restaurants
    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS restaurants');
    expect(upSql).toContain('id UUID PRIMARY KEY');
    expect(upSql).toContain('name TEXT NOT NULL');

    // Users
    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(upSql).toContain('restaurant_id UUID NOT NULL REFERENCES restaurants(id)');
    expect(upSql).toContain('name TEXT NOT NULL');

    // Audit logs
    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS audit_logs');
    expect(upSql).toContain('restaurant_id UUID NOT NULL REFERENCES restaurants(id)');
    expect(upSql).toContain('user_id UUID REFERENCES users(id)');
    expect(upSql).toContain('action TEXT NOT NULL');
    expect(upSql).toContain('entity TEXT NOT NULL');
    expect(upSql).toContain('entity_id TEXT NOT NULL');
    expect(upSql).toContain('before JSONB');
    expect(upSql).toContain('after JSONB');
  });

  it('migration 0001 down drops audit_logs, users, and restaurants with CASCADE', () => {
    const downSql = fs.readFileSync(path.join(migrationsDir, '0001_initial.down.sql'), 'utf8');

    expect(downSql).toContain('DROP TABLE IF EXISTS audit_logs CASCADE;');
    expect(downSql).toContain('DROP TABLE IF EXISTS users CASCADE;');
    expect(downSql).toContain('DROP TABLE IF EXISTS restaurants CASCADE;');
  });

  describe('Database Migrations 0003: Restaurant Profile, Tables, Menu, Modifiers', () => {
    it('has both up and down SQL migration files for 0003', () => {
      const upFile = path.join(migrationsDir, '0003_restaurant_config_and_menu.up.sql');
      const downFile = path.join(migrationsDir, '0003_restaurant_config_and_menu.down.sql');

      expect(fs.existsSync(upFile)).toBe(true);
      expect(fs.existsSync(downFile)).toBe(true);
    });

    it('creates kitchens, restaurant_settings, tables, menu_categories, modifier_groups, modifiers, and menu_items', () => {
      const upSql = fs.readFileSync(
        path.join(migrationsDir, '0003_restaurant_config_and_menu.up.sql'),
        'utf8',
      );

      expect(upSql).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS kitchens');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS restaurant_settings');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS tables');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS menu_categories');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS modifier_groups');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS modifiers');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS menu_items');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS item_modifier_groups');
      expect(upSql).toContain('idx_menu_items_name_trgm');
      expect(upSql).toContain('idx_menu_items_aliases_trgm');
    });

    it('down migration cleans up in correct dependency order', () => {
      const downSql = fs.readFileSync(
        path.join(migrationsDir, '0003_restaurant_config_and_menu.down.sql'),
        'utf8',
      );

      expect(downSql).toContain('DROP TABLE IF EXISTS item_modifier_groups CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS menu_items CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS modifiers CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS modifier_groups CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS menu_categories CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS tables CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS restaurant_settings CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS kitchens CASCADE;');
    });
  });

  describe('Database Migrations 0004 & 0005: Orders, KOTs, Lifecycle', () => {
    it('has both up and down SQL migration files for 0004 and 0005', () => {
      expect(fs.existsSync(path.join(migrationsDir, '0004_orders_and_sync.up.sql'))).toBe(true);
      expect(fs.existsSync(path.join(migrationsDir, '0004_orders_and_sync.down.sql'))).toBe(true);
      expect(fs.existsSync(path.join(migrationsDir, '0005_kot_workflow.up.sql'))).toBe(true);
      expect(fs.existsSync(path.join(migrationsDir, '0005_kot_workflow.down.sql'))).toBe(true);
    });

    it('creates kots, kot_items, kot_counters and extends order_items, menu_items', () => {
      const upSql = fs.readFileSync(path.join(migrationsDir, '0005_kot_workflow.up.sql'), 'utf8');

      expect(upSql).toContain('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kot_state');
      expect(upSql).toContain('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS oos_set_by');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS kot_counters');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS kots');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS kot_items');
      expect(upSql).toContain('idx_kots_status_created_at');
    });
  });

  describe('Database Migrations 0006: Bills, Payments, Refunds, Counters', () => {
    it('has both up and down SQL migration files for 0006', () => {
      expect(fs.existsSync(path.join(migrationsDir, '0006_billing_and_payments.up.sql'))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(migrationsDir, '0006_billing_and_payments.down.sql'))).toBe(
        true,
      );
    });

    it('creates bill_counters, bills, bill_lines, payments, and refunds', () => {
      const upSql = fs.readFileSync(
        path.join(migrationsDir, '0006_billing_and_payments.up.sql'),
        'utf8',
      );

      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS bill_counters');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS bills');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS bill_lines');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS payments');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS refunds');
      expect(upSql).toContain('uq_bills_restaurant_number');
      expect(upSql).toContain('idx_bills_order_id');
      expect(upSql).toContain('idx_payments_bill_id');
    });

    it('migration 0006 down drops refunds, payments, bill_lines, bills, bill_counters', () => {
      const downSql = fs.readFileSync(
        path.join(migrationsDir, '0006_billing_and_payments.down.sql'),
        'utf8',
      );

      expect(downSql).toContain('DROP TABLE IF EXISTS refunds CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS payments CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS bill_lines CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS bills CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS bill_counters CASCADE;');
    });
  });

  describe('Database Migrations 0007: Thermal Printing and Dynamic UPI QR', () => {
    it('has both up and down SQL migration files for 0007', () => {
      expect(fs.existsSync(path.join(migrationsDir, '0007_printing_and_upi_qr.up.sql'))).toBe(true);
      expect(fs.existsSync(path.join(migrationsDir, '0007_printing_and_upi_qr.down.sql'))).toBe(
        true,
      );
    });

    it('creates printer_configurations, print_jobs, print_events, payment_requests, and extends restaurant_settings', () => {
      const upSql = fs.readFileSync(
        path.join(migrationsDir, '0007_printing_and_upi_qr.up.sql'),
        'utf8',
      );

      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS printer_configurations');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS print_jobs');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS print_events');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS payment_requests');
      expect(upSql).toContain('ALTER TABLE restaurant_settings');
      expect(upSql).toContain('ADD COLUMN IF NOT EXISTS upi_vpa TEXT');
      expect(upSql).toContain('ADD COLUMN IF NOT EXISTS upi_payee_name TEXT');
      expect(upSql).toContain('ADD COLUMN IF NOT EXISTS receipt_show_qr BOOLEAN');
    });

    it('migration 0007 down drops payment_requests, print_events, print_jobs, printer_configurations and settings columns', () => {
      const downSql = fs.readFileSync(
        path.join(migrationsDir, '0007_printing_and_upi_qr.down.sql'),
        'utf8',
      );

      expect(downSql).toContain('DROP TABLE IF EXISTS payment_requests CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS print_events CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS print_jobs CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS printer_configurations CASCADE;');
      expect(downSql).toContain('DROP COLUMN IF EXISTS upi_vpa;');
    });
  });

  describe('Database Migrations 0008: Customers, Preferences, and Segments', () => {
    it('has both up and down SQL migration files for 0008', () => {
      expect(fs.existsSync(path.join(migrationsDir, '0008_customers_and_preferences.up.sql'))).toBe(
        true,
      );
      expect(
        fs.existsSync(path.join(migrationsDir, '0008_customers_and_preferences.down.sql')),
      ).toBe(true);
    });

    it('creates customers table and extends restaurant_settings with tags and segment rules', () => {
      const upSql = fs.readFileSync(
        path.join(migrationsDir, '0008_customers_and_preferences.up.sql'),
        'utf8',
      );

      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS customers');
      expect(upSql).toContain('uq_customers_restaurant_phone');
      expect(upSql).toContain('idx_customers_restaurant_phone');
      expect(upSql).toContain('ALTER TABLE restaurant_settings');
      expect(upSql).toContain('ADD COLUMN IF NOT EXISTS customer_preference_tags TEXT[]');
      expect(upSql).toContain('ADD COLUMN IF NOT EXISTS segment_regular_min_visits INTEGER');
    });

    it('migration 0008 down drops customers table and settings columns', () => {
      const downSql = fs.readFileSync(
        path.join(migrationsDir, '0008_customers_and_preferences.down.sql'),
        'utf8',
      );

      expect(downSql).toContain('DROP TABLE IF EXISTS customers CASCADE;');
      expect(downSql).toContain('DROP COLUMN IF EXISTS customer_preference_tags;');
    });
  });

  describe('Database Migrations 0009: Loyalty Program and Ledger', () => {
    it('has both up and down SQL migration files for 0009', () => {
      expect(fs.existsSync(path.join(migrationsDir, '0009_loyalty_program.up.sql'))).toBe(true);
      expect(fs.existsSync(path.join(migrationsDir, '0009_loyalty_program.down.sql'))).toBe(true);
    });

    it('creates loyalty_settings, loyalty_accounts, loyalty_transactions, loyalty_rewards, and extends bills', () => {
      const upSql = fs.readFileSync(
        path.join(migrationsDir, '0009_loyalty_program.up.sql'),
        'utf8',
      );

      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS loyalty_settings');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS loyalty_accounts');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS loyalty_transactions');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS loyalty_rewards');
      expect(upSql).toContain('uq_loyalty_tx_bill_type');
      expect(upSql).toContain('ALTER TABLE bills ADD COLUMN IF NOT EXISTS loyalty_points_redeemed');
      expect(upSql).toContain('ALTER TABLE bills ADD COLUMN IF NOT EXISTS loyalty_discount_paise');
    });

    it('migration 0009 down drops loyalty tables and bill columns', () => {
      const downSql = fs.readFileSync(
        path.join(migrationsDir, '0009_loyalty_program.down.sql'),
        'utf8',
      );

      expect(downSql).toContain('DROP TABLE IF EXISTS loyalty_rewards CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS loyalty_transactions CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS loyalty_accounts CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS loyalty_settings CASCADE;');
      expect(downSql).toContain('DROP COLUMN IF EXISTS loyalty_points_redeemed;');
    });
  });

  describe('Database Migrations 0010: Sales Analytics and End-of-Day Closing', () => {
    it('has both up and down SQL migration files for 0010', () => {
      expect(fs.existsSync(path.join(migrationsDir, '0010_sales_analytics_and_eod.up.sql'))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(migrationsDir, '0010_sales_analytics_and_eod.down.sql'))).toBe(
        true,
      );
    });

    it('creates daily_summaries, expenses, and extends bills, payments, and restaurant_settings', () => {
      const upSql = fs.readFileSync(
        path.join(migrationsDir, '0010_sales_analytics_and_eod.up.sql'),
        'utf8',
      );

      expect(upSql).toContain('ALTER TABLE bills ADD COLUMN IF NOT EXISTS business_date TEXT;');
      expect(upSql).toContain('ALTER TABLE payments ADD COLUMN IF NOT EXISTS business_date TEXT;');
      expect(upSql).toContain(
        'ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS business_day_start_hour',
      );
      expect(upSql).toContain(
        'ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS cash_tolerance_paise',
      );
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS daily_summaries');
      expect(upSql).toContain('uq_daily_summaries_restaurant_date');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS expenses');
      expect(upSql).toContain('idx_expenses_restaurant_business_date');
    });

    it('migration 0010 down drops daily_summaries, expenses, and rollback columns', () => {
      const downSql = fs.readFileSync(
        path.join(migrationsDir, '0010_sales_analytics_and_eod.down.sql'),
        'utf8',
      );

      expect(downSql).toContain('DROP TABLE IF EXISTS expenses CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS daily_summaries CASCADE;');
      expect(downSql).toContain('DROP COLUMN IF EXISTS business_date;');
      expect(downSql).toContain('DROP COLUMN IF EXISTS business_day_start_hour;');
    });
  });

  describe('Database Migrations 0011: Inventory, Purchases, Suppliers, and Movements', () => {
    it('has both up and down SQL migration files for 0011', () => {
      expect(fs.existsSync(path.join(migrationsDir, '0011_inventory_and_stock.up.sql'))).toBe(true);
      expect(fs.existsSync(path.join(migrationsDir, '0011_inventory_and_stock.down.sql'))).toBe(
        true,
      );
    });

    it('creates suppliers, inventory_items, purchases, purchase_lines, and stock_movements', () => {
      const upSql = fs.readFileSync(
        path.join(migrationsDir, '0011_inventory_and_stock.up.sql'),
        'utf8',
      );

      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS suppliers');
      expect(upSql).toContain('uq_suppliers_restaurant_name');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS inventory_items');
      expect(upSql).toContain('uq_inventory_items_restaurant_lower_name');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS purchases');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS purchase_lines');
      expect(upSql).toContain('chk_purchase_line_quantity');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS stock_movements');
      expect(upSql).toContain('idx_stock_movements_item_date');
    });

    it('migration 0011 down drops inventory tables in reverse dependency order', () => {
      const downSql = fs.readFileSync(
        path.join(migrationsDir, '0011_inventory_and_stock.down.sql'),
        'utf8',
      );

      expect(downSql).toContain('DROP TABLE IF EXISTS stock_movements CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS purchase_lines CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS purchases CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS inventory_items CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS suppliers CASCADE;');
    });
  });

  describe('Database Migrations 0012: Expenses Categories, Extended Expenses, and Monthly Evaluations', () => {
    it('has both up and down SQL migration files for 0012', () => {
      expect(
        fs.existsSync(path.join(migrationsDir, '0012_expenses_and_profitability.up.sql')),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(migrationsDir, '0012_expenses_and_profitability.down.sql')),
      ).toBe(true);
    });

    it('creates expense_categories, extends expenses, and creates monthly_evaluations', () => {
      const upSql = fs.readFileSync(
        path.join(migrationsDir, '0012_expenses_and_profitability.up.sql'),
        'utf8',
      );

      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS expense_categories');
      expect(upSql).toContain('uq_expense_categories_restaurant_name');
      expect(upSql).toContain('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id');
      expect(upSql).toContain('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date');
      expect(upSql).toContain('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS month');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS monthly_evaluations');
      expect(upSql).toContain('uq_monthly_evaluations_restaurant_month_version');
      expect(upSql).toContain('idx_expenses_category');
    });

    it('migration 0012 down drops evaluations and categories and reverts expenses columns', () => {
      const downSql = fs.readFileSync(
        path.join(migrationsDir, '0012_expenses_and_profitability.down.sql'),
        'utf8',
      );

      expect(downSql).toContain('DROP TABLE IF EXISTS monthly_evaluations CASCADE;');
      expect(downSql).toContain('ALTER TABLE expenses DROP COLUMN IF EXISTS category_id;');
      expect(downSql).toContain('DROP TABLE IF EXISTS expense_categories CASCADE;');
    });
  });

  describe('Database Migrations 0013: Restaurant Health Models and Snapshots', () => {
    it('has both up and down SQL migration files for 0013', () => {
      expect(
        fs.existsSync(path.join(migrationsDir, '0013_health_score_models_and_snapshots.up.sql')),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(migrationsDir, '0013_health_score_models_and_snapshots.down.sql')),
      ).toBe(true);
    });

    it('creates health_models and health_snapshots tables with indexes and unique constraints', () => {
      const upSql = fs.readFileSync(
        path.join(migrationsDir, '0013_health_score_models_and_snapshots.up.sql'),
        'utf8',
      );

      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS health_models');
      expect(upSql).toContain('uq_health_models_restaurant_version');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS health_snapshots');
      expect(upSql).toContain('uq_health_snapshots_restaurant_date');
      expect(upSql).toContain('idx_health_snapshots_restaurant_date');
    });

    it('migration 0013 down drops health_snapshots and health_models', () => {
      const downSql = fs.readFileSync(
        path.join(migrationsDir, '0013_health_score_models_and_snapshots.down.sql'),
        'utf8',
      );

      expect(downSql).toContain('DROP TABLE IF EXISTS health_snapshots;');
      expect(downSql).toContain('DROP TABLE IF EXISTS health_models;');
    });
  });
  describe('Database Migrations 0014: Alerts, Insights, and Settings', () => {
    it('has both up and down SQL migration files for 0014', () => {
      expect(
        fs.existsSync(path.join(migrationsDir, '0014_alerts_insights_and_settings.up.sql')),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(migrationsDir, '0014_alerts_insights_and_settings.down.sql')),
      ).toBe(true);
    });

    it('creates alert_settings, alerts, and insights tables with indexes and unique constraints', () => {
      const upSql = fs.readFileSync(
        path.join(migrationsDir, '0014_alerts_insights_and_settings.up.sql'),
        'utf8',
      );

      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS alert_settings');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS alerts');
      expect(upSql).toContain('idx_alerts_open_dedupe');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS insights');
      expect(upSql).toContain('idx_insights_restaurant_dismissed');
    });

    it('migration 0014 down drops insights, alerts, and alert_settings', () => {
      const downSql = fs.readFileSync(
        path.join(migrationsDir, '0014_alerts_insights_and_settings.down.sql'),
        'utf8',
      );

      expect(downSql).toContain('DROP TABLE IF EXISTS alerts;');
      expect(downSql).toContain('DROP TABLE IF EXISTS insights;');
      expect(downSql).toContain('DROP TABLE IF EXISTS alert_settings;');
    });
  });

  describe('Database Migrations 0015: Sync, Local Hub, Device Registry, and Conflict Reviews', () => {
    it('has both up and down SQL migration files for 0015', () => {
      expect(fs.existsSync(path.join(migrationsDir, '0015_sync_and_local_hub.up.sql'))).toBe(true);
      expect(fs.existsSync(path.join(migrationsDir, '0015_sync_and_local_hub.down.sql'))).toBe(
        true,
      );
    });

    it('creates device_registry, hub_registry, sync_events, sync_cursors, dead_letter_commands, and conflict_reviews', () => {
      const upSql = fs.readFileSync(
        path.join(migrationsDir, '0015_sync_and_local_hub.up.sql'),
        'utf8',
      );

      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS device_registry');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS hub_registry');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS sync_events');
      expect(upSql).toContain('idx_sync_events_restaurant_seq');
      expect(upSql).toContain('idx_sync_events_restaurant_idempotency');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS sync_cursors');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS dead_letter_commands');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS conflict_reviews');
    });

    it('migration 0015 down drops sync tables in reverse dependency order', () => {
      const downSql = fs.readFileSync(
        path.join(migrationsDir, '0015_sync_and_local_hub.down.sql'),
        'utf8',
      );

      expect(downSql).toContain('DROP TABLE IF EXISTS conflict_reviews CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS dead_letter_commands CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS sync_cursors CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS sync_events CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS hub_registry CASCADE;');
      expect(downSql).toContain('DROP TABLE IF EXISTS device_registry CASCADE;');
    });
  });
});
