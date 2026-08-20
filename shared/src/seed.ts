/**
 * CarbonCampus — demo history generator
 * -------------------------------------
 * Judges and first-time visitors should not have to log for a fortnight before
 * the dashboard says anything. This produces a plausible, deterministic history
 * for a chosen persona: weekday class runs, weekend city trips, mess meals,
 * hostel appliances, and the odd delivery order.
 *
 * It is clearly labelled as demo data everywhere it is used, and one tap clears
 * it. Nothing here is used for the campus aggregates.
 */

import { blankLog, isoDate } from './engine.js';
import type { DayLog, MealType, TransportMode } from './types.js';

export type Persona = 'hosteller' | 'dayScholar' | 'heavyUser';

export const PERSONAS: { id: Persona; name: string; blurb: string }[] = [
  { id: 'hosteller', name: 'Hostel resident',
    blurb: 'Lives on campus, walks or cycles to class, eats in the mess, occasional city run.' },
  { id: 'dayScholar', name: 'Day scholar',
    blurb: 'Commutes in from the city by scooter or bus, brings lunch or eats outside.' },
  { id: 'heavyUser', name: 'AC room + car',
    blurb: 'Air-conditioned room, drives to campus, frequent deliveries — the profile with the most to gain.' }
];

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];

/**
 * Build `days` of history ending yesterday. The last third trends slightly
 * cleaner, so the trend line shows a habit actually changing.
 */
export function demoHistory(days = 30, persona: Persona = 'hosteller', seed = 20260820): DayLog[] {
  const r = rng(seed);
  const out: DayLog[] = [];

  for (let i = days; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const log = blankLog(isoDate(d));
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    // Improvement ramp: the final third of the window is ~15% lighter.
    const improving = i < days / 3 ? 0.85 : 1;

    /* Transport ------------------------------------------------------- */
    if (persona === 'dayScholar') {
      if (!weekend) {
        const mode: TransportMode = r() < 0.55 ? 'scooter' : 'bus';
        log.transport.push({ mode, km: 9 + r() * 6 });
      }
      log.template = weekend ? 'Weekend' : 'Commute day';
    } else if (persona === 'heavyUser') {
      if (!weekend) log.transport.push({ mode: 'car', km: 7 + r() * 5 });
      if (weekend && r() < 0.7) log.transport.push({ mode: 'car', km: 22 + r() * 18 });
      log.template = weekend ? 'Weekend' : 'Class day';
    } else {
      if (!weekend) {
        log.transport.push({ mode: r() < 0.6 ? 'cycle' : 'walk', km: 2.4 + r() * 1.6 });
        if (r() < 0.35) log.transport.push({ mode: 'shuttle', km: 3.6 });
      }
      if (weekend && r() < 0.45) {
        log.transport.push({ mode: pick(r, ['bus', 'auto'] as TransportMode[]), km: 14 + r() * 10 });
      }
      log.template = weekend ? 'Weekend' : 'Class day';
    }
    // A trip home once in the window.
    if (i === Math.floor(days * 0.6)) log.transport.push({ mode: 'train', km: 420 });

    /* Energy ---------------------------------------------------------- */
    const acRoom = persona === 'heavyUser';
    log.energy.fan = acRoom ? 3 + r() * 2 : (7 + r() * 4) * improving;
    log.energy.light = (5 + r() * 3) * improving;
    log.energy.laptop = (weekend ? 5 : 6) + r() * 3;
    log.energy.geyser = (persona === 'heavyUser' ? 0.35 : 0.2) * improving;
    if (acRoom) log.energy.ac = (5 + r() * 3) * improving;
    if (!weekend && persona !== 'dayScholar' && r() < 0.4) log.energy.lab = 1 + r() * 2;
    if (persona === 'heavyUser' && r() < 0.5) log.energy.desktop = 3 + r() * 3;

    /* Food ------------------------------------------------------------ */
    const meals: MealType[] = [];
    const nonVegChance = persona === 'heavyUser' ? 0.55 : 0.32;
    for (let m = 0; m < 3; m++) {
      if (r() < nonVegChance * improving) {
        meals.push(r() < 0.15 ? 'mutton' : r() < 0.75 ? 'chicken' : 'egg');
      } else {
        meals.push(r() < 0.12 ? 'vegan' : 'veg');
      }
    }
    log.food.meals = meals;
    log.food.tea = Math.round(1 + r() * 3);
    log.food.outside = persona === 'heavyUser'
      ? (r() < 0.5 ? 1 : 0)
      : (r() < 0.2 ? 1 : 0);
    log.food.waste = r() < 0.25 * improving ? 'mid' : r() < 0.6 ? 'low' : 'none';

    /* Waste ----------------------------------------------------------- */
    log.waste.bottle = Math.round((r() < 0.5 ? 1 : 0) + (persona === 'heavyUser' ? r() * 2 : 0));
    log.waste.cup = Math.round(r() * 2 * improving);
    log.waste.paper = !weekend ? Math.round(r() * 6) : 0;
    if (r() < 0.12) log.waste.parcel = 1;
    if (r() < 0.06) log.waste.bag = 1;

    out.push(log);
  }
  return out;
}
