import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

async function ensureMigrationsTable(client: import('pg').PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  `);
}

export async function runMigrations(direction: 'up' | 'down' = 'up'): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureMigrationsTable(client);

    const { rows: appliedRows } = await client.query<{ name: string }>(
      'SELECT name FROM _migrations ORDER BY id ASC;',
    );
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    const allFiles = fs.readdirSync(MIGRATIONS_DIR);

    if (direction === 'up') {
      const upFiles = allFiles
        .filter((file) => file.endsWith('.up.sql'))
        .sort((a, b) => a.localeCompare(b));

      let appliedCount = 0;
      for (const file of upFiles) {
        const migrationName = file.replace('.up.sql', '');
        if (!appliedSet.has(migrationName)) {
          console.log(`[migrate:up] Applying ${migrationName}...`);
          const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
          await client.query(sql);
          await client.query('INSERT INTO _migrations (name) VALUES ($1);', [migrationName]);
          console.log(`[migrate:up] Successfully applied ${migrationName}`);
          appliedCount++;
        }
      }

      if (appliedCount === 0) {
        console.log('[migrate:up] Database schema is already up to date.');
      }
    } else {
      // DOWN: revert the latest applied migration
      if (appliedRows.length === 0) {
        console.log('[migrate:down] No migrations to revert.');
      } else {
        const latestMigration = appliedRows[appliedRows.length - 1]!.name;
        const downFile = `${latestMigration}.down.sql`;
        const downFilePath = path.join(MIGRATIONS_DIR, downFile);

        if (!fs.existsSync(downFilePath)) {
          throw new Error(`Down migration file not found: ${downFile}`);
        }

        console.log(`[migrate:down] Reverting ${latestMigration}...`);
        const sql = fs.readFileSync(downFilePath, 'utf8');
        await client.query(sql);
        await client.query('DELETE FROM _migrations WHERE name = $1;', [latestMigration]);
        console.log(`[migrate:down] Successfully reverted ${latestMigration}`);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[migrate:${direction}] Failed:`, err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow direct CLI invocation
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  runMigrations(direction)
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
