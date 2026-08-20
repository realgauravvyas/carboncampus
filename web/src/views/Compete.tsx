/**
 * Compete — hostel and department leagues.
 *
 * Sustainability is easier to sustain as a team sport. Rankings are by average
 * kg CO2e per person per day, never by raw total, so a big hostel is not
 * punished for being big.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  cohort, deptLeague, hostelLeague, fmtKg, fmtNum, round, type LeagueRow
} from '@carboncampus/shared';
import { useStore } from '../lib/store';
import { LeagueTable } from '../components/Charts';
import { Card, Pill, Stat } from '../components/ui';
import { fetchDeptLeague, fetchHostelLeague } from '../lib/api';

export default function Compete() {
  const { profile, last30, rank, streak, counters } = useStore();
  const [tab, setTab] = useState<'hostel' | 'dept'>('hostel');
  const [live, setLive] = useState<{ hostel?: LeagueRow[]; dept?: LeagueRow[] }>({});

  // When an API is configured the leagues come from real rows in Postgres;
  // otherwise the shared cohort model stands in.
  useEffect(() => {
    void (async () => {
      const [h, d] = await Promise.all([fetchHostelLeague(), fetchDeptLeague()]);
      setLive({ hostel: h ?? undefined, dept: d ?? undefined });
    })();
  }, []);

  const hostels = useMemo(
    () => live.hostel ?? hostelLeague(profile?.hostel, last30.perDay),
    [live.hostel, profile?.hostel, last30.perDay]
  );
  const depts = useMemo(() => live.dept ?? deptLeague(), [live.dept]);

  const myHostel = hostels.find(h => h.name === profile?.hostel);
  const myPosition = myHostel ? hostels.indexOf(myHostel) + 1 : null;
  const c = cohort();

  const rows = tab === 'hostel' ? hostels : depts;
  const highlight = tab === 'hostel' ? profile?.hostel : profile?.dept;

  return (
    <div className="view">
      <Card title="Where you stand" sub="Your last 30 days against the campus distribution.">
        <div className="stat-strip flat">
          <Stat label="Your average" value={round(last30.perDay, 2)} unit=" kg/day" />
          <Stat label="Cleaner than" value={`${rank}%`} hint="of campus" tone={rank > 50 ? 'good' : undefined} />
          <Stat label="Streak" value={streak} unit={streak === 1 ? ' day' : ' days'} />
          <Stat label={profile?.hostel ?? 'Hostel'} value={myPosition ? `#${myPosition}` : '—'}
                hint={`of ${hostels.length} hostels`} />
        </div>
      </Card>

      <Card
        title="League table"
        sub="Average kg CO2e per person per day — lower is better."
        right={
          <div className="segmented" role="group" aria-label="League type">
            <button className={tab === 'hostel' ? 'on' : ''} onClick={() => setTab('hostel')}>Hostels</button>
            <button className={tab === 'dept' ? 'on' : ''} onClick={() => setTab('dept')}>Departments</button>
          </div>
        }
      >
        <LeagueTable rows={rows} highlight={highlight} />
        <p className="fineprint">
          {live.hostel
            ? 'Live rows from the campus API.'
            : 'Peer rows are a seeded synthetic cohort for this public demo; your own row is your real logged data. Point the PWA at the API in server/ for live campus rows.'}
        </p>
      </Card>

      <Card title="Green week" sub="Event challenges run alongside the leagues.">
        <div className="event">
          <div>
            <h3>Techniche Green Week</h3>
            <p className="muted small">
              Hostels compete on average footprint for seven days. Points count double for
              swaps held all week.
            </p>
            <div className="event-pills">
              <Pill tone="good">{fmtNum(c.activeCount)} students logging</Pill>
              <Pill>{fmtNum(counters.treesEquivalent)} trees-worth avoided</Pill>
              <Pill>{fmtKg(counters.avoidedKgYear)} a year</Pill>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Participation" sub="A league only works if enough people are logging.">
        <ul className="participation">
          {hostels.map(h => (
            <li key={h.name} className={h.name === profile?.hostel ? 'is-you' : ''}>
              <span className="p-name">{h.name}</span>
              <span className="p-bar"><i style={{ width: `${Math.round(h.participation * 100)}%` }} /></span>
              <span className="p-val">{Math.round(h.participation * 100)}%</span>
              <span className="p-streak">🔥 {Math.round(h.avgStreak)}d</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
