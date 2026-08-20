/**
 * The dashboard answers three questions in one screen: how much, from what,
 * and compared to whom. Everything below the fold is there to make the number
 * mean something — equivalents, the trend, and the honest error band.
 */

import { useMemo, useState } from 'react';
import {
  CATEGORIES, computeRange, equivalents, fmtKg, fmtNum, prettyDate, round, todayISO
} from '@carboncampus/shared';
import { useStore } from '../lib/store';
import { CategoryDonut, TrendChart, UncertaintyBar } from '../components/Charts';
import { Card, EmptyState, Pill, Stat } from '../components/ui';

type Window = 7 | 30 | 90;

export default function Dashboard({ onLog }: { onLog: () => void }) {
  const { logs, profile, streak, greenPoints, campusAvg, peerAvg, rank, counters, isDemoData } = useStore();
  const [win, setWin] = useState<Window>(30);

  const range = useMemo(() => {
    const cutoff = todayISO(-win);
    return computeRange(logs.filter(l => l.date >= cutoff));
  }, [logs, win]);

  const today = logs.find(l => l.date === todayISO());
  const eq = useMemo(() => equivalents(range.total), [range.total]);

  if (!logs.length) {
    return (
      <div className="view">
        <EmptyState
          icon="🌱"
          title="Nothing logged yet"
          body="Log one day and this screen fills with your breakdown, trend, equivalents and where you stand on campus."
          action={<button className="btn primary" onClick={onLog}>Log today</button>}
        />
      </div>
    );
  }

  const vsCampus = campusAvg > 0 ? (range.perDay - campusAvg) / campusAvg : 0;
  const vsPeer = peerAvg > 0 ? (range.perDay - peerAvg) / peerAvg : 0;
  const yearly = range.perDay * 365;

  return (
    <div className="view">
      {isDemoData && (
        <div className="demo-banner">
          Demo history loaded — synthetic logs for a realistic first look.
          Clear it any time from Settings.
        </div>
      )}

      <Card
        title="Your footprint"
        sub={`${range.count} ${range.count === 1 ? 'day' : 'days'} logged in this window`}
        right={
          <div className="segmented" role="group" aria-label="Time window">
            {([7, 30, 90] as Window[]).map(w => (
              <button key={w} className={win === w ? 'on' : ''} onClick={() => setWin(w)}>{w}d</button>
            ))}
          </div>
        }
      >
        <div className="hero">
          <CategoryDonut by={range.by} total={range.perDay} subtitle="kg CO2e / day" height={210} />
          <div className="hero-side">
            <Stat label="This window" value={fmtKg(range.total)} hint={`${fmtKg(range.perDay, 2)} a day`} />
            <Stat label="At this rate, a year" value={fmtKg(yearly)}
                  hint={`Indian average is about 2 t`} />
            <Stat
              label="Versus campus average"
              tone={vsCampus <= 0 ? 'good' : 'bad'}
              value={`${vsCampus > 0 ? '+' : ''}${Math.round(vsCampus * 100)}%`}
              hint={`Campus ${round(campusAvg, 2)} kg/day`}
            />
            <Stat
              label={`Versus ${profile?.hostel ?? 'peer'} year ${profile?.year ?? ''}`}
              tone={vsPeer <= 0 ? 'good' : 'bad'}
              value={`${vsPeer > 0 ? '+' : ''}${Math.round(vsPeer * 100)}%`}
              hint={`Peers ${round(peerAvg, 2)} kg/day`}
            />
          </div>
        </div>

        <div className="legend">
          {CATEGORIES.map(c => {
            const share = range.total > 0 ? (range.by[c.key] / range.total) * 100 : 0;
            return (
              <div key={c.key} className="legend-item">
                <i style={{ background: c.color }} />
                <span>{c.label}</span>
                <strong>{Math.round(share)}%</strong>
                <small>{fmtKg(range.by[c.key])}</small>
              </div>
            );
          })}
        </div>

        <div className="unc-row">
          <span>Estimate range, carrying factor uncertainty through</span>
          <UncertaintyBar low={range.total - range.sigma} value={range.total} high={range.total + range.sigma} />
        </div>
      </Card>

      <Card title="Daily trend" sub="Stacked by category. The dashed line is the campus average.">
        <TrendChart days={range.days} reference={campusAvg} referenceLabel="campus avg" />
      </Card>

      <Card title="What that adds up to" sub="Same emissions, in units you can picture.">
        <div className="equiv-grid">
          {eq.map(e => (
            <div key={e.key} className="equiv" title={e.src}>
              <span className="equiv-icon" aria-hidden>{e.icon}</span>
              <strong>{fmtNum(e.value)}</strong>
              <span>{e.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Today" sub={today ? `Logged ${prettyDate(today.date)}` : 'Not logged yet'}>
        {today ? (
          <TodayBreakdown />
        ) : (
          <div className="today-empty">
            <p>No entry for today.</p>
            <button className="btn primary" onClick={onLog}>Log today in under a minute</button>
          </div>
        )}
      </Card>

      <div className="stat-strip">
        <Stat label="Streak" value={streak} unit={streak === 1 ? ' day' : ' days'} hint="🔥 keep it alive" />
        <Stat label="Green points" value={greenPoints} hint="💚 logs + challenges" />
        <Stat label="Campus rank" value={`Top ${100 - rank}%`} hint={`cleaner than ${rank}% of campus`} />
        <Stat label="Campus community" value={fmtNum(counters.treesEquivalent)}
              hint="🌳 trees-worth avoided this year" />
      </div>
    </div>
  );
}

function TodayBreakdown() {
  const { logs } = useStore();
  const today = logs.find(l => l.date === todayISO());
  const res = useMemo(() => (today ? computeRange([today]).days[0] : null), [today]);
  if (!res) return null;

  return (
    <>
      <div className="today-total">
        <strong>{fmtKg(res.total, 2)}</strong>
        <div className="today-pills">
          {CATEGORIES.map(c => (
            <Pill key={c.key} tone={c.key}>{c.icon} {fmtKg(res.by[c.key], 1)}</Pill>
          ))}
        </div>
      </div>
      <ul className="lineitems">
        {CATEGORIES.flatMap(c => res.detail[c.key].map(item => (
          <li key={`${c.key}-${item.label}`}>
            <span className="li-icon" aria-hidden>{item.icon}</span>
            <span className="li-label">{item.label}</span>
            <span className="li-kg">{fmtKg(item.kg, 2)}</span>
          </li>
        )))}
      </ul>
    </>
  );
}
