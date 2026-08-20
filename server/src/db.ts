/**
 * PostgreSQL access.
 *
 * A single pool, a thin query helper, and a migration that applies the schema
 * on boot — enough for a service this size, and nothing a reviewer has to
 * unpick to understand where a number came from.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
    ?? 'postgres://carbon:carbon@localhost:5432/carboncampus',
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

/** Apply the schema. Safe to run repeatedly — every statement is IF NOT EXISTS. */
export async function migrate(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = await readFile(join(here, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

export async function healthy(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Find or create the user behind a request. Campus SSO replaces this in production. */
export async function upsertUser(p: {
  email: string; name: string; role?: string; hostel?: string;
  dept?: string; year?: number; campus?: string; baselinePerDay?: number;
}): Promise<{ id: string }> {
  const row = await one<{ id: string }>(
    `INSERT INTO users (email, name, role, hostel, dept, year, campus, baseline_per_day)
     VALUES ($1, $2, COALESCE($3, 'student'), $4, $5, $6, COALESCE($7, 'iitg'), $8)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       hostel = EXCLUDED.hostel,
       dept = EXCLUDED.dept,
       year = EXCLUDED.year,
       baseline_per_day = COALESCE(EXCLUDED.baseline_per_day, users.baseline_per_day)
     RETURNING id`,
    [p.email.toLowerCase(), p.name, p.role ?? null, p.hostel ?? null,
     p.dept ?? null, p.year ?? null, p.campus ?? null, p.baselinePerDay ?? null]
  );
  return row!;
}
