-- CarbonCampus — PostgreSQL schema
--
-- Design notes:
--  * The raw log is kept as JSONB exactly as the client sent it, and the
--    computed totals are stored alongside it. Recomputation is therefore always
--    possible, and dashboards never have to re-run the engine over history.
--  * Every row records the factor registry version that produced its numbers,
--    so publishing a new grid factor never silently rewrites last year's report.
--  * Aggregates are grouped by hostel and department, never by individual, and
--    the reporting views enforce a minimum group size.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'student'
                     CHECK (role IN ('student', 'faculty', 'staff')),
  hostel           TEXT,
  dept             TEXT,
  year             INTEGER CHECK (year BETWEEN 1 AND 8),
  campus           TEXT NOT NULL DEFAULT 'iitg',
  baseline_per_day NUMERIC(8, 3),
  green_points     INTEGER NOT NULL DEFAULT 0,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  synthetic        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS users_campus_hostel_idx ON users (campus, hostel);
CREATE INDEX IF NOT EXISTS users_campus_dept_idx ON users (campus, dept);

CREATE TABLE IF NOT EXISTS day_logs (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  log_date       DATE NOT NULL,
  payload        JSONB NOT NULL,
  total_kg       NUMERIC(10, 4) NOT NULL,
  transport_kg   NUMERIC(10, 4) NOT NULL DEFAULT 0,
  energy_kg      NUMERIC(10, 4) NOT NULL DEFAULT 0,
  food_kg        NUMERIC(10, 4) NOT NULL DEFAULT 0,
  waste_kg       NUMERIC(10, 4) NOT NULL DEFAULT 0,
  kwh            NUMERIC(10, 4) NOT NULL DEFAULT 0,
  sigma_kg       NUMERIC(10, 4) NOT NULL DEFAULT 0,
  factor_version TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

-- The two access patterns: one student's history, and everyone on a given day.
CREATE INDEX IF NOT EXISTS day_logs_user_date_idx ON day_logs (user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS day_logs_date_idx ON day_logs (log_date DESC);

CREATE TABLE IF NOT EXISTS challenges (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  suggestion_id TEXT NOT NULL,
  title         TEXT NOT NULL,
  saving_kg     NUMERIC(10, 3) NOT NULL,
  points        INTEGER NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at       TIMESTAMPTZ NOT NULL,
  done          BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS challenges_user_idx ON challenges (user_id, done);

-- The factor registry is published into the database as well as shipped in the
-- code, so a report can always be re-derived from the exact factors it used.
CREATE TABLE IF NOT EXISTS factor_registry (
  version      TEXT PRIMARY KEY,
  published_at DATE NOT NULL,
  campus       TEXT NOT NULL,
  registry     JSONB NOT NULL,
  sources      JSONB NOT NULL
);

-- Aggregated views. k-anonymity floor of five people per published group.
CREATE OR REPLACE VIEW hostel_daily AS
SELECT
  u.campus,
  u.hostel                                   AS name,
  COUNT(DISTINCT u.id)                       AS members,
  COUNT(DISTINCT l.user_id)                  AS active,
  AVG(l.total_kg)                            AS per_day,
  AVG(l.transport_kg)                        AS transport,
  AVG(l.energy_kg)                           AS energy,
  AVG(l.food_kg)                             AS food,
  AVG(l.waste_kg)                            AS waste
FROM users u
LEFT JOIN day_logs l
  ON l.user_id = u.id AND l.log_date >= CURRENT_DATE - INTERVAL '30 days'
WHERE u.hostel IS NOT NULL
GROUP BY u.campus, u.hostel
HAVING COUNT(DISTINCT u.id) >= 5;

CREATE OR REPLACE VIEW dept_daily AS
SELECT
  u.campus,
  u.dept                                     AS name,
  COUNT(DISTINCT u.id)                       AS members,
  COUNT(DISTINCT l.user_id)                  AS active,
  AVG(l.total_kg)                            AS per_day,
  AVG(l.transport_kg)                        AS transport,
  AVG(l.energy_kg)                           AS energy,
  AVG(l.food_kg)                             AS food,
  AVG(l.waste_kg)                            AS waste
FROM users u
LEFT JOIN day_logs l
  ON l.user_id = u.id AND l.log_date >= CURRENT_DATE - INTERVAL '30 days'
WHERE u.dept IS NOT NULL
GROUP BY u.campus, u.dept
HAVING COUNT(DISTINCT u.id) >= 5;
