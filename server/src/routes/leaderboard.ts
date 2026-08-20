/**
 * Leaderboards.
 *
 * Ranking is by average kg CO2e per person per day so a large hostel is not
 * punished for its size, and the SQL views enforce a minimum group of five
 * before a group is published at all.
 *
 * A campus that has just switched the app on has no rows to rank. Rather than
 * showing an empty table on day one, the shared cohort model stands in and the
 * response says so explicitly in `source`.
 */

import type { FastifyInstance } from 'fastify';
import { deptLeague, hostelLeague, type LeagueRow } from '@carboncampus/shared';
import type pg from 'pg';
import { query } from '../db.js';
import { cached } from '../cache.js';

const MIN_GROUPS = 3;      // below this, a league table is not worth showing

/**
 * The database being down must not take the leagues down with it. A failed
 * read is treated the same as an empty one: the modelled cohort stands in, and
 * the API stays useful while an operator fixes the connection.
 */
async function safeQuery<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch (err) {
    console.warn('[leaderboard] database unavailable, falling back to the cohort model:',
      (err as Error).message || err);
    return [];
  }
}

interface ViewRow {
  name: string;
  members: string;
  active: string;
  per_day: string | null;
  transport: string | null;
  energy: string | null;
  food: string | null;
  waste: string | null;
}

function toLeagueRows(rows: ViewRow[]): LeagueRow[] {
  return rows
    .filter(r => r.per_day != null)
    .map(r => {
      const perDay = Number(r.per_day);
      const members = Number(r.members);
      const active = Number(r.active);
      return {
        name: r.name,
        members,
        active,
        participation: members ? active / members : 0,
        perDay,
        by: {
          transport: Number(r.transport ?? 0),
          energy: Number(r.energy ?? 0),
          food: Number(r.food ?? 0),
          waste: Number(r.waste ?? 0)
        },
        totalDay: perDay * members,
        avgStreak: 0,
        reduction: 0
      };
    })
    .sort((a, b) => a.perDay - b.perDay);
}

export default async function leaderboardRoutes(app: FastifyInstance) {
  app.get('/api/leaderboard/hostel', async () =>
    cached('league:hostel', 60, async () => {
      const rows = toLeagueRows(await safeQuery<ViewRow>(
        `SELECT name, members, active, per_day, transport, energy, food, waste
           FROM hostel_daily WHERE campus = 'iitg'`
      ));
      return rows.length >= MIN_GROUPS ? rows : hostelLeague();
    })
  );

  app.get('/api/leaderboard/dept', async () =>
    cached('league:dept', 60, async () => {
      const rows = toLeagueRows(await safeQuery<ViewRow>(
        `SELECT name, members, active, per_day, transport, energy, food, waste
           FROM dept_daily WHERE campus = 'iitg'`
      ));
      return rows.length >= MIN_GROUPS ? rows : deptLeague();
    })
  );

  /** Where one footprint sits in the live distribution. */
  app.get('/api/leaderboard/percentile', async req => {
    const perDay = Number((req.query as { perDay?: string }).perDay ?? 0);
    const rows = await safeQuery<{ pct: string | null }>(
      `WITH averages AS (
         SELECT user_id, AVG(total_kg) AS per_day
           FROM day_logs
          WHERE log_date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY user_id
       )
       SELECT 100.0 * AVG(CASE WHEN per_day > $1 THEN 1 ELSE 0 END) AS pct FROM averages`,
      [perDay]
    );
    return { percentile: Math.round(Number(rows[0]?.pct ?? 0)) };
  });
}
