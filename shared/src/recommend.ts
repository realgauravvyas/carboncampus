/**
 * CarbonCampus — Action engine
 * ----------------------------
 * A calculator that stops at a number changes nothing. This module turns the
 * user's own logged habits into concrete swaps, each priced in kg CO2e per
 * month from *their* data and the same factor registry the dashboard uses.
 *
 * Every rule is transparent: it states the habit it saw, the swap it proposes,
 * and the arithmetic behind the saving. Rules are ranked by impact × ease and
 * only the top three are ever shown — behaviour science favours small wins
 * over a wall of advice.
 */

import { APPLIANCES, FOOD, FOOD_EXTRAS, GRID, TRANSPORT, WASTE, WASTE_LEVELS } from './factors.js';
import { round } from './engine.js';
import type {
  ApplianceKey, Badge, CategoryKey, DayLog, Factor, MealType, Suggestion, TransportMode, WasteItem
} from './types.js';

const WEEKS_PER_MONTH = 4.345;

export interface HabitProfile {
  days: number;
  km: Partial<Record<TransportMode, number>>;
  hours: Partial<Record<ApplianceKey, number>>;
  meals: Partial<Record<MealType, number>>;
  tea: number;
  outside: number;
  plateWaste: number;
  items: Partial<Record<WasteItem, number>>;
  commuteKmPerTrip: number;
}

/** Roll a set of day logs into per-week averages the rules can reason about. */
export function habitProfile(logs: DayLog[]): HabitProfile {
  const days = Math.max(logs.length, 1);
  const p: HabitProfile = {
    days, km: {}, hours: {}, meals: {}, tea: 0, outside: 0,
    plateWaste: 0, items: {}, commuteKmPerTrip: 0
  };
  const scale = 7 / days;

  for (const log of logs) {
    for (const t of log.transport ?? []) {
      if (!t.km) continue;
      p.km[t.mode] = (p.km[t.mode] ?? 0) + t.km;
    }
    for (const [k, h] of Object.entries(log.energy ?? {}) as [ApplianceKey, number][]) {
      if (h > 0) p.hours[k] = (p.hours[k] ?? 0) + h;
    }
    for (const m of log.food?.meals ?? []) p.meals[m] = (p.meals[m] ?? 0) + 1;
    p.tea += log.food?.tea ?? 0;
    p.outside += log.food?.outside ?? 0;
    const lvl = WASTE_LEVELS[log.food?.waste ?? 'none'];
    if (lvl) p.plateWaste += lvl.kg * (log.food?.meals?.length ?? 0);
    for (const [k, n] of Object.entries(log.waste ?? {}) as [WasteItem, number][]) {
      if (n > 0) p.items[k] = (p.items[k] ?? 0) + n;
    }
  }

  for (const bag of [p.km, p.hours, p.meals, p.items] as Record<string, number>[]) {
    for (const k of Object.keys(bag)) bag[k] *= scale;
  }
  p.tea *= scale; p.outside *= scale; p.plateWaste *= scale;

  // Typical single-trip distance, used to judge whether cycling is realistic.
  const motorised: TransportMode[] = ['car', 'carpool', 'bike', 'scooter', 'auto', 'ev'];
  const trips = logs.flatMap(l => (l.transport ?? []).filter(t => motorised.includes(t.mode)));
  p.commuteKmPerTrip = trips.length ? trips.reduce((a, t) => a + t.km, 0) / trips.length : 0;

  return p;
}

const kwh = (key: ApplianceKey, hours: number) => (APPLIANCES[key].w * hours) / 1000;

type Built = Omit<Suggestion, 'id' | 'category' | 'score' | 'points'>;

interface Rule {
  id: string;
  category: CategoryKey;
  build(p: HabitProfile): Built | null;
}

/** Average EF across the modes or meals actually used, weighted by volume. */
function weightedEf(
  volumes: Record<string, number | undefined>,
  keys: string[],
  table: Record<string, Factor> = TRANSPORT as unknown as Record<string, Factor>
): number {
  let num = 0, den = 0;
  for (const k of keys) {
    const v = volumes[k] ?? 0;
    if (!v) continue;
    num += v * table[k].ef;
    den += v;
  }
  return den ? num / den : (table[keys[0]]?.ef ?? 0);
}

const RULES: Rule[] = [
  {
    id: 'shift-to-shuttle',
    category: 'transport',
    build(p) {
      const solo = (p.km.car ?? 0) + (p.km.bike ?? 0) + (p.km.scooter ?? 0);
      if (solo < 8) return null;
      const shift = solo * 0.5;
      const fromEf = weightedEf(p.km, ['car', 'bike', 'scooter']);
      const saving = (fromEf - TRANSPORT.shuttle.ef) * shift * WEEKS_PER_MONTH;
      if (saving < 0.5) return null;
      return {
        title: 'Move half your private-vehicle km to the campus shuttle',
        habit: `You logged ${round(solo, 1)} km a week by car, bike or scooter.`,
        swap: `Shift ${round(shift, 1)} km a week onto the shuttle.`,
        math: `${round(shift, 1)} km × (${round(fromEf, 3)} − ${TRANSPORT.shuttle.ef}) kg/km × ${WEEKS_PER_MONTH} weeks`,
        saving, ease: 4, icon: '🚐'
      };
    }
  },
  {
    id: 'cycle-short-hops',
    category: 'transport',
    build(p) {
      const short = (p.km.auto ?? 0) + (p.km.eshuttle ?? 0) + (p.km.bike ?? 0);
      if (short < 4 || p.commuteKmPerTrip > 3.5 || p.commuteKmPerTrip === 0) return null;
      const fromEf = weightedEf(p.km, ['auto', 'eshuttle', 'bike']);
      const saving = fromEf * short * 0.6 * WEEKS_PER_MONTH;
      if (saving < 0.3) return null;
      return {
        title: 'Cycle the sub-3 km hops instead of riding',
        habit: `Your typical motorised trip is only ${round(p.commuteKmPerTrip, 1)} km.`,
        swap: `Cycle ${round(short * 0.6, 1)} km a week of that — zero operational emissions.`,
        math: `${round(short * 0.6, 1)} km × ${round(fromEf, 3)} kg/km × ${WEEKS_PER_MONTH} weeks`,
        saving, ease: 4, icon: '🚲'
      };
    }
  },
  {
    id: 'carpool',
    category: 'transport',
    build(p) {
      const solo = p.km.car ?? 0;
      if (solo < 20) return null;
      const saving = (TRANSPORT.car.ef - TRANSPORT.carpool.ef) * solo * 0.7 * WEEKS_PER_MONTH;
      return {
        title: 'Share the car ride for city trips',
        habit: `${round(solo, 0)} km a week driving alone.`,
        swap: 'Fill two more seats on 70% of those trips.',
        math: `${round(solo * 0.7, 0)} km × (${TRANSPORT.car.ef} − ${TRANSPORT.carpool.ef}) kg/km × ${WEEKS_PER_MONTH}`,
        saving, ease: 3, icon: '🚗'
      };
    }
  },
  {
    id: 'ac-setpoint',
    category: 'energy',
    build(p) {
      const h = p.hours.ac ?? 0;
      if (h < 7) return null;
      // Raising the setpoint from 21-22 °C to 24 °C cuts compressor load ~20%.
      const saving = kwh('ac', h) * 0.20 * GRID.ef * WEEKS_PER_MONTH;
      return {
        title: 'Set the AC to 24 °C instead of 21 °C',
        habit: `${round(h, 1)} h a week of AC — ${round(kwh('ac', h), 1)} kWh.`,
        swap: 'Each degree up cuts compressor load by roughly 6%; three degrees is about 20%.',
        math: `${round(kwh('ac', h), 1)} kWh × 20% × ${GRID.ef} kg/kWh × ${WEEKS_PER_MONTH}`,
        saving, ease: 5, icon: '❄️'
      };
    }
  },
  {
    id: 'lights-fans-off',
    category: 'energy',
    build(p) {
      const light = p.hours.light ?? 0, fan = p.hours.fan ?? 0;
      if (light + fan < 84) return null;   // more than 12 h a day combined
      const saved = (kwh('light', light) + kwh('fan', fan)) * 0.25;
      const saving = saved * GRID.ef * WEEKS_PER_MONTH;
      if (saving < 0.2) return null;
      return {
        title: 'Switch lights and fans off when the room is empty',
        habit: `${round(light + fan, 0)} h a week of lights and fans — they run longer than you are in.`,
        swap: 'Cutting the empty-room quarter is the easiest kWh on campus.',
        math: `${round(kwh('light', light) + kwh('fan', fan), 1)} kWh × 25% × ${GRID.ef} kg/kWh × ${WEEKS_PER_MONTH}`,
        saving, ease: 5, icon: '💡'
      };
    }
  },
  {
    id: 'geyser-time',
    category: 'energy',
    build(p) {
      const h = p.hours.geyser ?? 0;
      if (h < 2) return null;
      const saving = kwh('geyser', h) * 0.35 * GRID.ef * WEEKS_PER_MONTH;
      return {
        title: 'Cut geyser time by a third',
        habit: `${round((h * 60) / 7, 0)} minutes a day on the geyser or immersion rod.`,
        swap: 'Heat one bucket rather than running it through the shower.',
        math: `${round(kwh('geyser', h), 1)} kWh × 35% × ${GRID.ef} kg/kWh × ${WEEKS_PER_MONTH}`,
        saving, ease: 4, icon: '🚿'
      };
    }
  },
  {
    id: 'desktop-to-laptop',
    category: 'energy',
    build(p) {
      const h = p.hours.desktop ?? 0;
      if (h < 21) return null;
      const saved = kwh('desktop', h * 0.5) - kwh('laptop', h * 0.5);
      const saving = saved * GRID.ef * WEEKS_PER_MONTH;
      return {
        title: 'Do half your desk hours on the laptop',
        habit: `${round(h, 0)} h a week on a 200 W desktop.`,
        swap: 'Coursework and writing do not need the tower running.',
        math: `${round(h * 0.5, 0)} h × (200 − 60) W × ${GRID.ef} kg/kWh × ${WEEKS_PER_MONTH}`,
        saving, ease: 3, icon: '💻'
      };
    }
  },
  {
    id: 'swap-red-meat',
    category: 'food',
    build(p) {
      const mutton = p.meals.mutton ?? 0;
      if (mutton < 1) return null;
      const swap = Math.max(1, Math.round(mutton * 0.5));
      const saving = (FOOD.mutton.ef - FOOD.chicken.ef) * swap * WEEKS_PER_MONTH;
      return {
        title: 'Trade half your mutton meals for chicken or fish',
        habit: `${round(mutton, 1)} mutton meals a week — the heaviest item on any mess menu.`,
        swap: `Swap ${swap} of them. Mutton is ${round(FOOD.mutton.ef / FOOD.chicken.ef, 1)}× chicken per meal.`,
        math: `${swap} × (${FOOD.mutton.ef} − ${FOOD.chicken.ef}) kg/meal × ${WEEKS_PER_MONTH}`,
        saving, ease: 3, icon: '🍖'
      };
    }
  },
  {
    id: 'veg-days',
    category: 'food',
    build(p) {
      const nonVeg = (p.meals.chicken ?? 0) + (p.meals.fish ?? 0) + (p.meals.egg ?? 0);
      if (nonVeg < 3) return null;
      const swap = Math.max(2, Math.round(nonVeg * 0.35));
      const fromEf = weightedEf(p.meals as Record<string, number>, ['chicken', 'fish', 'egg'],
        FOOD as unknown as Record<string, Factor>);
      const saving = (fromEf - FOOD.veg.ef) * swap * WEEKS_PER_MONTH;
      if (saving < 0.4) return null;
      return {
        title: `Make ${swap} meals a week vegetarian`,
        habit: `${round(nonVeg, 1)} non-veg meals a week.`,
        swap: 'Two mess meals swapped is the least painful food change there is.',
        math: `${swap} × (${round(fromEf, 2)} − ${FOOD.veg.ef}) kg/meal × ${WEEKS_PER_MONTH}`,
        saving, ease: 3, icon: '🥗'
      };
    }
  },
  {
    id: 'plate-waste',
    category: 'food',
    build(p) {
      if (p.plateWaste < 0.35) return null;
      const cut = p.plateWaste * 0.7;
      const saving = cut * FOOD_EXTRAS.waste.ef * WEEKS_PER_MONTH;
      return {
        title: 'Take a smaller first serving',
        habit: `About ${round(p.plateWaste, 2)} kg a week left on your plate.`,
        swap: 'Go back for seconds instead — wasted food carries its full production footprint plus landfill methane.',
        math: `${round(cut, 2)} kg × ${FOOD_EXTRAS.waste.ef} kg CO2e/kg × ${WEEKS_PER_MONTH}`,
        saving, ease: 5, icon: '🍽️'
      };
    }
  },
  {
    id: 'fewer-deliveries',
    category: 'food',
    build(p) {
      if (p.outside < 2) return null;
      const cut = Math.max(1, Math.round(p.outside * 0.5));
      const saving = cut * FOOD_EXTRAS.outside.ef * WEEKS_PER_MONTH;
      if (saving < 0.3) return null;
      return {
        title: `Drop ${cut} delivery orders a week`,
        habit: `${round(p.outside, 1)} delivered orders a week on top of mess meals.`,
        swap: 'Packaging and last-mile riding add half a kilo of CO2e per order.',
        math: `${cut} × ${FOOD_EXTRAS.outside.ef} kg/order × ${WEEKS_PER_MONTH}`,
        saving, ease: 3, icon: '🛵'
      };
    }
  },
  {
    id: 'reusable-bottle',
    category: 'waste',
    build(p) {
      const bottles = p.items.bottle ?? 0, cups = p.items.cup ?? 0;
      if (bottles + cups < 3) return null;
      const saving = (bottles * WASTE.bottle.ef + cups * WASTE.cup.ef) * 0.9 * WEEKS_PER_MONTH;
      if (saving < 0.15) return null;
      return {
        title: 'Carry a refill bottle and a steel cup',
        habit: `${round(bottles + cups, 0)} single-use bottles and cups a week.`,
        swap: 'Campus has refill points; this is a one-time purchase against a weekly habit.',
        math: `${round(bottles + cups, 0)} items × about ${WASTE.bottle.ef} kg each × 90% avoided × ${WEEKS_PER_MONTH}`,
        saving, ease: 5, icon: '🧴'
      };
    }
  },
  {
    id: 'print-double-sided',
    category: 'waste',
    build(p) {
      const s = p.items.paper ?? 0;
      if (s < 25) return null;
      const saving = s * 0.45 * WASTE.paper.ef * WEEKS_PER_MONTH;
      if (saving < 0.1) return null;
      return {
        title: 'Print double-sided, or read it on screen',
        habit: `${round(s, 0)} sheets printed a week.`,
        swap: 'Duplex printing halves the paper for the same output.',
        math: `${round(s * 0.45, 0)} sheets × ${WASTE.paper.ef} kg/sheet × ${WEEKS_PER_MONTH}`,
        saving, ease: 4, icon: '📄'
      };
    }
  },
  {
    id: 'batch-parcels',
    category: 'waste',
    build(p) {
      const n = p.items.parcel ?? 0;
      if (n < 1.5) return null;
      const saving = n * 0.4 * WASTE.parcel.ef * WEEKS_PER_MONTH;
      if (saving < 0.15) return null;
      return {
        title: 'Batch your online orders into one delivery',
        habit: `${round(n, 1)} parcels a week.`,
        swap: 'One combined shipment instead of three separate boxes.',
        math: `${round(n * 0.4, 1)} parcels avoided × ${WASTE.parcel.ef} kg × ${WEEKS_PER_MONTH}`,
        saving, ease: 3, icon: '📦'
      };
    }
  }
];

/**
 * Rank every applicable swap. Impact dominates, ease breaks ties — a big win
 * nobody will attempt beats nothing, but an easy win that lands beats a
 * heroic one that does not.
 */
export function recommend(
  logs: DayLog[],
  { limit = 3, exclude = [] as string[] } = {}
): Suggestion[] {
  if (!logs.length) return [];
  const p = habitProfile(logs);
  const out: Suggestion[] = [];

  for (const rule of RULES) {
    if (exclude.includes(rule.id)) continue;
    let built: Built | null = null;
    try { built = rule.build(p); } catch { built = null; }
    if (!built || !(built.saving > 0)) continue;
    out.push({
      ...built,
      id: rule.id,
      category: rule.category,
      score: built.saving * (0.55 + 0.09 * built.ease),
      points: Math.max(10, Math.round(built.saving * 12))
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** Everything the engine could suggest, for the "all swaps" drawer. */
export function allSuggestions(logs: DayLog[]): Suggestion[] {
  return recommend(logs, { limit: 99 });
}

export const RULE_COUNT = RULES.length;

/* ------------------------------------------------------------------ *
 * Badges — the light gamification layer
 * ------------------------------------------------------------------ */

export function badges(input: {
  logCount: number;
  streak: number;
  challengesDone: number;
  perDay: number;
  campusAvg: number;
  greenPoints: number;
}): Badge[] {
  const { logCount, streak, challengesDone, perDay, campusAvg, greenPoints } = input;
  return [
    { id: 'first-log',  icon: '🌱', name: 'First Log',            need: 'Log your first day',         got: logCount >= 1 },
    { id: 'week-1',     icon: '🔥', name: '7-Day Streak',         need: 'Log seven days running',     got: streak >= 7 },
    { id: 'week-4',     icon: '⚡', name: '30-Day Streak',        need: 'Log thirty days running',    got: streak >= 30 },
    { id: 'below-avg',  icon: '📉', name: 'Below Campus Average', need: 'Beat the campus average',    got: perDay > 0 && perDay < campusAvg },
    { id: 'actor',      icon: '✅', name: 'Took Action',          need: 'Complete one challenge',     got: challengesDone >= 1 },
    { id: 'triple',     icon: '🏅', name: 'Hat-trick',            need: 'Complete three challenges',  got: challengesDone >= 3 },
    { id: 'points-250', icon: '💚', name: '250 Green Points',     need: 'Earn 250 green points',      got: greenPoints >= 250 },
    { id: 'sub-4',      icon: '🌍', name: 'Under 4 kg a day',     need: 'Hold a day under 4 kg CO2e', got: perDay > 0 && perDay < 4 }
  ];
}
