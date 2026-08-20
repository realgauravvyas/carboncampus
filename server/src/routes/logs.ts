/**
 * Student-facing routes: profile, day logs, challenges, recommendations.
 *
 * Totals are recomputed on the server from the raw log rather than trusted from
 * the client, using the same @carboncampus/shared engine the PWA uses. A
 * tampered payload therefore cannot inflate a leaderboard.
 */

import type { FastifyInstance } from 'fastify';
import {
  REGISTRY_VERSION, computeLog, recommend, type Challenge, type DayLog
} from '@carboncampus/shared';
import { one, query, upsertUser } from '../db.js';
import { bust } from '../cache.js';

interface LogBody extends DayLog {
  email?: string;
}

export default async function logRoutes(app: FastifyInstance) {
  /** Create or update the signed-in user. */
  app.post('/api/profile', async (req, reply) => {
    const b = req.body as {
      email?: string; name?: string; role?: string; hostel?: string;
      dept?: string; year?: number; campus?: string; baselinePerDay?: number;
    };
    if (!b?.email || !b?.name) {
      return reply.code(400).send({ error: 'email and name are required' });
    }
    const user = await upsertUser({
      email: b.email, name: b.name, role: b.role, hostel: b.hostel,
      dept: b.dept, year: b.year, campus: b.campus, baselinePerDay: b.baselinePerDay
    });
    await bust('league:');
    return { id: user.id, email: b.email.toLowerCase() };
  });

  /** Upsert one day. The date is the natural key, so re-saving a day edits it. */
  app.post('/api/logs', async (req, reply) => {
    const body = req.body as LogBody;
    const email = (body.email ?? (req.headers['x-user-email'] as string | undefined))?.toLowerCase();

    if (!email) return reply.code(401).send({ error: 'no user identified' });
    if (!body?.date) return reply.code(400).send({ error: 'date is required' });

    const user = await one<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
    if (!user) return reply.code(404).send({ error: 'unknown user — POST /api/profile first' });

    const result = computeLog(body);

    await query(
      `INSERT INTO day_logs
         (user_id, log_date, payload, total_kg, transport_kg, energy_kg, food_kg,
          waste_kg, kwh, sigma_kg, factor_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (user_id, log_date) DO UPDATE SET
         payload = EXCLUDED.payload,
         total_kg = EXCLUDED.total_kg,
         transport_kg = EXCLUDED.transport_kg,
         energy_kg = EXCLUDED.energy_kg,
         food_kg = EXCLUDED.food_kg,
         waste_kg = EXCLUDED.waste_kg,
         kwh = EXCLUDED.kwh,
         sigma_kg = EXCLUDED.sigma_kg,
         factor_version = EXCLUDED.factor_version,
         updated_at = now()`,
      [user.id, body.date, JSON.stringify(body), result.total, result.by.transport,
       result.by.energy, result.by.food, result.by.waste, result.kwh, result.sigma,
       REGISTRY_VERSION]
    );

    await bust('league:');
    return { ok: true, date: body.date, total: result.total, factorVersion: REGISTRY_VERSION };
  });

  /** A user's own history. */
  app.get('/api/logs', async (req, reply) => {
    const email = ((req.query as { email?: string }).email
      ?? (req.headers['x-user-email'] as string | undefined))?.toLowerCase();
    if (!email) return reply.code(401).send({ error: 'no user identified' });

    const rows = await query<{ payload: DayLog }>(
      `SELECT payload FROM day_logs l
         JOIN users u ON u.id = l.user_id
        WHERE u.email = $1
        ORDER BY l.log_date ASC`,
      [email]
    );
    return rows.map(r => r.payload);
  });

  /** Accept or complete a challenge. */
  app.post('/api/challenges', async (req, reply) => {
    const c = req.body as Challenge & { email?: string };
    const email = (c.email ?? (req.headers['x-user-email'] as string | undefined))?.toLowerCase();
    if (!email) return reply.code(401).send({ error: 'no user identified' });

    const user = await one<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
    if (!user) return reply.code(404).send({ error: 'unknown user' });

    await query(
      `INSERT INTO challenges
         (id, user_id, suggestion_id, title, saving_kg, points, started_at, ends_at, done, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         done = EXCLUDED.done,
         completed_at = EXCLUDED.completed_at`,
      [c.id, user.id, c.suggestionId, c.title, c.saving, c.points,
       c.startedAt, c.endsAt, c.done, c.completedAt ?? null]
    );

    // Points are awarded on completion, and only once.
    if (c.done) {
      await query(
        `UPDATE users SET green_points = green_points + $2
          WHERE id = $1 AND NOT EXISTS (
            SELECT 1 FROM challenges WHERE id = $3 AND done AND completed_at < now() - INTERVAL '1 second'
          )`,
        [user.id, c.points, c.id]
      );
    }
    return { ok: true };
  });

  /** Server-side recommendations, from the same rule engine the PWA runs. */
  app.get('/api/recommendations', async (req, reply) => {
    const email = ((req.query as { email?: string }).email
      ?? (req.headers['x-user-email'] as string | undefined))?.toLowerCase();
    if (!email) return reply.code(401).send({ error: 'no user identified' });

    const rows = await query<{ payload: DayLog }>(
      `SELECT payload FROM day_logs l
         JOIN users u ON u.id = l.user_id
        WHERE u.email = $1 AND l.log_date >= CURRENT_DATE - INTERVAL '21 days'
        ORDER BY l.log_date ASC`,
      [email]
    );
    return recommend(rows.map(r => r.payload), { limit: 3 });
  });
}
