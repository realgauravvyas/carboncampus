/**
 * Methodology — the auditable half of the trust story.
 *
 * Every factor the engine multiplies by is listed here with its value, its
 * uncertainty and a link to the published source it came from. If a number in
 * this app cannot be traced to a citable document, it should not be here.
 */

import { useMemo, useState } from 'react';
import {
  APPLIANCES, APPLIANCE_SRC, CAMPUS, GRID, PACKS, REGISTRY_UPDATED, REGISTRY_VERSION,
  SOURCE_LIST, auditTrail
} from '@carboncampus/shared';
import { Card, Pill, SourceLinks } from '../components/ui';

const CATS = ['All', 'Transport', 'Energy', 'Food', 'Waste'] as const;

export default function Methodology() {
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  const rows = useMemo(() => auditTrail(), []);
  const shown = cat === 'All' ? rows : rows.filter(r => r.category === cat);

  return (
    <div className="view methodology">
      <Card title="How a footprint is calculated"
            sub={`Factor registry v${REGISTRY_VERSION}, updated ${REGISTRY_UPDATED}`}>
        <p className="formula">Emissions (kg CO<sub>2</sub>e) = Activity Data × Emission Factor</p>
        <p>
          This is the IPCC Tier-1 method: measure what someone did, multiply by a published factor
          for that activity in that place, and sum. Activity data comes from the daily log. Factors
          come from the registry below, which is versioned and campus-specific — the grid factor for{' '}
          {CAMPUS.name} is <strong>{GRID.ef} kg CO<sub>2</sub>e/kWh</strong> on the{' '}
          {CAMPUS.gridRegion}.
        </p>
        <p>
          Uncertainty is carried through rather than hidden. Each factor publishes a fractional
          uncertainty; day totals combine them in quadrature, which is why the range you see on the
          dashboard grows more slowly than the total does.
        </p>
      </Card>

      <Card
        title="Emission factor registry"
        sub={`${rows.length} factors, every one with a public source`}
        right={
          <div className="segmented small" role="group" aria-label="Filter by category">
            {CATS.map(c => (
              <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
        }
      >
        <div className="table-scroll">
          <table className="factors">
            <thead>
              <tr>
                <th>Activity</th><th>Factor</th><th>Unit</th><th>± </th><th>Basis and source</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={`${r.category}-${r.key}`}>
                  <td>
                    <strong>{r.label}</strong>
                    <small className="dim"> {r.category}</small>
                  </td>
                  <td className="num">{r.ef}</td>
                  <td className="unit">{r.unit.replace('kg CO2e / ', '')}</td>
                  <td className="num">{r.unc ? `${Math.round(r.unc * 100)}%` : '—'}</td>
                  <td>
                    <span className="basis">{r.src}</span>
                    {r.sources.map(s => (
                      <a key={s.id} className="srclink" href={s.url} target="_blank" rel="noreferrer noopener">
                        {s.org.split(',')[0].split('(')[0].trim()} ↗
                      </a>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Appliance power ratings" sub={APPLIANCE_SRC}>
        <div className="appliance-grid">
          {Object.entries(APPLIANCES).map(([k, a]) => (
            <div key={k} className="appliance">
              <span aria-hidden>{a.icon}</span>
              <strong>{a.w} W</strong>
              <small>{a.label}</small>
            </div>
          ))}
        </div>
        <SourceLinks ids="bee" />
      </Card>

      <Card title="Where the data comes from"
            sub="Full source register. Every link is public and checkable.">
        <ol className="sources">
          {SOURCE_LIST.map(s => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer noopener"><strong>{s.name}</strong></a>
              <span className="src-org">{s.org} · {s.year}</span>
              <span className="src-note">{s.note}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Campus factor packs" sub="Emission factors are configuration, not code.">
        <ul className="packs">
          {PACKS.map(p => (
            <li key={p.id}>
              <div>
                <strong>{p.name}</strong>
                <small>{p.note}</small>
              </div>
              <span className="pack-grid">{p.grid} kg/kWh</span>
              <Pill tone={p.status === 'active' ? 'good' : ''}>{p.status}</Pill>
            </li>
          ))}
        </ul>
        <p className="fineprint">
          Onboarding a new college means writing a new pack — grid region, mess menu, shuttle fleet,
          hostel list — not touching the engine. The same mechanism turns campus templates into
          citizen templates for a ward-level rollout.
        </p>
      </Card>

      <Card title="Validation" sub="How we check the engine is not quietly wrong.">
        <ul className="checklist">
          <li>
            <strong>Unit tests on the engine.</strong> Hand-computed expectations for each category,
            additivity across categories, and bounds checks on every factor run in CI on each push.
          </li>
          <li>
            <strong>Per-capita sanity band.</strong> Demo personas must land between 1.5 and 20 kg
            CO<sub>2</sub>e a day; India averages roughly 2 t a year, about 5.5 kg a day.
          </li>
          <li>
            <strong>Bill reconciliation (pilot).</strong> Aggregate hostel electricity from logs is
            to be compared against the institute&apos;s metered consumption for the same block and
            month, and the factor pack tuned to close the gap.
          </li>
          <li>
            <strong>Versioned factors.</strong> Every result records the registry version that
            produced it, so a factor update never silently rewrites history.
          </li>
        </ul>
      </Card>

      <Card title="Privacy" sub="What is stored, where, and what leaves the device.">
        <ul className="checklist">
          <li><strong>Local first.</strong> In this public demo every log lives in your browser&apos;s
            IndexedDB. There is no account, no server, and nothing to leak.</li>
          <li><strong>No precise location.</strong> The app asks for distance and mode, never GPS traces.</li>
          <li><strong>Aggregates only.</strong> The admin portal sees group totals, and suppresses any
            group with fewer than five people.</li>
          <li><strong>Exportable and erasable.</strong> Your data downloads as JSON and clears completely
            from Settings.</li>
        </ul>
      </Card>

      <p className="fineprint block">
        Factor values are best available public estimates, not measurements of your specific vehicle,
        room or plate. The uncertainty band is shown precisely so the number is read as an estimate.
        Where an Indian source exists it is preferred; where none is published, an international one is
        used and labelled as such.
      </p>
    </div>
  );
}
