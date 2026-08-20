/**
 * Chart components — Recharts, wrapped so every view gets the same axes,
 * tooltips and colour language. Category colours come from the shared engine,
 * so a slice on the dashboard is the same green as the row in the campus report.
 */

import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ReferenceLine
} from 'recharts';
import {
  CATEGORIES, fmtKg, fmtNum, prettyDate, round,
  type CategoryKey, type DayResult, type LeagueRow
} from '@carboncampus/shared';

const AXIS = { fontSize: 11, fill: 'var(--muted)' };

/* ------------------------------------------------------------------ *
 * Category donut
 * ------------------------------------------------------------------ */

export function CategoryDonut({
  by, total, subtitle, height = 210
}: {
  by: Record<CategoryKey, number>;
  total: number;
  subtitle?: string;
  height?: number;
}) {
  const data = CATEGORIES
    .map(c => ({ name: c.label, key: c.key, value: Math.max(by[c.key], 0), color: c.color }))
    .filter(d => d.value > 0);

  if (!data.length) {
    return <div className="chart-empty" style={{ height }}>Log a day to see the split</div>;
  }

  return (
    <div className="donut-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            {data.map(d => <Cell key={d.key} fill={d.color} />)}
          </Pie>
          <Tooltip
            formatter={(v: number, n: string) => [`${fmtKg(v)} (${Math.round((v / total) * 100)}%)`, n]}
            contentStyle={tooltipStyle}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-centre">
        <strong>{fmtKg(total)}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Daily trend
 * ------------------------------------------------------------------ */

export function TrendChart({
  days, reference, referenceLabel, height = 190
}: {
  days: DayResult[];
  reference?: number;
  referenceLabel?: string;
  height?: number;
}) {
  if (days.length < 1) {
    return <div className="chart-empty" style={{ height }}>No days logged yet</div>;
  }
  const data = days.map(d => ({
    date: d.date,
    label: prettyDate(d.date),
    value: round(d.total, 2),
    transport: round(d.by.transport, 2),
    energy: round(d.by.energy, 2),
    food: round(d.by.food, 2),
    waste: round(d.by.waste, 2)
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -18 }} barCategoryGap="18%">
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={18} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44}
               tickFormatter={(v: number) => `${v}`} />
        <Tooltip
          cursor={{ fill: 'var(--hover)' }}
          contentStyle={tooltipStyle}
          formatter={(v: number, n: string) => [fmtKg(v), labelFor(n)]}
        />
        {CATEGORIES.map(c => (
          <Bar key={c.key} dataKey={c.key} stackId="a" fill={c.color}
               radius={c.key === 'waste' ? [3, 3, 0, 0] : undefined} />
        ))}
        {reference != null && reference > 0 && (
          <ReferenceLine y={round(reference, 2)} stroke="var(--muted)" strokeDasharray="4 4"
            label={{ value: referenceLabel ?? '', position: 'insideTopRight', fontSize: 10, fill: 'var(--muted)' }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

const labelFor = (key: string) =>
  CATEGORIES.find(c => c.key === key)?.label ?? key;

/* ------------------------------------------------------------------ *
 * Campus trend (weekly, tonnes)
 * ------------------------------------------------------------------ */

export function CampusTrend({
  weeks, height = 200
}: {
  weeks: { label: string; kg: number }[];
  height?: number;
}) {
  const data = weeks.map(w => ({ label: w.label, tonnes: round(w.kg / 1000, 2) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="campusFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E8449" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#1E8449" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={20} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={46}
               tickFormatter={(v: number) => `${fmtNum(v)}t`} />
        <Tooltip contentStyle={tooltipStyle}
                 formatter={(v: number) => [`${v} t CO2e`, 'Campus week']} />
        <Area type="monotone" dataKey="tonnes" stroke="#1E8449" strokeWidth={2.5}
              fill="url(#campusFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ *
 * League table — bars are CSS, so long lists stay light
 * ------------------------------------------------------------------ */

export function LeagueTable({
  rows, unit = 'kg/day', highlight, limit
}: {
  rows: LeagueRow[];
  unit?: string;
  highlight?: string;
  limit?: number;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  const max = Math.max(...rows.map(r => r.perDay)) * 1.04;

  return (
    <ol className="league">
      {shown.map(r => {
        const rank = rows.indexOf(r) + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        const you = highlight && r.name === highlight;
        return (
          <li key={r.name} className={`league-row${you ? ' is-you' : ''}`}>
            <span className="league-rank">{medal}</span>
            <span className="league-name">
              {r.name}
              {you && <span className="you-pill">you</span>}
            </span>
            <span className="league-bar">
              <i
                className={rank <= 3 ? 'good' : rank > rows.length - 3 ? 'bad' : ''}
                style={{ width: `${(r.perDay / max) * 100}%` }}
              />
            </span>
            <span className="league-val">
              {round(r.perDay, 2)}<small> {unit}</small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ *
 * Hostel heat grid
 * ------------------------------------------------------------------ */

export function HeatGrid({ cells }: { cells: { name: string; value: number }[] }) {
  if (!cells.length) return <div className="chart-empty">No hostel data</div>;
  const values = cells.map(c => c.value);
  const min = Math.min(...values), max = Math.max(...values);

  const shade = (v: number) => {
    const t = (max - min) ? (v - min) / (max - min) : 0.5;
    const stops: [number, number, number][] = [[30, 132, 73], [242, 183, 5], [183, 71, 42]];
    const band = t < 0.5 ? 0 : 1;
    const f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const mix = stops[band].map((ch, k) => Math.round(ch + (stops[band + 1][k] - ch) * f));
    return `rgb(${mix.join(',')})`;
  };

  return (
    <div className="heatgrid">
      {cells.map(c => (
        <div key={c.name} className="heatcell" style={{ background: shade(c.value) }}
             title={`${c.name}: ${round(c.value, 2)} kg CO2e per person per day`}>
          <span className="heat-name">{c.name}</span>
          <span className="heat-val">{round(c.value, 2)}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Uncertainty band
 * ------------------------------------------------------------------ */

export function UncertaintyBar({ low, value, high }: { low: number; value: number; high: number }) {
  const span = high - low || 1;
  const pos = ((value - low) / span) * 100;
  return (
    <div className="uncbar" title={`Estimate ${fmtKg(value)}, range ${fmtKg(low)}–${fmtKg(high)}`}>
      <span className="uncbar-track"><i style={{ left: `${round(pos, 1)}%` }} /></span>
      <span className="uncbar-ends"><small>{fmtKg(low)}</small><small>{fmtKg(high)}</small></span>
    </div>
  );
}

export const tooltipStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text)',
  boxShadow: '0 6px 24px rgba(0,0,0,.10)'
};
