/**
 * Admin analytics portal.
 *
 * The institutional half of the product: an aggregated, anonymised campus
 * inventory that a sustainability office can file, exported as CSV or JSON.
 * Individual rows never leave the device — everything here is a group total,
 * and groups below a minimum size are suppressed.
 */

import { useMemo, useState } from 'react';
import {
  CAMPUS, CATEGORIES, REGISTRY_VERSION, campusInventory, cohort, fmtKg, fmtNum,
  hostelLeague, round, todayISO
} from '@carboncampus/shared';
import { useStore } from '../lib/store';
import { CampusTrend, HeatGrid } from '../components/Charts';
import { Card, Pill, Stat } from '../components/ui';

const MIN_GROUP = 5;   // k-anonymity floor for any published group

export default function Admin() {
  const { counters } = useStore();
  const [days, setDays] = useState(30);

  const inv = useMemo(() => campusInventory(days), [days]);
  const c = cohort();
  const hostels = useMemo(() => hostelLeague(), []);
  const heat = hostels
    .filter(h => h.members >= MIN_GROUP)
    .map(h => ({ name: h.name, value: h.perDay }));

  function download(name: string, text: string, type: string) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const lines = [
      `# CarbonCampus campus inventory`,
      `# Campus,${CAMPUS.name}`,
      `# Period,${days} days ending ${todayISO()}`,
      `# Factor registry,v${REGISTRY_VERSION}`,
      `# Reporting population,${inv.reporting} of ${inv.population}`,
      `# Groups smaller than ${MIN_GROUP} people are suppressed`,
      '',
      'scope,category,kg_co2e,tonnes_co2e,share_percent'
    ];
    for (const cat of CATEGORIES) {
      const kg = inv.by[cat.key];
      lines.push([
        'campus', cat.label, round(kg, 1), round(kg / 1000, 3),
        round((kg / inv.totalKg) * 100, 1)
      ].join(','));
    }
    lines.push('', 'hostel,members,participation_percent,kg_per_person_day,tonnes_period');
    for (const h of hostels) {
      if (h.members < MIN_GROUP) continue;
      lines.push([
        h.name, h.members, round(h.participation * 100, 1),
        round(h.perDay, 3), round((h.totalDay * days) / 1000, 3)
      ].join(','));
    }
    download(`carboncampus-inventory-${todayISO()}.csv`, lines.join('\n'), 'text/csv');
  }

  function exportJson() {
    const payload = {
      standard: 'GHG Protocol category structure; ISO 14064-1 reporting layout',
      campus: CAMPUS.name,
      generated: new Date().toISOString(),
      periodDays: days,
      factorRegistry: REGISTRY_VERSION,
      population: inv.population,
      reporting: inv.reporting,
      coverage: round(inv.coverage, 3),
      totals: {
        kgCO2e: round(inv.totalKg, 1),
        tonnesCO2e: round(inv.totalTonnes, 3),
        perCapitaPerDay: round(inv.perCapitaDay, 3)
      },
      byCategory: Object.fromEntries(
        CATEGORIES.map(cat => [cat.key, round(inv.by[cat.key], 1)])
      ),
      byHostel: hostels
        .filter(h => h.members >= MIN_GROUP)
        .map(h => ({
          hostel: h.name, members: h.members,
          participation: round(h.participation, 3),
          kgPerPersonDay: round(h.perDay, 3)
        })),
      privacy: `Individual records are never exported. Groups under ${MIN_GROUP} people are suppressed.`
    };
    download(`carboncampus-inventory-${todayISO()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  return (
    <div className="view admin">
      <Card
        title="Campus emission inventory"
        sub={<>Aggregated and anonymised. Structured on GHG Protocol categories for ISO 14064-1 style reporting.</>}
        right={
          <div className="segmented" role="group" aria-label="Reporting period">
            {[7, 30, 90].map(d => (
              <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d}d</button>
            ))}
          </div>
        }
      >
        <div className="stat-strip flat">
          <Stat label={`Total, ${days} days`} value={round(inv.totalTonnes, 1)} unit=" t CO2e" />
          <Stat label="Per person per day" value={round(inv.perCapitaDay, 2)} unit=" kg" />
          <Stat label="Population covered" value={fmtNum(inv.population)} hint={`${inv.reporting} actively logging`} />
          <Stat label="Coverage" value={`${Math.round(inv.coverage * 100)}%`}
                tone={inv.coverage > 0.3 ? 'good' : undefined} hint="share of campus reporting" />
        </div>

        <div className="inv-split">
          {CATEGORIES.map(cat => {
            const kg = inv.by[cat.key];
            const share = (kg / inv.totalKg) * 100;
            return (
              <div key={cat.key} className="inv-row">
                <span className="inv-label"><i style={{ background: cat.color }} />{cat.icon} {cat.label}</span>
                <span className="inv-bar"><i style={{ width: `${share}%`, background: cat.color }} /></span>
                <span className="inv-val">{round(kg / 1000, 2)} t <small>{Math.round(share)}%</small></span>
              </div>
            );
          })}
        </div>

        <div className="export-row">
          <button className="btn primary small" onClick={exportCsv}>Export CSV</button>
          <button className="btn ghost small" onClick={exportJson}>Export JSON</button>
          <span className="fineprint">
            Factor registry v{REGISTRY_VERSION} · groups under {MIN_GROUP} people suppressed
          </span>
        </div>
      </Card>

      <Card title="Twelve-week campus trend" sub="Total campus emissions per week, in tonnes CO2e.">
        <CampusTrend weeks={c.weeks} />
      </Card>

      <Card title="Hostel intensity" sub="kg CO2e per resident per day — where an energy audit pays back fastest.">
        <HeatGrid cells={heat} />
        <p className="fineprint">
          Green is lower intensity, red is higher. The spread across hostels is mostly air
          conditioning and geyser load, which is exactly what a retrofit programme can target.
        </p>
      </Card>

      <Card title="Programme health" sub="What a sustainability office would report upward.">
        <ul className="kpi-list">
          <li><span>Students logging weekly</span><strong>{fmtNum(c.activeCount)}</strong></li>
          <li><span>Participation rate</span><strong>{Math.round((c.activeCount / c.population) * 100)}%</strong></li>
          <li><span>Average reduction since joining</span><strong>
            {Math.round(
              (c.students.filter(s => s.active).reduce((a, s) => a + s.reduction, 0) /
                Math.max(c.activeCount, 1)) * 100
            )}%
          </strong></li>
          <li><span>Emissions avoided, annualised</span><strong>{fmtKg(counters.avoidedKgYear)}</strong></li>
          <li><span>Equivalent trees absorbing for a year</span><strong>{fmtNum(counters.treesEquivalent)}</strong></li>
          <li><span>Acting on at least one recommendation</span><strong>
            {Math.round((c.students.filter(s => s.acted).length / Math.max(c.activeCount, 1)) * 100)}%
          </strong></li>
        </ul>
        <div className="pill-row">
          <Pill tone="good">SDG 11</Pill><Pill tone="good">SDG 12</Pill><Pill tone="good">SDG 13</Pill>
          <Pill>SDG 7</Pill><Pill>SDG 4</Pill>
        </div>
      </Card>

      <p className="fineprint block">
        In this public demo the campus population is a seeded synthetic cohort, so the portal has
        something to show. Running the API in <code>server/</code> against Postgres replaces it with
        real aggregates over real logs — the same code path, the same factor registry.
      </p>
    </div>
  );
}
