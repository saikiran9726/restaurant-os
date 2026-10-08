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
});
