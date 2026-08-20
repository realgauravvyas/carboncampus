/**
 * CarbonCampus — Emission Engine
 * ------------------------------
 * Emissions (kg CO2e) = Activity Data × Emission Factor.
 *
 * The engine never hard-codes a number: it reads everything from the factor
 * registry, so a new campus pack changes results without changing this file.
 * Every result carries an uncertainty band, propagated in quadrature from the
 * per-factor uncertainties published in the registry.
 *
 * This module is imported by both the PWA and the API, so the number a student
 * sees and the number in the institute's report come from the same code path.
 */

import {
  APPLIANCES, EQUIV, FOOD, FOOD_EXTRAS, GRID, TRANSPORT, WASTE, WASTE_LEVELS
} from './factors.js';
import type {
  ApplianceKey, CategoryKey, DayLog, DayResult, LineItem, MealType,
  QuizAnswers, RangeResult, Trip, WasteItem
} from './types.js';

export const CATEGORIES: { key: CategoryKey; label: string; icon: string; color: string }[] = [
  { key: 'transport', label: 'Transport', icon: '🚌', color: '#1E8449' },
  { key: 'energy',    label: 'Energy',    icon: '⚡', color: '#F2B705' },
  { key: 'food',      label: 'Food',      icon: '🍛', color: '#2E86C1' },
  { key: 'waste',     label: 'Waste',     icon: '♻️', color: '#B7472A' }
];

export const CATEGORY_COLOR: Record<CategoryKey, string> =
  Object.fromEntries(CATEGORIES.map(c => [c.key, c.color])) as Record<CategoryKey, string>;

/** An empty, well-formed day log. */
export function blankLog(date: string): DayLog {
  return {
    date,
    transport: [],
    energy: { fan: 0, light: 0, laptop: 0, desktop: 0, ac: 0, geyser: 0, heater: 0, fridge: 0, lab: 0 },
    food: { meals: [], tea: 0, outside: 0, waste: 'none' },
    waste: { bottle: 0, cup: 0, bag: 0, paper: 0, parcel: 0, ewaste: 0 },
    template: null
  };
}

interface Partial_ { kg: number; varr: number; items: LineItem[]; kwh?: number }

/* ------------------------------------------------------------------ *
 * Per-category calculators
 * ------------------------------------------------------------------ */

function calcTransport(trips: Trip[] = []): Partial_ {
  let kg = 0, varr = 0;
  const items: LineItem[] = [];
  for (const t of trips) {
    const f = TRANSPORT[t.mode];
    if (!f || !(t.km > 0)) continue;
    const e = f.ef * t.km;
    kg += e;
    varr += Math.pow(e * f.unc, 2);
    items.push({ label: `${f.label} · ${fmtKm(t.km)}`, icon: f.icon, kg: e });
  }
  return { kg, varr, items };
}

function calcEnergy(energy: Partial<Record<ApplianceKey, number>> = {}): Partial_ {
  let kwh = 0;
  const items: LineItem[] = [];
  for (const [key, hours] of Object.entries(energy) as [ApplianceKey, number][]) {
    const a = APPLIANCES[key];
    if (!a || !(hours > 0)) continue;
    const used = (a.w * hours) / 1000;
    kwh += used;
    items.push({ label: `${a.label} · ${round(hours, 1)} h`, icon: a.icon, kg: used * GRID.ef, kwh: used });
  }
  const kg = kwh * GRID.ef;
  return { kg, varr: Math.pow(kg * GRID.unc, 2), items, kwh };
}

function calcFood(food: DayLog['food']): Partial_ {
  let kg = 0, varr = 0;
  const items: LineItem[] = [];
  const counts: Partial<Record<MealType, number>> = {};
  for (const m of food?.meals ?? []) counts[m] = (counts[m] ?? 0) + 1;

  for (const [type, n] of Object.entries(counts) as [MealType, number][]) {
    const f = FOOD[type];
    if (!f) continue;
    const e = f.ef * n;
    kg += e;
    varr += Math.pow(e * f.unc, 2);
    items.push({ label: `${f.label} × ${n}`, icon: f.icon, kg: e });
  }

  if (food?.tea > 0) {
    const e = FOOD_EXTRAS.tea.ef * food.tea;
    kg += e; varr += Math.pow(e * FOOD_EXTRAS.tea.unc, 2);
    items.push({ label: `Tea / coffee × ${round(food.tea, 1)}`, icon: FOOD_EXTRAS.tea.icon, kg: e });
  }
  if (food?.outside > 0) {
    const e = FOOD_EXTRAS.outside.ef * food.outside;
    kg += e; varr += Math.pow(e * FOOD_EXTRAS.outside.unc, 2);
    items.push({ label: `Delivered order × ${round(food.outside, 1)}`, icon: FOOD_EXTRAS.outside.icon, kg: e });
  }

  const level = WASTE_LEVELS[food?.waste ?? 'none'];
  const mealCount = food?.meals?.length ?? 0;
  if (level && level.kg > 0 && mealCount > 0) {
    const wastedKg = level.kg * mealCount;
    const e = FOOD_EXTRAS.waste.ef * wastedKg;
    kg += e; varr += Math.pow(e * FOOD_EXTRAS.waste.unc, 2);
    items.push({ label: `Plate waste · ${round(wastedKg, 2)} kg`, icon: FOOD_EXTRAS.waste.icon, kg: e });
  }
  return { kg, varr, items };
}

function calcWaste(waste: Partial<Record<WasteItem, number>> = {}): Partial_ {
  let kg = 0, varr = 0;
  const items: LineItem[] = [];
  for (const [key, n] of Object.entries(waste) as [WasteItem, number][]) {
    const f = WASTE[key];
    if (!f || !(n > 0)) continue;
    const e = f.ef * n;
    kg += e; varr += Math.pow(e * f.unc, 2);
    items.push({ label: `${f.label} × ${round(n, 1)}`, icon: f.icon, kg: e });
  }
  return { kg, varr, items };
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** Score one day: totals, per-category detail and an uncertainty band. */
export function computeLog(log: DayLog): DayResult {
  const transport = calcTransport(log.transport);
  const energy    = calcEnergy(log.energy);
  const food      = calcFood(log.food);
  const waste     = calcWaste(log.waste);

  const by: Record<CategoryKey, number> = {
    transport: transport.kg, energy: energy.kg, food: food.kg, waste: waste.kg
  };
  const total = by.transport + by.energy + by.food + by.waste;
  const sigma = Math.sqrt(transport.varr + energy.varr + food.varr + waste.varr);

  return {
    date: log.date,
    total,
    by,
    kwh: energy.kwh ?? 0,
    sigma,
    low: Math.max(0, total - sigma),
    high: total + sigma,
    detail: {
      transport: transport.items, energy: energy.items,
      food: food.items, waste: waste.items
    }
  };
}

/** Score a list of logs and roll them up. */
export function computeRange(logs: DayLog[]): RangeResult {
  const days = logs.map(computeLog).sort((a, b) => a.date.localeCompare(b.date));
  const by: Record<CategoryKey, number> = { transport: 0, energy: 0, food: 0, waste: 0 };
  let total = 0, varr = 0, kwh = 0;
  for (const d of days) {
    total += d.total;
    kwh += d.kwh;
    varr += d.sigma * d.sigma;
    (Object.keys(by) as CategoryKey[]).forEach(k => { by[k] += d.by[k]; });
  }
  const n = days.length || 1;
  return { days, total, by, kwh, sigma: Math.sqrt(varr), perDay: total / n, count: days.length };
}

/**
 * Baseline footprint from the one-time onboarding quiz, as kg CO2e per day.
 * Answers are coarse on purpose — the daily logger refines the estimate.
 */
export function baselineFromQuiz(q: QuizAnswers): DayResult {
  const day = blankLog(todayISO());

  if (q.commuteMode && (q.commuteKm ?? 0) > 0) {
    day.transport.push({ mode: q.commuteMode, km: (q.commuteKm as number) * 2 });
  }
  if ((q.cityTripsPerWeek ?? 0) > 0) {
    day.transport.push({ mode: q.cityMode ?? 'bus', km: ((q.cityTripsPerWeek as number) * 16) / 7 });
  }
  if ((q.flightsPerYear ?? 0) > 0) {
    day.transport.push({ mode: 'flight', km: ((q.flightsPerYear as number) * 1600) / 365 });
  }

  day.energy.fan = q.fanHours ?? 0;
  day.energy.light = q.lightHours ?? 0;
  day.energy.laptop = q.laptopHours ?? 0;
  day.energy.ac = q.acHours ?? 0;
  day.energy.geyser = (q.geyserMinutes ?? 0) / 60;
  day.energy.lab = q.labHours ?? 0;

  // Non-veg meals per week become whole meals per day plus a fractional
  // remainder, added back to the total once the day has been scored.
  const meals: MealType[] = [];
  const nvPerDay = Math.min(q.nonVegMealsPerWeek ?? 0, 21) / 7;
  const whole = Math.min(Math.floor(nvPerDay), 3);
  const frac = nvPerDay - whole;
  for (let i = 0; i < whole; i++) meals.push(q.nonVegType ?? 'chicken');
  while (meals.length < 3) meals.push(q.vegType ?? 'veg');

  day.food.meals = meals;
  day.food.tea = q.teaPerDay ?? 0;
  day.food.outside = (q.outsideOrdersPerWeek ?? 0) / 7;
  day.food.waste = q.plateWaste ?? 'low';

  day.waste.bottle = (q.bottlesPerWeek ?? 0) / 7;
  day.waste.cup = (q.cupsPerWeek ?? 0) / 7;
  day.waste.parcel = (q.parcelsPerMonth ?? 0) / 30;
  day.waste.paper = (q.sheetsPerWeek ?? 0) / 7;

  const res = computeLog(day);
  if (frac > 0) {
    const delta = (FOOD[q.nonVegType ?? 'chicken'].ef - FOOD[q.vegType ?? 'veg'].ef) * frac;
    res.total += delta;
    res.by.food += delta;
    res.low = Math.max(0, res.total - res.sigma);
    res.high = res.total + res.sigma;
  }
  return res;
}

export interface Equivalent {
  key: string; icon: string; value: number; label: string; src: string;
}

/** Turn kilograms of CO2e into things people can picture. */
export function equivalents(kg: number): Equivalent[] {
  return [
    { key: 'tree',   icon: EQUIV.tree.icon,   value: kg / EQUIV.tree.per,   label: EQUIV.tree.label,   src: EQUIV.tree.src },
    { key: 'carKm',  icon: EQUIV.carKm.icon,  value: kg / EQUIV.carKm.per,  label: EQUIV.carKm.label,  src: EQUIV.carKm.src },
    { key: 'phone',  icon: EQUIV.phone.icon,  value: kg / EQUIV.phone.per,  label: EQUIV.phone.label,  src: EQUIV.phone.src },
    { key: 'acHour', icon: EQUIV.acHour.icon, value: kg / EQUIV.acHour.per, label: EQUIV.acHour.label, src: EQUIV.acHour.src }
  ];
}

/* ------------------------------------------------------------------ *
 * Formatting helpers, shared by the PWA and the report generator
 * ------------------------------------------------------------------ */

export function round(n: number, d = 1): number {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

export function fmtKg(kg: number, d = 1): string {
  if (Math.abs(kg) >= 1000) return `${round(kg / 1000, 2)} t`;
  return `${round(kg, d)} kg`;
}

export function fmtKm(km: number): string {
  return km >= 10 ? `${round(km, 0)} km` : `${round(km, 1)} km`;
}

export function fmtNum(n: number): string {
  if (Math.abs(n) >= 1e6) return `${round(n / 1e6, 1)}M`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (Math.abs(n) >= 100) return Math.round(n).toLocaleString('en-IN');
  if (Math.abs(n) >= 10) return round(n, 0).toString();
  return round(n, 1).toString();
}

export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return isoDate(d);
}

export function isoDate(d: Date): string {
  // Local date, not UTC — a log belongs to the day the student lived it.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function prettyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Consecutive days logged, counting back from today. */
export function streakFrom(dates: string[]): number {
  const set = new Set(dates);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = todayISO(-i);
    if (set.has(d)) streak++;
    else if (i > 0) break;               // today not yet logged is forgiven
  }
  return streak;
}
