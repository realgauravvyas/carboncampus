/**
 * Generates docs/REFERENCES.md straight from the factor registry.
 *
 * Written rather than hand-maintained so the citation list can never drift from
 * the numbers the app actually uses. Run after changing any factor:
 *
 *   npm run build:shared && node scripts/gen-references.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  auditTrail, SOURCE_LIST, SOURCES, REGISTRY_VERSION, REGISTRY_UPDATED,
  CAMPUS, APPLIANCES, APPLIANCE_SRC, EQUIV
} = await import(pathToFileURL(join(root, 'shared', 'dist', 'index.js')).href);

const rows = auditTrail();
const link = s => `[${s.org.split(',')[0].split('(')[0].trim()}](${s.url})`;

const byCategory = {};
for (const r of rows) (byCategory[r.category] ??= []).push(r);

const out = [];

out.push(`# Data sources and emission factors

Every number CarbonCampus multiplies by is listed here, with the published source it came from.
This file is generated from the registry itself (\`shared/src/factors.ts\` and
\`shared/src/sources.ts\`) by \`scripts/gen-references.mjs\`, so it cannot drift out of step with
the app.

- **Factor registry version:** ${REGISTRY_VERSION}
- **Last updated:** ${REGISTRY_UPDATED}
- **Campus pack:** ${CAMPUS.name} — ${CAMPUS.gridRegion}
- **Method:** Emissions (kg CO₂e) = Activity Data × Emission Factor (IPCC Tier 1, GWP-100)

Uncertainty is the fractional 1-sigma value published with each factor. Day totals combine them in
quadrature, which is why the range shown in the app grows more slowly than the total.

---
`);

for (const [category, list] of Object.entries(byCategory)) {
  out.push(`## ${category}\n`);
  out.push('| Activity | Factor | Unit | Uncertainty | Basis | Source |');
  out.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of list) {
    const unit = r.unit.replace('kg CO2e / ', '');
    const unc = r.unc ? `±${Math.round(r.unc * 100)}%` : '—';
    const srcs = r.sources.map(link).join(', ') || '—';
    out.push(`| ${r.label} | ${r.ef} | kg CO₂e/${unit} | ${unc} | ${r.src} | ${srcs} |`);
  }
  out.push('');
}

out.push(`## Appliance power ratings

${APPLIANCE_SRC}. Source: ${link(SOURCES.bee)}.
`);
out.push('| Appliance | Rated power |');
out.push('| --- | --- |');
for (const a of Object.values(APPLIANCES)) out.push(`| ${a.label} | ${a.w} W |`);
out.push('');

out.push(`## Equivalents

The "what that adds up to" tiles convert kg CO₂e into something imaginable.
`);
out.push('| Equivalent | Basis | Source |');
out.push('| --- | --- | --- |');
for (const [key, e] of Object.entries(EQUIV)) {
  const ids = key === 'tree' ? ['epaEquiv', 'fsi']
    : key === 'carKm' ? ['morth']
    : ['cea'];
  out.push(`| ${e.label} | ${e.per} kg CO₂e each — ${e.src} | ${ids.map(i => link(SOURCES[i])).join(', ')} |`);
}
out.push('');

out.push(`---

## Full source register

`);
for (const s of SOURCE_LIST) {
  out.push(`### ${s.name}`);
  out.push(`- **Publisher:** ${s.org}`);
  out.push(`- **Edition / year:** ${s.year}`);
  out.push(`- **URL:** <${s.url}>`);
  out.push(`- **Used for:** ${s.note}`);
  out.push('');
}

out.push(`---

## Citation block for slides

Paste this on a references slide:

> **Emission factors:** Central Electricity Authority, *CO₂ Baseline Database for the Indian Power
> Sector v20* (FY 2023-24); Ministry of Road Transport & Highways, *Road Transport Year Book*;
> Poore, J. & Nemecek, T. (2018), *Science* 360(6392), 987-992; Central Pollution Control Board,
> solid and plastic waste annual reports; US EPA, *WARM* v16; Bureau of Energy Efficiency,
> Standards & Labelling datasheets; DESNZ/DEFRA (2024) conversion factors for aviation.
> **Method:** IPCC 2006 Guidelines (2019 Refinement), Tier 1. **Reporting structure:** GHG Protocol
> Corporate Standard; ISO 14064-1. **Equivalents:** US EPA Greenhouse Gas Equivalencies Calculator;
> Forest Survey of India, *India State of Forest Report 2023*.

Short form, if the slide is tight:

> Factors: CEA v20 (grid), MoRTH (transport), Poore & Nemecek 2018 (food), CPCB + EPA WARM (waste),
> BEE (appliances), DEFRA 2024 (aviation). Method: IPCC Tier 1. Reporting: GHG Protocol / ISO 14064-1.
`);

mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'REFERENCES.md'), out.join('\n'), 'utf8');
console.log(`docs/REFERENCES.md written — ${rows.length} factors, ${SOURCE_LIST.length} sources.`);
