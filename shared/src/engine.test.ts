/**
 * Engine tests — run with `npm test` at the repo root.
 *
 * These are the checks that keep the numbers honest: hand-computed expectations,
 * additivity, uncertainty behaviour, and sanity bounds against published
 * per-capita figures.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { blankLog, computeLog, computeRange, equivalents, streakFrom, todayISO } from './engine.js';
import { FOOD, GRID, TRANSPORT, WASTE, auditTrail, REGISTRY_VERSION } from './factors.js';
import { recommend, habitProfile } from './recommend.js';
import { cohort, percentile, hostelLeague, campusInventory } from './cohort.js';
import { demoHistory } from './seed.js';
import { SOURCES } from './sources.js';
import type { DayLog } from './types.js';

const approx = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) < tol, `${a} != ${b} (tolerance ${tol})`);

test('a single car trip equals distance × factor', () => {
  const log = blankLog('2026-08-20');
  log.transport.push({ mode: 'car', km: 10 });
  const r = computeLog(log);
  approx(r.by.transport, 10 * TRANSPORT.car.ef);
  approx(r.total, 10 * TRANSPORT.car.ef);
});

test('electricity converts hours × watts × grid factor', () => {
  const log = blankLog('2026-08-20');
  log.energy.ac = 4;                       // 1500 W for 4 h = 6 kWh
  const r = computeLog(log);
  approx(r.kwh, 6);
  approx(r.by.energy, 6 * GRID.ef);
});

test('meals add up and mutton dominates chicken', () => {
  const log = blankLog('2026-08-20');
  log.food.meals = ['veg', 'chicken', 'mutton'];
  const r = computeLog(log);
  approx(r.by.food, FOOD.veg.ef + FOOD.chicken.ef + FOOD.mutton.ef);
  assert.ok(FOOD.mutton.ef > 2 * FOOD.chicken.ef);
});

test('walking and cycling are exactly zero', () => {
  const log = blankLog('2026-08-20');
  log.transport.push({ mode: 'walk', km: 5 }, { mode: 'cycle', km: 12 });
  assert.equal(computeLog(log).total, 0);
});

test('categories sum to the total', () => {
  const log = demoHistory(1, 'heavyUser')[0];
  const r = computeLog(log);
  approx(r.total, r.by.transport + r.by.energy + r.by.food + r.by.waste, 1e-9);
});

test('uncertainty band brackets the estimate and never goes negative', () => {
  const log = demoHistory(1, 'hosteller')[0];
  const r = computeLog(log);
  assert.ok(r.low >= 0);
  assert.ok(r.low <= r.total && r.total <= r.high);
  assert.ok(r.sigma > 0);
});

test('uncertainty grows sub-linearly across days (errors partly cancel)', () => {
  const logs = demoHistory(16, 'hosteller');
  const range = computeRange(logs);
  const summed = range.days.reduce((a, d) => a + d.sigma, 0);
  assert.ok(range.sigma < summed, 'quadrature sum must be below the arithmetic sum');
});

test('a range totals what its days total', () => {
  const logs = demoHistory(10, 'dayScholar');
  const range = computeRange(logs);
  approx(range.total, range.days.reduce((a, d) => a + d.total, 0), 1e-8);
  approx(range.perDay, range.total / 10, 1e-8);
});

test('demo personas land in a believable per-capita band', () => {
  // India averages roughly 2 t CO2e per person a year (about 5.5 kg a day);
  // a student on campus should sit in single-digit kg per day.
  for (const persona of ['hosteller', 'dayScholar', 'heavyUser'] as const) {
    const r = computeRange(demoHistory(30, persona));
    assert.ok(r.perDay > 1.5 && r.perDay < 20,
      `${persona} produced ${r.perDay.toFixed(2)} kg/day, outside the plausible band`);
  }
});

test('the heavy persona emits more than the hostel resident', () => {
  const heavy = computeRange(demoHistory(30, 'heavyUser')).perDay;
  const hostel = computeRange(demoHistory(30, 'hosteller')).perDay;
  assert.ok(heavy > hostel);
});

test('demo history is deterministic for a given seed', () => {
  const a = computeRange(demoHistory(20, 'hosteller', 42)).total;
  const b = computeRange(demoHistory(20, 'hosteller', 42)).total;
  approx(a, b, 1e-12);
});

test('the recommender only fires on habits that exist', () => {
  const clean = blankLog(todayISO());
  clean.transport.push({ mode: 'cycle', km: 4 });
  clean.food.meals = ['veg', 'veg', 'vegan'];
  const suggestions = recommend([clean]);
  assert.ok(!suggestions.some(s => s.id === 'shift-to-shuttle'),
    'no private vehicle logged, so no shuttle swap should be offered');
});

test('the recommender finds the car habit and prices it', () => {
  const logs: DayLog[] = [];
  for (let i = 1; i <= 7; i++) {
    const l = blankLog(todayISO(-i));
    l.transport.push({ mode: 'car', km: 12 });
    logs.push(l);
  }
  const top = recommend(logs);
  const shuttle = top.find(s => s.id === 'shift-to-shuttle');
  assert.ok(shuttle, 'expected the shuttle swap to be recommended');
  // 84 km/week, half shifted, (0.171 - 0.045) kg/km, 4.345 weeks
  approx(shuttle!.saving, 42 * (TRANSPORT.car.ef - TRANSPORT.shuttle.ef) * 4.345, 1e-6);
});

test('the recommender returns at most three swaps, ranked', () => {
  const top = recommend(demoHistory(21, 'heavyUser'));
  assert.ok(top.length <= 3);
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].score >= top[i].score);
});

test('habit profile scales daily logs to weekly rates', () => {
  const logs: DayLog[] = [];
  for (let i = 1; i <= 14; i++) {
    const l = blankLog(todayISO(-i));
    l.waste.bottle = 2;
    logs.push(l);
  }
  const p = habitProfile(logs);
  approx(p.items.bottle!, 14, 1e-9);   // 2 a day is 14 a week
});

test('streaks count consecutive days back from today', () => {
  const dates = [todayISO(-0), todayISO(-1), todayISO(-2), todayISO(-4)];
  assert.equal(streakFrom(dates), 3);
});

test('an unlogged today does not break yesterday\'s streak', () => {
  const dates = [todayISO(-1), todayISO(-2)];
  assert.equal(streakFrom(dates), 2);
});

test('equivalents invert cleanly', () => {
  const eq = equivalents(21);
  const trees = eq.find(e => e.key === 'tree')!;
  approx(trees.value, 1, 1e-9);
});

test('the synthetic cohort is stable and sensibly shaped', () => {
  const c = cohort();
  assert.equal(c.population, 13 * 92);
  assert.ok(c.campusAvgDay > 4 && c.campusAvgDay < 10);
  assert.equal(c.students.length, cohort().students.length);   // cached, not rebuilt
});

test('percentile rewards a lower footprint', () => {
  assert.ok(percentile(2) > percentile(12));
});

test('the hostel league is sorted cleanest-first and folds the user in', () => {
  const rows = hostelLeague('Kameng', 1.0);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].perDay <= rows[i].perDay);
  assert.ok(rows.find(r => r.name === 'Kameng')!.youAreHere);
});

test('campus inventory scales linearly with the reporting window', () => {
  const a = campusInventory(30).totalKg;
  const b = campusInventory(60).totalKg;
  approx(b, a * 2, 1e-6);
});

test('every factor in the registry cites a resolvable source', () => {
  const rows = auditTrail();
  assert.ok(rows.length > 25);
  for (const row of rows) {
    assert.ok(row.src && row.src.length > 10, `${row.key} has no prose citation`);
    assert.ok(row.sources.length > 0, `${row.key} has no linked source`);
    for (const s of row.sources) assert.match(s.url, /^https:\/\//);
  }
});

test('every registered source has an organisation, a year and an https link', () => {
  for (const s of Object.values(SOURCES)) {
    assert.ok(s.org.length > 3, `${s.id} has no organisation`);
    assert.ok(s.year.length >= 4, `${s.id} has no year`);
    assert.match(s.url, /^https:\/\//);
  }
});

test('factors stay within physically sensible bounds', () => {
  for (const [mode, f] of Object.entries(TRANSPORT)) {
    assert.ok(f.ef >= 0 && f.ef < 0.5, `${mode} factor looks wrong: ${f.ef}`);
  }
  for (const [meal, f] of Object.entries(FOOD)) {
    assert.ok(f.ef > 0.3 && f.ef < 10, `${meal} factor looks wrong: ${f.ef}`);
  }
  for (const [item, f] of Object.entries(WASTE)) {
    assert.ok(f.ef > 0 && f.ef < 5, `${item} factor looks wrong: ${f.ef}`);
  }
  assert.ok(GRID.ef > 0.5 && GRID.ef < 1.0);
});

test('the registry declares a version', () => {
  assert.match(REGISTRY_VERSION, /^\d+\.\d+\.\d+$/);
});
