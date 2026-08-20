/**
 * CarbonCampus — Emission Factor Registry
 * ---------------------------------------
 * Every factor is a versioned, citable record: EF = f(activity, campus, year).
 * Factors are DATA, not code — onboarding a new campus means shipping a new
 * factor pack, not editing the engine (see PACKS at the bottom of this file).
 *
 * The same registry is imported by the PWA and by the API, so a number can
 * never drift between what a student sees and what the campus report totals.
 */

import type {
  ApplianceKey, Factor, MealType, PlateWaste, TransportMode, WasteItem
} from './types.js';
import { sourcesFor, type Source } from './sources.js';

export const REGISTRY_VERSION = '1.0.0';
export const REGISTRY_UPDATED = '2026-08-20';

/* ------------------------------------------------------------------ *
 * Campus pack — IIT Guwahati (default)
 * ------------------------------------------------------------------ */

export const CAMPUS = {
  id: 'iitg',
  name: 'IIT Guwahati',
  city: 'Guwahati, Assam',
  gridRegion: 'NEWNE grid (CEA all-India weighted average)',
  hostels: [
    'Barak', 'Brahmaputra', 'Dhansiri', 'Dibang', 'Dihing', 'Disang',
    'Kameng', 'Kapili', 'Lohit', 'Manas', 'Siang', 'Subansiri', 'Umiam'
  ],
  departments: [
    'Computer Science & Engineering', 'Electronics & Electrical Engineering',
    'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering',
    'Chemistry', 'Physics', 'Mathematics', 'Biosciences & Bioengineering',
    'Design', 'Humanities & Social Sciences', 'Energy', 'Data Science'
  ],
  /** One-way distances used to pre-fill commute templates, in km. */
  routes: {
    'Hostel to Academic Complex': 1.8,
    'Hostel to Lecture Hall Complex': 1.4,
    'Campus to Jalukbari': 8.0,
    'Campus to Paltan Bazaar': 20.0,
    'Campus to LGB Airport': 22.0
  } as Record<string, number>
};

/* ------------------------------------------------------------------ *
 * Electricity
 * ------------------------------------------------------------------ */

export const GRID: Factor = {
  ef: 0.716,
  unit: 'kg CO2e / kWh',
  unc: 0.08,
  label: 'Grid electricity',
  srcId: 'cea',
  src: 'CEA CO2 Baseline Database for the Indian Power Sector, v20 (FY 2023-24) — weighted average grid emission rate'
};

/** Rated draw of common hostel and lab appliances, in watts. */
export const APPLIANCES: Record<ApplianceKey, { w: number; label: string; icon: string }> = {
  fan:     { w: 70,   label: 'Ceiling fan',          icon: '🌀' },
  light:   { w: 20,   label: 'Lights (LED/tube)',    icon: '💡' },
  laptop:  { w: 60,   label: 'Laptop',               icon: '💻' },
  desktop: { w: 200,  label: 'Desktop / gaming PC',  icon: '🖥️' },
  ac:      { w: 1500, label: 'Air conditioner',      icon: '❄️' },
  geyser:  { w: 2000, label: 'Geyser / immersion',   icon: '🚿' },
  heater:  { w: 1000, label: 'Kettle / room heater', icon: '🔥' },
  fridge:  { w: 60,   label: 'Mini fridge (avg)',    icon: '🧊' },
  lab:     { w: 400,  label: 'Lab equipment share',  icon: '🔬' }
};

export const APPLIANCE_SRC =
  'Rated power from BEE star-label appliance datasheets; duty-cycle averaged for fridge and lab share';

/* ------------------------------------------------------------------ *
 * Transport — kg CO2e per passenger-kilometre
 * ------------------------------------------------------------------ */

export const TRANSPORT: Record<TransportMode, Factor> = {
  walk:     { ef: 0.0,   label: 'Walk',              icon: '🚶', unc: 0.0,  ease: 5,
              srcId: 'ipcc',
              src: 'Zero direct operational emissions' },
  cycle:    { ef: 0.0,   label: 'Cycle',             icon: '🚲', unc: 0.0,  ease: 5,
              srcId: 'ipcc',
              src: 'Zero direct operational emissions' },
  eshuttle: { ef: 0.026, label: 'E-rickshaw',        icon: '🛺', unc: 0.20, ease: 4,
              srcId: ['cea', 'morth'],
              src: '0.10 kWh/km over 4 passengers, at the CEA grid factor' },
  shuttle:  { ef: 0.045, label: 'Campus shuttle',    icon: '🚐', unc: 0.18, ease: 4,
              srcId: ['morth', 'ipcc'],
              src: 'Diesel bus 4.5 km/l, 2.68 kg CO2/l, 40 seats at 65% occupancy (MoRTH fleet data)' },
  bus:      { ef: 0.052, label: 'City bus',          icon: '🚌', unc: 0.20, ease: 3,
              srcId: 'morth',
              src: 'ASTC city fleet, MoRTH fuel economy with average occupancy' },
  train:    { ef: 0.011, label: 'Train',             icon: '🚆', unc: 0.25, ease: 3,
              srcId: ['cea', 'iea'],
              src: 'Indian Railways electric traction, passenger-km basis' },
  auto:     { ef: 0.098, label: 'Auto-rickshaw',     icon: '🛵', unc: 0.20, ease: 3,
              srcId: ['morth', 'ipcc'],
              src: 'CNG 25 km/kg, 2.75 kg CO2/kg CNG, 1.7 passengers' },
  bike:     { ef: 0.051, label: 'Motorbike',         icon: '🏍️', unc: 0.15, ease: 3,
              srcId: 'morth',
              src: 'Petrol 45 km/l, 2.31 kg CO2/l (MoRTH fuel economy norms)' },
  scooter:  { ef: 0.062, label: 'Scooter',           icon: '🛴', unc: 0.15, ease: 3,
              srcId: 'morth',
              src: 'Petrol 37 km/l, 2.31 kg CO2/l' },
  carpool:  { ef: 0.058, label: 'Car (shared by 3)', icon: '🚗', unc: 0.15, ease: 3,
              srcId: 'morth',
              src: 'Petrol car 13.5 km/l split across three occupants' },
  car:      { ef: 0.171, label: 'Car (alone)',       icon: '🚙', unc: 0.15, ease: 2,
              srcId: 'morth',
              src: 'Petrol car 13.5 km/l, 2.31 kg CO2/l, single occupant' },
  ev:       { ef: 0.107, label: 'Electric car',      icon: '🔌', unc: 0.20, ease: 2,
              srcId: ['cea', 'morth'],
              src: '0.15 kWh/km at the CEA grid factor of 0.716 kg/kWh' },
  flight:   { ef: 0.244, label: 'Flight (domestic)', icon: '✈️', unc: 0.20, ease: 1,
              srcId: 'defra',
              src: 'DEFRA 2024 domestic short-haul including radiative forcing uplift' }
};

/* ------------------------------------------------------------------ *
 * Food — kg CO2e per meal / serving
 * ------------------------------------------------------------------ */

export const FOOD: Record<MealType, Factor> = {
  vegan:   { ef: 0.68, label: 'Vegan thali',  icon: '🥗', unc: 0.25,
             srcId: 'poore',
             src: 'Poore & Nemecek (2018) Science — cereals, pulses, vegetables, oil' },
  veg:     { ef: 1.24, label: 'Veg thali',    icon: '🍛', unc: 0.25,
             srcId: 'poore',
             src: 'Poore & Nemecek (2018) plus the Indian dairy share (paneer, curd, ghee)' },
  egg:     { ef: 1.62, label: 'Egg meal',     icon: '🍳', unc: 0.25,
             srcId: 'poore',
             src: 'Poore & Nemecek (2018) — eggs at 4.7 kg CO2e/kg over a veg base' },
  fish:    { ef: 1.94, label: 'Fish meal',    icon: '🐟', unc: 0.30,
             srcId: 'poore',
             src: 'Poore & Nemecek (2018) — farmed fish at 5.4 kg CO2e/kg over a veg base' },
  chicken: { ef: 2.51, label: 'Chicken meal', icon: '🍗', unc: 0.25,
             srcId: 'poore',
             src: 'Poore & Nemecek (2018) — poultry at 9.9 kg CO2e/kg over a veg base' },
  mutton:  { ef: 5.42, label: 'Mutton meal',  icon: '🍖', unc: 0.35,
             srcId: 'poore',
             src: 'Poore & Nemecek (2018) — mutton at 39.2 kg CO2e/kg over a veg base' }
};

export const FOOD_EXTRAS: Record<'tea' | 'outside' | 'waste', Factor> = {
  tea:     { ef: 0.09, label: 'Tea / coffee (cup)',   icon: '☕', unc: 0.30,
             srcId: 'poore',
             src: 'Dairy milk 150 ml at 1.4 kg CO2e/l plus brewing energy' },
  outside: { ef: 0.51, label: 'Delivered order',      icon: '🛵', unc: 0.35,
             srcId: ['poore', 'warm'],
             src: 'Packaging and last-mile delivery uplift over an equivalent mess meal' },
  waste:   { ef: 2.53, label: 'Food wasted (per kg)', icon: '🗑️', unc: 0.30,
             srcId: ['poore', 'cpcb'],
             src: 'Embedded production emissions plus CPCB landfill methane for the organic fraction' }
};

/** Plate-waste levels mapped to kilograms per meal. */
export const WASTE_LEVELS: Record<PlateWaste, { kg: number; label: string }> = {
  none: { kg: 0.00, label: 'Clean plate' },
  low:  { kg: 0.05, label: 'A few bites' },
  mid:  { kg: 0.15, label: 'A quarter left' },
  high: { kg: 0.30, label: 'Half or more' }
};

/* ------------------------------------------------------------------ *
 * Waste & consumption — kg CO2e per item
 * ------------------------------------------------------------------ */

export const WASTE: Record<WasteItem, Factor> = {
  bottle: { ef: 0.083,  label: 'Plastic bottle (500 ml)', icon: '🧴', unc: 0.20, ease: 5,
            srcId: ['warm', 'cpcb'],
            src: 'PET production 3.0 kg CO2e/kg plus CPCB end-of-life, 28 g bottle' },
  cup:    { ef: 0.049,  label: 'Disposable cup',          icon: '🥤', unc: 0.25, ease: 5,
            srcId: 'warm',
            src: 'Paper/PS cup LCA with EPA WARM end-of-life equivalents' },
  bag:    { ef: 0.033,  label: 'Plastic bag',             icon: '🛍️', unc: 0.25, ease: 5,
            srcId: ['warm', 'cpcb'],
            src: 'LDPE 2.0 kg CO2e/kg, 16 g bag' },
  paper:  { ef: 0.0046, label: 'Printed sheet (A4)',      icon: '📄', unc: 0.25, ease: 4,
            srcId: 'warm',
            src: 'Virgin paper 0.92 kg CO2e/kg, 5 g per sheet' },
  parcel: { ef: 0.31,   label: 'Online order / parcel',   icon: '📦', unc: 0.35, ease: 3,
            srcId: 'warm',
            src: 'Corrugated packaging plus last-mile logistics per parcel' },
  ewaste: { ef: 1.42,   label: 'E-waste (per kg)',        icon: '🔋', unc: 0.40, ease: 3,
            srcId: ['cpcb', 'warm'],
            src: 'CPCB e-waste handling with EPA WARM recycling credit basis' }
};

/* ------------------------------------------------------------------ *
 * Equivalents — how a kilogram of CO2e is made tangible
 * ------------------------------------------------------------------ */

export const EQUIV = {
  tree:   { per: 21.0,   icon: '🌳', label: 'trees absorbing for a year',
            srcId: ['epaEquiv', 'fsi'],
            src: 'ICFRE / FAO: a mature broadleaf tree sequesters about 21 kg CO2 a year' },
  carKm:  { per: 0.171,  icon: '🚙', label: 'km driven alone by car',
            srcId: 'morth',
            src: 'Petrol car at 13.5 km/l' },
  phone:  { per: 0.0086, icon: '📱', label: 'smartphone charges',
            srcId: 'cea',
            src: '12 Wh per full charge at the CEA grid factor' },
  acHour: { per: 1.074,  icon: '❄️', label: 'hours of AC running',
            srcId: ['cea', 'bee'],
            src: '1.5 kW air conditioner at the CEA grid factor' },
  ledDay: { per: 0.344,  icon: '💡', label: 'days of a tube light left on',
            srcId: ['cea', 'bee'],
            src: '20 W for 24 h at the CEA grid factor' }
};

/* ------------------------------------------------------------------ *
 * Campus packs — the "configuration, not code" scaling story
 * ------------------------------------------------------------------ */

export interface CampusPack {
  id: string;
  name: string;
  grid: number;
  status: 'active' | 'draft' | 'planned';
  note: string;
}

export const PACKS: CampusPack[] = [
  { id: 'iitg', name: 'IIT Guwahati', grid: 0.716, status: 'active',
    note: 'Reference pack: NEWNE grid, 13 hostels, diesel shuttle fleet, mess menu calibrated.' },
  { id: 'iitb', name: 'IIT Bombay', grid: 0.702, status: 'draft',
    note: 'Western grid factor, BEST bus routes, a larger share of day scholars.' },
  { id: 'du', name: 'Delhi University', grid: 0.734, status: 'draft',
    note: 'Northern grid, metro-dominant commute, distributed campuses.' },
  { id: 'city', name: 'Ward-level (city)', grid: 0.716, status: 'planned',
    note: 'Citizen templates replace campus templates; same engine, same registry.' }
];

export interface AuditRow {
  category: string;
  key: string;
  label: string;
  ef: number;
  unit: string;
  unc: number;
  src: string;
  sources: Source[];
}

/** Flat, printable view of the registry for the in-app Methodology screen. */
export function auditTrail(): AuditRow[] {
  const rows: AuditRow[] = [];
  const push = (category: string, key: string, r: Factor, unit: string) => rows.push({
    category, key, label: r.label, ef: r.ef, unit, unc: r.unc, src: r.src,
    sources: sourcesFor(r.srcId)
  });

  push('Energy', 'grid', GRID, GRID.unit ?? 'kg CO2e / kWh');
  for (const [k, r] of Object.entries(TRANSPORT)) push('Transport', k, r, 'kg CO2e / passenger-km');
  for (const [k, r] of Object.entries(FOOD)) push('Food', k, r, 'kg CO2e / meal');
  for (const [k, r] of Object.entries(FOOD_EXTRAS)) push('Food', k, r, 'kg CO2e / serving');
  for (const [k, r] of Object.entries(WASTE)) push('Waste', k, r, 'kg CO2e / item');
  return rows;
}
