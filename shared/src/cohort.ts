/**
 * CarbonCampus — Campus cohort model
 * ----------------------------------
 * Leaderboards, peer comparison and the campus inventory all need a population
 * to compare against. In production that population is real users read from
 * Postgres (see server/src/routes/leaderboard.ts, which calls into this module
 * only when the database has fewer rows than a league needs).
 *
 * For the public demo the cohort is generated from a seeded PRNG: deterministic,
 * so the same campus shows the same numbers on every device and every reload,
 * and clearly synthetic rather than pretending to be real students. The signed-in
 * user's own logs are always real and are merged on top.
 */

import { CAMPUS } from './factors.js';
import { todayISO } from './engine.js';
import type { CategoryKey, LeagueRow } from './types.js';

/** mulberry32 — small, fast, seedable PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable string hash, so a name always maps to the same seed. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Box-Muller draw, floored so the tails stay physically sensible. */
function normal(rand: () => number, mean_: number, sd: number): number {
  const u = Math.max(rand(), 1e-9), v = Math.max(rand(), 1e-9);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(mean_ * 0.35, mean_ + z * sd);
}

export interface CohortMember {
  id: string;
  hostel: string;
  dept: string;
  year: number;
  perDay: number;
  by: Record<CategoryKey, number>;
  active: boolean;
  streak: number;
  reduction: number;
  acted: boolean;
}

export interface Cohort {
  students: CohortMember[];
  byHostel: LeagueRow[];
  byDept: LeagueRow[];
  campusAvgDay: number;
  population: number;
  activeCount: number;
  weeks: { week: string; label: string; kg: number }[];
  generatedFor: string;
}

const POP_PER_HOSTEL = 92;      // about 1,200 residents across 13 hostels
const CAMPUS_MEAN_DAY = 6.85;   // kg CO2e/day, i.e. the 2.5 t/year baseline
const SPLIT: Record<CategoryKey, number> = {
  transport: 0.30, energy: 0.33, food: 0.29, waste: 0.08
};

let CACHE: Cohort | null = null;

/** Build (once) the full synthetic population and its aggregates. */
export function cohort(): Cohort {
  if (CACHE) return CACHE;

  const students: CohortMember[] = [];
  const depts = CAMPUS.departments;

  for (const hostel of CAMPUS.hostels) {
    const rand = rng(hash('hostel:' + hostel));
    // Each hostel gets a mild intensity offset: older blocks run hotter and
    // AC penetration differs. That spread is what makes a league table useful.
    const hostelBias = 0.86 + rand() * 0.30;
    const participation = 0.22 + rand() * 0.38;

    for (let i = 0; i < POP_PER_HOSTEL; i++) {
      const r = rng(hash(`${hostel}:${i}`));
      const perDay = normal(r, CAMPUS_MEAN_DAY * hostelBias, 1.9);

      const by = {} as Record<CategoryKey, number>;
      let sum = 0;
      for (const [k, share] of Object.entries(SPLIT) as [CategoryKey, number][]) {
        const jitter = 0.6 + r() * 0.9;
        by[k] = share * jitter;
        sum += by[k];
      }
      for (const k of Object.keys(by) as CategoryKey[]) by[k] = (by[k] / sum) * perDay;

      const active = r() < participation;
      students.push({
        id: `${hostel.slice(0, 3).toUpperCase()}-${String(i).padStart(3, '0')}`,
        hostel,
        dept: depts[Math.floor(r() * depts.length)],
        year: 1 + Math.floor(r() * 4),
        perDay,
        by,
        active,
        streak: active ? Math.floor(r() * 34) : 0,
        reduction: active ? 0.04 + r() * 0.19 : 0,
        acted: active && r() < 0.62
      });
    }
  }

  CACHE = {
    students,
    byHostel: groupBy(students, s => s.hostel, CAMPUS.hostels),
    byDept: groupBy(students, s => s.dept, CAMPUS.departments),
    campusAvgDay: mean(students.map(s => s.perDay)),
    population: students.length,
    activeCount: students.filter(s => s.active).length,
    weeks: campusWeeks(students),
    generatedFor: CAMPUS.name
  };
  return CACHE;
}

function groupBy(
  students: CohortMember[],
  keyFn: (s: CohortMember) => string,
  order: string[]
): LeagueRow[] {
  const map = new Map<string, CohortMember[]>(order.map(k => [k, [] as CohortMember[]]));
  for (const s of students) {
    const k = keyFn(s);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(s);
  }
  return [...map.entries()]
    .filter(([, arr]) => arr.length > 0)
    .map(([name, arr]) => {
      const active = arr.filter(s => s.active);
      const by: Record<CategoryKey, number> = { transport: 0, energy: 0, food: 0, waste: 0 };
      for (const s of arr) {
        for (const k of Object.keys(by) as CategoryKey[]) by[k] += s.by[k];
      }
      return {
        name,
        members: arr.length,
        active: active.length,
        participation: active.length / arr.length,
        perDay: mean(arr.map(s => s.perDay)),
        by,
        totalDay: arr.reduce((a, s) => a + s.perDay, 0),
        avgStreak: active.length ? mean(active.map(s => s.streak)) : 0,
        reduction: active.length ? mean(active.map(s => s.reduction)) : 0
      };
    });
}

/** Twelve weeks of campus-level history, trending gently downward. */
function campusWeeks(students: CohortMember[]) {
  const base = students.reduce((a, s) => a + s.perDay, 0) * 7; // kg per week
  const rand = rng(hash('campus-weeks'));
  const out: { week: string; label: string; kg: number }[] = [];
  for (let w = 11; w >= 0; w--) {
    const drift = 1 + w * 0.011;              // it ran hotter before the pilot
    const noise = 0.97 + rand() * 0.06;
    const d = new Date();
    d.setDate(d.getDate() - w * 7);
    out.push({
      week: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      kg: base * drift * noise
    });
  }
  return out;
}

/**
 * Where a daily footprint sits in the campus distribution.
 * Returns the percentile of lowest emitters — higher is better.
 */
export function percentile(perDay: number): number {
  const all = cohort().students.map(s => s.perDay).sort((a, b) => a - b);
  let lo = 0, hi = all.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (all[mid] < perDay) lo = mid + 1; else hi = mid;
  }
  return Math.round(100 * (1 - lo / all.length));
}

/** Peer cohort: same hostel, same year — a fairer mirror than the whole campus. */
export function peerAverage(hostel: string, year: number): number {
  const peers = cohort().students.filter(s => s.hostel === hostel && s.year === year);
  if (!peers.length) return cohort().campusAvgDay;
  return mean(peers.map(s => s.perDay));
}

/** Hostel league table, cleanest first, with the user folded into their hostel. */
export function hostelLeague(userHostel?: string, userPerDay = 0): LeagueRow[] {
  const rows = cohort().byHostel.map(h => ({ ...h }));
  if (userHostel && userPerDay > 0) {
    const row = rows.find(r => r.name === userHostel);
    if (row) {
      const n = row.members + 1;
      row.perDay = (row.perDay * row.members + userPerDay) / n;
      row.members = n;
      row.active += 1;
      row.participation = row.active / n;
      row.youAreHere = true;
    }
  }
  return rows.sort((a, b) => a.perDay - b.perDay);
}

export function deptLeague(): LeagueRow[] {
  return cohort().byDept.slice().sort((a, b) => a.perDay - b.perDay);
}

export const mean = (arr: number[]): number =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

/** Rolling campus counters for the dashboard hero strip. */
export function campusCounters() {
  const c = cohort();
  const avoidedKgYear = c.students
    .filter(s => s.active)
    .reduce((a, s) => a + s.perDay * 365 * s.reduction, 0);
  return {
    users: c.population,
    active: c.activeCount,
    avoidedKgYear,
    treesEquivalent: avoidedKgYear / 21,
    updated: todayISO()
  };
}

/** Campus inventory for the admin portal, in tonnes CO2e for a period. */
export function campusInventory(days = 30) {
  const c = cohort();
  const by: Record<CategoryKey, number> = { transport: 0, energy: 0, food: 0, waste: 0 };
  for (const s of c.students) {
    for (const k of Object.keys(by) as CategoryKey[]) by[k] += s.by[k] * days;
  }
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  return {
    days,
    totalKg: total,
    totalTonnes: total / 1000,
    by,
    perCapitaDay: total / days / c.population,
    population: c.population,
    reporting: c.activeCount,
    coverage: c.activeCount / c.population
  };
}
