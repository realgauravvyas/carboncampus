/**
 * CarbonCampus — Source register
 * ------------------------------
 * Every emission factor in the registry points at one of these entries, and the
 * app renders the link next to the number. If a factor cannot name a public,
 * checkable source, it does not belong in the registry.
 */

export interface Source {
  id: string;
  name: string;
  org: string;
  year: string;
  url: string;
  note: string;
}

export const SOURCES: Record<string, Source> = {
  cea: {
    id: 'cea',
    name: 'CO2 Baseline Database for the Indian Power Sector, v20',
    org: 'Central Electricity Authority (CEA), Government of India',
    year: 'FY 2023-24',
    url: 'https://cea.nic.in/cdm-co2-baseline-database/?lang=en',
    note: 'Grid emission rate for all electricity consumed on campus. Published yearly, so the pack is re-versioned yearly.'
  },
  morth: {
    id: 'morth',
    name: 'Road Transport Year Book & fuel economy norms',
    org: 'Ministry of Road Transport and Highways (MoRTH)',
    year: '2023-24',
    url: 'https://morth.nic.in/road-transport-year-books',
    note: 'Vehicle fuel economy and fleet occupancy used to derive per-passenger-km factors for Indian conditions.'
  },
  defra: {
    id: 'defra',
    name: 'UK Government GHG Conversion Factors for Company Reporting',
    org: 'DESNZ / DEFRA',
    year: '2024',
    url: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
    note: 'Used only where no Indian equivalent is published — notably aviation with radiative forcing uplift.'
  },
  poore: {
    id: 'poore',
    name: 'Reducing food’s environmental impacts through producers and consumers',
    org: 'Poore, J. & Nemecek, T., Science 360(6392), 987-992',
    year: '2018',
    url: 'https://www.science.org/doi/10.1126/science.aaq0216',
    note: 'The standard meta-analysis of food LCA (38,700 farms). Per-kg factors recombined into Indian mess-plate portions.'
  },
  cpcb: {
    id: 'cpcb',
    name: 'Solid waste and plastic waste management annual reports',
    org: 'Central Pollution Control Board (CPCB), Government of India',
    year: '2023-24',
    url: 'https://cpcb.nic.in/annual-report-swm/',
    note: 'Indian end-of-life treatment mix — landfill share, recycling rates and the organic fraction that drives methane.'
  },
  warm: {
    id: 'warm',
    name: 'Waste Reduction Model (WARM), v16',
    org: 'US Environmental Protection Agency',
    year: '2024',
    url: 'https://www.epa.gov/warm',
    note: 'Material-level life-cycle emission and end-of-life credits for plastics, paper and e-waste.'
  },
  bee: {
    id: 'bee',
    name: 'Standards & Labelling programme appliance datasheets',
    org: 'Bureau of Energy Efficiency (BEE), Government of India',
    year: '2024',
    url: 'https://beeindia.gov.in/en/programmesstandards-labeling',
    note: 'Rated power draw for fans, lights, ACs, geysers and other hostel appliances.'
  },
  ipcc: {
    id: 'ipcc',
    name: '2006 IPCC Guidelines for National Greenhouse Gas Inventories (2019 Refinement)',
    org: 'IPCC / IGES',
    year: '2019',
    url: 'https://www.ipcc-nggip.iges.or.jp/public/2019rf/index.html',
    note: 'The Tier-1 activity-data × emission-factor method this engine implements, and the GWP-100 basis for CO2e.'
  },
  ghgp: {
    id: 'ghgp',
    name: 'GHG Protocol Corporate Standard & Scope 3 Standard',
    org: 'World Resources Institute / WBCSD',
    year: '2015',
    url: 'https://ghgprotocol.org/corporate-standard',
    note: 'Scope boundaries used to structure the campus inventory the admin portal exports.'
  },
  iso14064: {
    id: 'iso14064',
    name: 'ISO 14064-1: Organization-level GHG quantification and reporting',
    org: 'International Organization for Standardization',
    year: '2018',
    url: 'https://www.iso.org/standard/66453.html',
    note: 'Reporting structure the campus inventory is designed to feed. CarbonCampus is not itself certified.'
  },
  epaEquiv: {
    id: 'epaEquiv',
    name: 'Greenhouse Gas Equivalencies Calculator — calculations and references',
    org: 'US Environmental Protection Agency',
    year: '2024',
    url: 'https://www.epa.gov/energy/greenhouse-gases-equivalencies-calculator-calculations-and-references',
    note: 'Method behind the "trees", "km driven" and "phone charges" equivalents shown to users.'
  },
  fsi: {
    id: 'fsi',
    name: 'India State of Forest Report — carbon stock assessment',
    org: 'Forest Survey of India',
    year: '2023',
    url: 'https://fsi.nic.in/forest-report-2023',
    note: 'Indian sequestration rates used to sanity-check the mature-tree equivalent.'
  },
  iea: {
    id: 'iea',
    name: 'India Energy Outlook / electricity data',
    org: 'International Energy Agency',
    year: '2024',
    url: 'https://www.iea.org/countries/india',
    note: 'Cross-check on the national grid factor and its year-on-year trajectory.'
  }
};

export const SOURCE_LIST: Source[] = Object.values(SOURCES);

export function source(id: string): Source | undefined {
  return SOURCES[id];
}

export function sourcesFor(ids: string | string[] | undefined): Source[] {
  if (!ids) return [];
  const list = Array.isArray(ids) ? ids : [ids];
  return list.map(id => SOURCES[id]).filter(Boolean) as Source[];
}
