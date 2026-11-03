import { DataPack } from '../pack';
import { BUILTIN_PACK } from '../builtin';
import { START_YEAR } from '../../engine/generator';

// The seasons a new game can start in, newest first. The current season
// uses the built-in pack; past seasons each have their own pack with that
// season's clubs and squads, loaded only when picked so the app does not
// carry every era for everyone.
export interface SeasonOption {
  year: number;
  // "2006/07"
  label: string;
  ready: boolean;
  load: () => Promise<DataPack>;
}

export const FIRST_SEASON = 2006;

// Past seasons with data. Each entry loads one file in this folder.
const PAST: Record<number, () => Promise<DataPack>> = {};

export function seasonLabel(year: number): string {
  return `${year}/${String(year + 1).slice(2)}`;
}

export const SEASONS: SeasonOption[] = Array.from({ length: START_YEAR - FIRST_SEASON + 1 }, (_, i) => START_YEAR - i).map((year) => {
  if (year === START_YEAR) return { year, label: seasonLabel(year), ready: true, load: async () => ({ ...BUILTIN_PACK, startYear: START_YEAR }) };
  const load = PAST[year];
  return { year, label: seasonLabel(year), ready: !!load, load: load ?? (async () => Promise.reject(new Error(`No data for ${seasonLabel(year)} yet.`))) };
});
