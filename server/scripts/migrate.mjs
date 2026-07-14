#!/usr/bin/env node
/**
 * Apply server/db/schema.sql via Neon serverless Pool.
 * Uses DATABASE_URL or POSTGRES_URL. If unset — prints a hint and exits 0
 * (Postgres is optional; Variant A keeps file JSON stores).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from '@neondatabase/serverless';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '..', 'db', 'schema.sql');
const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();

if (!url) {
  console.log(
    'migrate: DATABASE_URL / POSTGRES_URL не задан — схема не применена (Postgres optional).',
  );
  process.exit(0);
}

if (!existsSync(schemaPath)) {
  console.error(`migrate: не найден ${schemaPath}`);
  process.exit(1);
}

const sqlText = readFileSync(schemaPath, 'utf8');
const pool = new Pool({ connectionString: url });

try {
  await pool.query(sqlText);
  console.log(`migrate: ok · applied ${schemaPath}`);
} catch (e) {
  console.error('migrate failed:', e);
  process.exit(1);
} finally {
  await pool.end();
}
