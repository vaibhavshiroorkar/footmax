import { ATTR_KEYS, AttrKey, Attributes, Player, Position } from './types';
import { Rng, clamp } from './rng';
import { ROLES, isRole } from './roles';

// How much each attribute counts toward a player's overall, per position.
export const POSITION_WEIGHTS: Record<Position, Partial<Record<AttrKey, number>>> = {
  GK: { goalkeeping: 0.6, composure: 0.15, physical: 0.1, passing: 0.1, pace: 0.05 },
  DEF: { defending: 0.4, physical: 0.2, pace: 0.15, passing: 0.1, composure: 0.1, vision: 0.05 },
  MID: { passing: 0.3, vision: 0.2, dribbling: 0.15, composure: 0.1, defending: 0.1, physical: 0.1, shooting: 0.05 },
  FWD: { shooting: 0.35, pace: 0.2, dribbling: 0.2, composure: 0.15, physical: 0.05, vision: 0.05 },
};

export const ATTR_LABELS: Record<AttrKey, string> = {
  pace: 'Pace',
  shooting: 'Shooting',
  passing: 'Passing',
  dribbling: 'Dribbling',
  defending: 'Defending',
  physical: 'Physical',
  vision: 'Vision',
  composure: 'Composure',
  goalkeeping: 'Goalkeeping',
};

export function weightsFor(p: Pick<Player, 'position'> & { role?: string }): Partial<Record<AttrKey, number>> {
  return p.role && isRole(p.role) ? ROLES[p.role].weights : POSITION_WEIGHTS[p.position];
}

export function overall(p: Pick<Player, 'attrs' | 'position'> & { role?: string }): number {
  const w = weightsFor(p);
  let sum = 0;
  for (const k of ATTR_KEYS) sum += (w[k] ?? 0) * p.attrs[k];
  return Math.round(sum);
}

// Effective rating on match day: tired or unhappy players play below their overall.
export function matchRating(p: Player): number {
  const fit = 0.75 + 0.25 * (p.fitness / 100);
  const mor = 0.95 + 0.1 * (p.morale / 100);
  return overall(p) * fit * mor;
}

export function fullName(p: Pick<Player, 'firstName' | 'lastName'>): string {
  return p.firstName ? `${p.firstName} ${p.lastName}` : p.lastName;
}

export function shortName(p: Pick<Player, 'firstName' | 'lastName'>): string {
  return p.firstName ? `${p.firstName[0]}. ${p.lastName}` : p.lastName;
}

// "Virgil van Dijk" -> Virgil / van Dijk. "!Rodri" or a single word -> one name.
export function splitName(name: string): { firstName: string; lastName: string } {
  const clean = name.trim();
  if (clean.startsWith('!')) return { firstName: '', lastName: clean.slice(1).trim() };
  const i = clean.indexOf(' ');
  if (i < 0) return { firstName: '', lastName: clean };
  return { firstName: clean.slice(0, i), lastName: clean.slice(i + 1) };
}

// Builds attributes that land near a target overall for the given position.
// Key attributes for the position sit above the target, the rest below.
export function makeAttributes(rng: Rng, position: Position, target: number, role?: string): Attributes {
  const w = weightsFor({ position, role });
  const attrs = {} as Attributes;
  for (const k of ATTR_KEYS) {
    const weight = w[k] ?? 0;
    let base: number;
    if (k === 'goalkeeping') base = position === 'GK' ? target + 4 : 10 + rng.int(0, 10);
    else if (weight >= 0.15) base = target + 3;
    else if (weight > 0) base = target - 4;
    else base = target - 14;
    attrs[k] = clamp(base + rng.normal(0, 4), 5, 97);
  }
  // Nudge so the computed overall lands on the target.
  const diff = target - overall({ attrs, position, role });
  for (const k of ATTR_KEYS) if ((w[k] ?? 0) > 0) attrs[k] = clamp(attrs[k] + diff, 5, 97);
  return attrs;
}

// Yearly change in overall for players the AI controls (and the user's
// player's natural growth on top of training).
export function seasonalDevelopment(rng: Rng, p: Player): number {
  const ovr = overall(p);
  if (p.age <= 23) {
    const gap = Math.max(0, p.potential - ovr);
    return Math.min(gap, gap * rng.range(0.25, 0.5) + rng.range(0, 2));
  }
  if (p.age <= 29) return Math.min(Math.max(0, p.potential - ovr), rng.range(-1, 2));
  if (p.age <= 32) return -rng.range(1, 3);
  return -rng.range(2, 5);
}

export function applyDevelopment(p: Player, delta: number, rng: Rng): void {
  const w = weightsFor(p);
  for (const k of ATTR_KEYS) {
    const weight = w[k] ?? 0;
    if (!weight) continue;
    // Pace and physical fade first with age.
    const ageBias = delta < 0 && (k === 'pace' || k === 'physical') ? 1.6 : 1;
    p.attrs[k] = clamp(p.attrs[k] + delta * ageBias * rng.range(0.7, 1.3), 5, 99);
  }
}

export function marketValue(p: Player): number {
  const ovr = overall(p);
  let ageFactor = 1;
  if (p.age <= 21) ageFactor = 1.2 + Math.max(0, p.potential - ovr) * 0.04;
  else if (p.age <= 27) ageFactor = 1;
  else if (p.age <= 30) ageFactor = 0.7;
  else ageFactor = 0.4;
  // Steep curve so values look like the real market: about $15M at 80,
  // $40M at 85 and $100M at 90.
  const v = 50_000 * Math.pow(1.21, ovr - 50) * ageFactor;
  return roundMoney(Math.max(10_000, v));
}

export function fairWage(p: Player): number {
  return roundMoney(Math.max(250, 300 * Math.pow(1.16, overall(p) - 50)));
}

// Transfer budget a club of this reputation starts a season with.
export function clubBudget(rep: number): number {
  return roundMoney(2_000_000 * Math.pow(1.12, rep - 50));
}

// Weekly income, sized so a club whose squad matches its reputation
// roughly breaks even on wages.
export function clubIncome(rep: number, homeGame: boolean): number {
  return roundMoney(8_000 * Math.pow(1.16, 0.47 * rep - 12) * (homeGame ? 1.25 : 0.85));
}

export function roundMoney(v: number): number {
  if (v >= 1_000_000) return Math.round(v / 100_000) * 100_000;
  if (v >= 10_000) return Math.round(v / 1_000) * 1_000;
  return Math.round(v / 50) * 50;
}

export function formatMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${sign}$${Math.round(a / 1_000)}K`;
  return `${sign}$${Math.round(a)}`;
}

export function emptyStats() {
  return { apps: 0, goals: 0, assists: 0, ratingSum: 0 };
}

export function avgRating(s: { apps: number; ratingSum: number }): number {
  return s.apps ? s.ratingSum / s.apps : 0;
}
