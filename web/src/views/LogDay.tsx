/**
 * The sixty-second log.
 *
 * Templates fill a typical day in one tap, steppers handle the rest, and the
 * running total updates as you go — a student should never have to think about
 * emission factors to use this screen.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  APPLIANCES, CAMPUS, FOOD, TRANSPORT, blankLog, computeLog, fmtKg, prettyDate, round, todayISO,
  type ApplianceKey, type DayLog, type MealType, type TransportMode, type WasteItem
} from '@carboncampus/shared';
import { useStore } from '../lib/store';
import { Card, ChipGroup, Pill, Stepper } from '../components/ui';

const QUICK_MODES: TransportMode[] =
  ['walk', 'cycle', 'shuttle', 'eshuttle', 'bus', 'auto', 'bike', 'scooter', 'car', 'train'];

const MEALS: MealType[] = ['vegan', 'veg', 'egg', 'fish', 'chicken', 'mutton'];
const WASTE_ITEMS: WasteItem[] = ['bottle', 'cup', 'bag', 'paper', 'parcel'];
const ROOM: ApplianceKey[] = ['fan', 'light', 'laptop', 'ac', 'geyser', 'desktop', 'lab'];

type TemplateName = 'Class day' | 'Hostel day' | 'Weekend' | 'Lab day';

const TEMPLATES: Record<TemplateName, (log: DayLog) => DayLog> = {
  'Class day': l => ({
    ...l,
    transport: [{ mode: 'cycle', km: CAMPUS.routes['Hostel to Academic Complex'] * 2 }],
    energy: { ...l.energy, fan: 8, light: 5, laptop: 6, geyser: 0.2 },
    food: { ...l.food, meals: ['veg', 'veg', 'chicken'], tea: 2, outside: 0, waste: 'low' },
    waste: { ...l.waste, bottle: 1, paper: 4 },
    template: 'Class day'
  }),
  'Hostel day': l => ({
    ...l,
    transport: [{ mode: 'walk', km: 1.2 }],
    energy: { ...l.energy, fan: 10, light: 6, laptop: 8, geyser: 0.25 },
    food: { ...l.food, meals: ['veg', 'veg', 'veg'], tea: 3, outside: 1, waste: 'low' },
    waste: { ...l.waste, bottle: 1, cup: 2 },
    template: 'Hostel day'
  }),
  'Weekend': l => ({
    ...l,
    transport: [{ mode: 'bus', km: 16 }],
    energy: { ...l.energy, fan: 9, light: 6, laptop: 5, geyser: 0.3 },
    food: { ...l.food, meals: ['veg', 'chicken', 'veg'], tea: 2, outside: 1, waste: 'mid' },
    waste: { ...l.waste, bottle: 2, cup: 1, parcel: 1 },
    template: 'Weekend'
  }),
  'Lab day': l => ({
    ...l,
    transport: [{ mode: 'shuttle', km: 3.6 }],
    energy: { ...l.energy, fan: 6, light: 5, laptop: 7, lab: 4, geyser: 0.2 },
    food: { ...l.food, meals: ['veg', 'veg', 'egg'], tea: 3, outside: 0, waste: 'low' },
    waste: { ...l.waste, bottle: 1, paper: 6 },
    template: 'Lab day'
  })
};

export default function LogDay({ onSaved }: { onSaved?: () => void }) {
  const { logs, saveDay } = useStore();
  const [date, setDate] = useState(todayISO());
  const [log, setLog] = useState<DayLog>(blankLog(todayISO()));
  const [saved, setSaved] = useState(false);

  // Load whatever already exists for the chosen date.
  useEffect(() => {
    const existing = logs.find(l => l.date === date);
    setLog(existing ? { ...existing } : blankLog(date));
    setSaved(false);
  }, [date, logs]);

  const result = useMemo(() => computeLog(log), [log]);
  const yesterday = logs.find(l => l.date === todayISO(-1));

  const patch = (p: Partial<DayLog>) => setLog(l => ({ ...l, ...p, date }));
  const setEnergy = (k: ApplianceKey, v: number) => patch({ energy: { ...log.energy, [k]: v } });
  const setWaste = (k: WasteItem, v: number) => patch({ waste: { ...log.waste, [k]: v } });

  const tripKm = (mode: TransportMode) =>
    log.transport.filter(t => t.mode === mode).reduce((a, t) => a + t.km, 0);

  const setTrip = (mode: TransportMode, km: number) => {
    const others = log.transport.filter(t => t.mode !== mode);
    patch({ transport: km > 0 ? [...others, { mode, km }] : others });
  };

  const mealCount = (m: MealType) => log.food.meals.filter(x => x === m).length;
  const addMeal = (m: MealType) => patch({ food: { ...log.food, meals: [...log.food.meals, m] } });
  const removeMeal = (m: MealType) => {
    const i = log.food.meals.lastIndexOf(m);
    if (i < 0) return;
    const meals = log.food.meals.slice();
    meals.splice(i, 1);
    patch({ food: { ...log.food, meals } });
  };

  async function save() {
    await saveDay({ ...log, date });
    setSaved(true);
    onSaved?.();
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div className="view log-view">
      <Card
        title="Log your day"
        sub={<>Pick a template, adjust what is different, save. Aim for under a minute.</>}
        right={
          <input className="date-input" type="date" value={date} max={todayISO()}
                 onChange={e => setDate(e.target.value)} aria-label="Log date" />
        }
      >
        <div className="templates">
          {(Object.keys(TEMPLATES) as TemplateName[]).map(name => (
            <button key={name}
                    className={`template${log.template === name ? ' on' : ''}`}
                    onClick={() => setLog(TEMPLATES[name]({ ...blankLog(date) }))}>
              {name}
            </button>
          ))}
          {yesterday && (
            <button className="template repeat"
                    onClick={() => setLog({ ...yesterday, date, template: yesterday.template ?? null })}>
              ↺ Repeat yesterday
            </button>
          )}
          <button className="template clear" onClick={() => setLog(blankLog(date))}>Clear</button>
        </div>
      </Card>

      <Card title={<><span aria-hidden>🚌</span> Transport</>}
            sub="Total distance today, by mode. Return trips count both ways.">
        <div className="mode-grid">
          {QUICK_MODES.map(mode => (
            <Stepper key={mode}
                     label={TRANSPORT[mode].label}
                     icon={TRANSPORT[mode].icon}
                     unit=" km"
                     step={mode === 'train' ? 25 : 0.5}
                     max={mode === 'train' ? 2000 : 200}
                     value={tripKm(mode)}
                     onChange={v => setTrip(mode, v)}
                     hint={TRANSPORT[mode].ef === 0 ? 'zero emissions' : `${TRANSPORT[mode].ef} kg/km`} />
          ))}
        </div>
      </Card>

      <Card title={<><span aria-hidden>⚡</span> Room & lab energy</>}
            sub={`Hours used today · ${round(result.kwh, 2)} kWh so far`}>
        {ROOM.map(key => (
          <Stepper key={key}
                   label={APPLIANCES[key].label}
                   icon={APPLIANCES[key].icon}
                   unit=" h"
                   step={key === 'geyser' ? 0.1 : 0.5}
                   max={24}
                   value={log.energy[key] ?? 0}
                   onChange={v => setEnergy(key, v)}
                   hint={`${APPLIANCES[key].w} W`} />
        ))}
      </Card>

      <Card title={<><span aria-hidden>🍛</span> Food</>} sub="Tap a meal for each time you ate it.">
        <div className="meal-grid">
          {MEALS.map(m => (
            <div key={m} className={`meal${mealCount(m) ? ' on' : ''}`}>
              <button className="meal-add" onClick={() => addMeal(m)}>
                <span className="meal-icon" aria-hidden>{FOOD[m].icon}</span>
                <span className="meal-name">{FOOD[m].label}</span>
                <span className="meal-ef">{FOOD[m].ef} kg</span>
              </button>
              {mealCount(m) > 0 && (
                <span className="meal-count">
                  <button onClick={() => removeMeal(m)} aria-label={`Remove one ${FOOD[m].label}`}>−</button>
                  {mealCount(m)}
                </span>
              )}
            </div>
          ))}
        </div>
        <Stepper label="Tea / coffee" icon="☕" step={1} max={15}
                 value={log.food.tea} onChange={v => patch({ food: { ...log.food, tea: v } })} />
        <Stepper label="Delivered orders" icon="🛵" step={1} max={10}
                 value={log.food.outside} onChange={v => patch({ food: { ...log.food, outside: v } })} />
        <label className="q">Left on the plate</label>
        <ChipGroup value={log.food.waste}
                   onChange={v => patch({ food: { ...log.food, waste: v } })}
                   options={[
                     { value: 'none', label: 'Clean', icon: '🍽️' },
                     { value: 'low', label: 'A few bites', icon: '🥄' },
                     { value: 'mid', label: 'A quarter', icon: '🥘' },
                     { value: 'high', label: 'Half+', icon: '🗑️' }
                   ]} />
      </Card>

      <Card title={<><span aria-hidden>♻️</span> Waste</>} sub="Single-use items you went through today.">
        <div className="mode-grid">
          {WASTE_ITEMS.map(k => (
            <Stepper key={k} label={wasteLabel(k)} icon={wasteIcon(k)} step={1} max={50}
                     value={log.waste[k] ?? 0} onChange={v => setWaste(k, v)} />
          ))}
        </div>
      </Card>

      <div className="log-bar">
        <div className="log-bar-total">
          <span>Today so far</span>
          <strong>{fmtKg(result.total, 2)}</strong>
          <small>CO2e · {prettyDate(date)}</small>
        </div>
        <div className="log-bar-split">
          {(['transport', 'energy', 'food', 'waste'] as const).map(k => (
            <Pill key={k} tone={k}>{fmtKg(result.by[k], 1)}</Pill>
          ))}
        </div>
        <button className={`btn primary${saved ? ' ok' : ''}`} onClick={() => void save()}>
          {saved ? '✓ Saved' : 'Save day'}
        </button>
      </div>
    </div>
  );
}

const wasteLabel = (k: WasteItem) => ({
  bottle: 'Plastic bottles', cup: 'Disposable cups', bag: 'Plastic bags',
  paper: 'Printed sheets', parcel: 'Parcels', ewaste: 'E-waste (kg)'
}[k]);

const wasteIcon = (k: WasteItem) => ({
  bottle: '🧴', cup: '🥤', bag: '🛍️', paper: '📄', parcel: '📦', ewaste: '🔋'
}[k]);
