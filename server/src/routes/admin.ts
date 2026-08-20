/**
 * Institutional routes: the campus inventory, and the factor registry it was
 * computed with.
 *
 * Nothing here can return an individual. Every query aggregates, and groups
 * below MIN_GROUP people are dropped before the response is built.
 */

import type { FastifyInstance } from 'fastify';
import {
  CAMPUS, REGISTRY_UPDATED, REGISTRY_VERSION, SOURCE_LIST, auditTrail,
  campusInventory, round
} from '@carboncampus/shared';
import type pg from 'pg';
import { query } from '../db.js';
import { cached } from '../cache.js';

const MIN_GROUP = 5;

/** A database outage degrades the report to the modelled inventory, not a 500. */
async function safeQuery<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch (err) {
    console.warn('[admin] database unavailable, falling back to the cohort model:',
      (err as Error).message || err);
    return [];
  }
}

export default async function adminRoutes(app: FastifyInstance) {
  /**
   * Campus emission inventory for a period, structured on GHG Protocol
   * categories so it can be dropped into an ISO 14064-1 style report.
   */
  app.get('/api/admin/report', async (req, reply) => {
    const q = req.query as { days?: string; format?: string };
    const days = Math.min(Math.max(Number(q.days ?? 30), 1), 365);

    const report = await cached(`admin:report:${days}`, 120, async () => {
      const totals = await safeQuery<{
        total: string | null; transport: string | null; energy: string | null;
        food: string | null; waste: string | null; kwh: string | null;
        reporting: string; days_logged: string;
      }>(
        `SELECT SUM(total_kg) AS total, SUM(transport_kg) AS transport,
                SUM(energy_kg) AS energy, SUM(food_kg) AS food, SUM(waste_kg) AS waste,
                SUM(kwh) AS kwh, COUNT(DISTINCT user_id) AS reporting,
                COUNT(*) AS days_logged
           FROM day_logs
          WHERE log_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL`,
        [days]
      );

      const population = await safeQuery<{ n: string }>(
        `SELECT COUNT(*) AS n FROM users WHERE campus = 'iitg'`
      );

      const byHostel = await safeQuery<{ name: string; members: string; per_day: string | null }>(
        `SELECT u.hostel AS name, COUNT(DISTINCT u.id) AS members, AVG(l.total_kg) AS per_day
           FROM users u
           LEFT JOIN day_logs l ON l.user_id = u.id
            AND l.log_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
          WHERE u.hostel IS NOT NULL
          GROUP BY u.hostel
         HAVING COUNT(DISTINCT u.id) >= $2
          ORDER BY AVG(l.total_kg) NULLS LAST`,
        [days, MIN_GROUP]
      );

      const t = totals[0];
      const measured = Number(t?.total ?? 0);
      const reporting = Number(t?.reporting ?? 0);
      const pop = Number(population[0]?.n ?? 0);

      // With no rows yet, fall back to the modelled inventory so the portal has
      // something to show, and label it honestly.
      if (measured === 0) {
        const modelled = campusInventory(days);
        return {
          source: 'modelled' as const,
          note: 'No logged days in this period yet — figures come from the shared cohort model.',
          campus: CAMPUS.name,
          periodDays: days,
          factorVersion: REGISTRY_VERSION,
          population: modelled.population,
          reporting: modelled.reporting,
          coverage: round(modelled.coverage, 3),
          totals: {
            kgCO2e: round(modelled.totalKg, 1),
            tonnesCO2e: round(modelled.totalTonnes, 3),
            perCapitaPerDay: round(modelled.perCapitaDay, 3)
          },
          byCategory: {
            transport: round(modelled.by.transport, 1),
            energy: round(modelled.by.energy, 1),
            food: round(modelled.by.food, 1),
            waste: round(modelled.by.waste, 1)
          },
          byHostel: []
        };
      }

      return {
        source: 'measured' as const,
        note: `Aggregated from ${Number(t?.days_logged ?? 0)} logged days. Groups under ${MIN_GROUP} people are suppressed.`,
        campus: CAMPUS.name,
        periodDays: days,
        factorVersion: REGISTRY_VERSION,
        population: pop,
        reporting,
        coverage: pop ? round(reporting / pop, 3) : 0,
        totals: {
          kgCO2e: round(measured, 1),
          tonnesCO2e: round(measured / 1000, 3),
          perCapitaPerDay: reporting ? round(measured / reporting / days, 3) : 0,
          kwh: round(Number(t?.kwh ?? 0), 1)
        },
        byCategory: {
          transport: round(Number(t?.transport ?? 0), 1),
          energy: round(Number(t?.energy ?? 0), 1),
          food: round(Number(t?.food ?? 0), 1),
          waste: round(Number(t?.waste ?? 0), 1)
        },
        byHostel: byHostel.map(h => ({
          hostel: h.name,
          members: Number(h.members),
          kgPerPersonDay: h.per_day ? round(Number(h.per_day), 3) : null
        }))
      };
    });

    if (q.format === 'csv') {
      const lines = [
        `# CarbonCampus campus inventory (${report.source})`,
        `# Campus,${report.campus}`,
        `# Period days,${report.periodDays}`,
        `# Factor registry,v${report.factorVersion}`,
        '',
        'category,kg_co2e,tonnes_co2e'
      ];
      for (const [k, v] of Object.entries(report.byCategory)) {
        lines.push(`${k},${v},${round(Number(v) / 1000, 3)}`);
      }
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename="carboncampus-inventory.csv"');
      return lines.join('\n');
    }
    return report;
  });

  /**
   * The factor registry as served data — the auditable trail behind every
   * number, including the source links.
   */
  app.get('/api/factors', async () => ({
    version: REGISTRY_VERSION,
    updated: REGISTRY_UPDATED,
    campus: { id: CAMPUS.id, name: CAMPUS.name, gridRegion: CAMPUS.gridRegion },
    method: 'Emissions (kg CO2e) = Activity Data × Emission Factor (IPCC Tier 1)',
    factors: auditTrail(),
    sources: SOURCE_LIST
  }));
}
