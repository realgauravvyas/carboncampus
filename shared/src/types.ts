/** CarbonCampus — shared domain types. */

export type CategoryKey = 'transport' | 'energy' | 'food' | 'waste';

export type TransportMode =
  | 'walk' | 'cycle' | 'eshuttle' | 'shuttle' | 'bus' | 'train'
  | 'auto' | 'bike' | 'scooter' | 'carpool' | 'car' | 'ev' | 'flight';

export type MealType = 'vegan' | 'veg' | 'egg' | 'fish' | 'chicken' | 'mutton';

export type ApplianceKey =
  | 'fan' | 'light' | 'laptop' | 'desktop' | 'ac' | 'geyser' | 'heater' | 'fridge' | 'lab';

export type WasteItem = 'bottle' | 'cup' | 'bag' | 'paper' | 'parcel' | 'ewaste';

export type PlateWaste = 'none' | 'low' | 'mid' | 'high';

/** A citable emission factor. Everything the engine multiplies by lives here. */
export interface Factor {
  ef: number;
  label: string;
  icon?: string;
  /** Fractional uncertainty, used to build the band shown to users. */
  unc: number;
  /** How easy a swap to this option is, 1 (hard) to 5 (trivial). */
  ease?: number;
  unit?: string;
  /** Prose citation shown under the number. */
  src: string;
  /** Key(s) into the SOURCES register, so the UI can link out. */
  srcId?: string | string[];
}

export interface Trip {
  mode: TransportMode;
  km: number;
}

export interface DayLog {
  date: string;                       // YYYY-MM-DD
  transport: Trip[];
  energy: Partial<Record<ApplianceKey, number>>;   // hours
  food: {
    meals: MealType[];
    tea: number;
    outside: number;
    waste: PlateWaste;
  };
  waste: Partial<Record<WasteItem, number>>;       // item counts
  template?: string | null;
  syncedAt?: string | null;
}

export interface LineItem {
  label: string;
  icon?: string;
  kg: number;
  kwh?: number;
}

export interface DayResult {
  date: string;
  total: number;
  by: Record<CategoryKey, number>;
  kwh: number;
  sigma: number;
  low: number;
  high: number;
  detail: Record<CategoryKey, LineItem[]>;
}

export interface RangeResult {
  days: DayResult[];
  total: number;
  by: Record<CategoryKey, number>;
  kwh: number;
  sigma: number;
  perDay: number;
  count: number;
}

export interface Profile {
  name: string;
  email: string;
  role: 'student' | 'faculty' | 'staff';
  hostel: string;
  dept: string;
  year: number;
  campus: string;
  joinedAt: string;
  baselinePerDay?: number;
  greenPoints?: number;
}

export interface QuizAnswers {
  commuteMode?: TransportMode;
  commuteKm?: number;
  cityMode?: TransportMode;
  cityTripsPerWeek?: number;
  flightsPerYear?: number;
  fanHours?: number;
  lightHours?: number;
  laptopHours?: number;
  acHours?: number;
  geyserMinutes?: number;
  labHours?: number;
  nonVegMealsPerWeek?: number;
  nonVegType?: MealType;
  vegType?: MealType;
  teaPerDay?: number;
  outsideOrdersPerWeek?: number;
  plateWaste?: PlateWaste;
  bottlesPerWeek?: number;
  cupsPerWeek?: number;
  sheetsPerWeek?: number;
  parcelsPerMonth?: number;
}

export interface Suggestion {
  id: string;
  category: CategoryKey;
  title: string;
  habit: string;
  swap: string;
  math: string;
  saving: number;        // kg CO2e per month
  ease: number;          // 1..5
  icon: string;
  score: number;
  points: number;
}

export interface Challenge {
  id: string;
  suggestionId: string;
  title: string;
  icon: string;
  saving: number;
  points: number;
  startedAt: string;
  endsAt: string;
  done: boolean;
  completedAt?: string;
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  need: string;
  got: boolean;
}

export interface LeagueRow {
  name: string;
  members: number;
  active: number;
  participation: number;
  perDay: number;
  by: Record<CategoryKey, number>;
  totalDay: number;
  avgStreak: number;
  reduction: number;
  youAreHere?: boolean;
}
