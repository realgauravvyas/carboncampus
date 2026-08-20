/**
 * Seeds a campus into PostgreSQL so the API has something to serve.
 *
 * Every seeded user is flagged `synthetic = TRUE` in the database. They are a
 * modelled population for demos and load testing, never presented as real
 * students, and `DELETE FROM users WHERE synthetic` removes them cleanly.
 *
 *   npm run seed --workspace @carboncampus/server
 */

import {
  REGISTRY_VERSION, REGISTRY_UPDATED, CAMPUS, SOURCE_LIST, auditTrail,
  cohort, computeLog, demoHistory, type Persona
} from '@carboncampus/shared';
import { pool, migrate, query } from './db.js';

const SEED_USERS = 240;      // a realistic pilot cohort, not the whole campus
const DAYS = 30;

function personaFor(index: number): Persona {
  if (index % 7 === 0) return 'heavyUser';
  if (index % 3 === 0) return 'dayScholar';
  return 'hosteller';
}

async function main() {
  console.log('Applying schema…');
  await migrate();

  console.log('Publishing the factor registry…');
  await query(
    `INSERT INTO factor_registry (version, published_at, campus, registry, sources)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (version) DO UPDATE SET
       registry = EXCLUDED.registry, sources = EXCLUDED.sources`,
    [REGISTRY_VERSION, REGISTRY_UPDATED, CAMPUS.id,
     JSON.stringify(auditTrail()), JSON.stringify(SOURCE_LIST)]
  );

  const people = cohort().students.slice(0, SEED_USERS);
  console.log(`Seeding ${people.length} synthetic users with ${DAYS} days each…`);

  let logRows = 0;
  for (const [i, person] of people.entries()) {
    const email = `${person.id.toLowerCase()}@demo.carboncampus.invalid`;
    const rows = await query<{ id: string }>(
      `INSERT INTO users (email, name, role, hostel, dept, year, campus, synthetic)
       VALUES ($1, $2, 'student', $3, $4, $5, $6, TRUE)
       ON CONFLICT (email) DO UPDATE SET hostel = EXCLUDED.hostel
       RETURNING id`,
      [email, `Resident ${person.id}`, person.hostel, person.dept, person.year, CAMPUS.id]
    );
    const userId = rows[0].id;

    // Deterministic per user, so re-running the seed is idempotent.
    const history = demoHistory(DAYS, personaFor(i), 1000 + i);
    for (const log of history) {
      const r = computeLog(log);
      await query(
        `INSERT INTO day_logs
           (user_id, log_date, payload, total_kg, transport_kg, energy_kg, food_kg,
            waste_kg, kwh, sigma_kg, factor_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (user_id, log_date) DO UPDATE SET
           payload = EXCLUDED.payload, total_kg = EXCLUDED.total_kg,
           transport_kg = EXCLUDED.transport_kg, energy_kg = EXCLUDED.energy_kg,
           food_kg = EXCLUDED.food_kg, waste_kg = EXCLUDED.waste_kg,
           kwh = EXCLUDED.kwh, sigma_kg = EXCLUDED.sigma_kg, updated_at = now()`,
        [userId, log.date, JSON.stringify(log), r.total, r.by.transport, r.by.energy,
         r.by.food, r.by.waste, r.kwh, r.sigma, REGISTRY_VERSION]
      );
      logRows++;
    }
    if ((i + 1) % 40 === 0) console.log(`  … ${i + 1}/${people.length} users`);
  }

  const summary = await query<{ users: string; logs: string; avg: string }>(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM day_logs) AS logs,
            (SELECT ROUND(AVG(total_kg), 2) FROM day_logs) AS avg`
  );
  console.log(`Done. ${summary[0].users} users, ${summary[0].logs} logs (${logRows} written), ` +
              `campus average ${summary[0].avg} kg CO2e/day.`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
