import { ATTR_KEYS, AttrKey, Attributes, Build } from './types';
import { ROLES, Role } from './roles';
import { clamp } from './rng';

// Player creation rules. Pure functions: the wizard preview and
// newCareerGame both call these, so they always agree.

export const STAT_POINTS = 40;
export const MAX_PER_ATTR = 15;
export const FREE_WEAK_FOOT = 2;
export const WEAK_FOOT_COST = 4;

export interface Body {
  heightCm: number;
  build: Build;
}

export type Allocation = Partial<Record<AttrKey, number>>;

export interface StylePreset {
  id: string;
  label: string;
  description: string;
  weights: Partial<Record<AttrKey, number>>;
}

const GK_KEYS: AttrKey[] = ['goalkeeping', 'composure', 'physical', 'passing', 'pace', 'vision'];

export function allocatable(role: Role): AttrKey[] {
  return role === 'GK' ? GK_KEYS : ATTR_KEYS.filter((k) => k !== 'goalkeeping');
}

// What height and build add or take away, so the creator can show it.
// Tall players are stronger, win more in the air (defending) and cover
// more of the goal; short players are quicker and more nimble.
export function bodyEffects(body: Body, role: Role): Partial<Record<AttrKey, number>> {
  const d = (body.heightCm - 180) / 10;
  const fx: Partial<Record<AttrKey, number>> = {
    physical: 3 * d,
    pace: -2 * d,
    dribbling: -1.5 * d,
    defending: role === 'GK' ? 0 : 1 * d,
    goalkeeping: role === 'GK' ? 2.5 * d : 0,
  };
  const add = (k: AttrKey, v: number) => (fx[k] = (fx[k] ?? 0) + v);
  if (body.build === 'lean') {
    add('pace', 3);
    add('dribbling', 2);
    add('physical', -4);
  } else if (body.build === 'stocky') {
    add('physical', 4);
    add('pace', -3);
    add('dribbling', -1);
  } else {
    add('pace', 1);
    add('physical', 1);
  }
  return fx;
}

// Role-shaped attributes for a 16-year-old before any points are spent.
export function baseTemplate(role: Role, body: Body): Attributes {
  const w = ROLES[role].weights;
  const out = {} as Attributes;
  for (const k of ATTR_KEYS) {
    if (k === 'goalkeeping') out[k] = role === 'GK' ? 39 : 12;
    else out[k] = 30 + Math.min(12, (w[k] ?? 0) * 40);
  }
  const fx = bodyEffects(body, role);
  for (const k of ATTR_KEYS) out[k] += fx[k] ?? 0;
  for (const k of ATTR_KEYS) out[k] = Math.round(clamp(out[k], 5, 60));
  return out;
}

export function weakFootCost(weakFoot: number): number {
  return Math.max(0, weakFoot - FREE_WEAK_FOOT) * WEAK_FOOT_COST;
}

export function pointsSpent(alloc: Allocation, weakFoot: number): number {
  return Object.values(alloc).reduce((s, v) => s + (v ?? 0), 0) + weakFootCost(weakFoot);
}

export function validateAllocation(role: Role, alloc: Allocation, weakFoot: number): string | null {
  const keys = allocatable(role);
  for (const [k, v] of Object.entries(alloc)) {
    if (!keys.includes(k as AttrKey) && v) return `${k} cannot take points for this position.`;
    if ((v ?? 0) < 0 || (v ?? 0) > MAX_PER_ATTR) return `At most ${MAX_PER_ATTR} points per attribute.`;
  }
  if (weakFoot < 1 || weakFoot > 5) return 'Weak foot is 1 to 5 stars.';
  if (pointsSpent(alloc, weakFoot) > STAT_POINTS) return `Only ${STAT_POINTS} points to spend.`;
  return null;
}

export function applyAllocation(role: Role, body: Body, alloc: Allocation, weakFoot: number): Attributes {
  const err = validateAllocation(role, alloc, weakFoot);
  if (err) throw new Error(err);
  const out = baseTemplate(role, body);
  for (const k of allocatable(role)) out[k] += alloc[k] ?? 0;
  return out;
}

// Spreads a pool over attributes in proportion to weights, capped per
// attribute; leftovers go to the next most important attribute.
export function autoAllocate(role: Role, weights: Partial<Record<AttrKey, number>>, pool: number): Allocation {
  const keys = allocatable(role).filter((k) => (weights[k] ?? 0) > 0);
  const total = keys.reduce((s, k) => s + (weights[k] ?? 0), 0);
  const out: Allocation = {};
  if (!keys.length || pool <= 0) return out;
  let left = pool;
  const shares = keys
    .map((k) => ({ k, exact: (pool * (weights[k] ?? 0)) / total }))
    .sort((a, b) => (weights[b.k] ?? 0) - (weights[a.k] ?? 0));
  for (const s of shares) {
    const v = Math.min(MAX_PER_ATTR, Math.floor(s.exact), left);
    out[s.k] = v;
    left -= v;
  }
  // Hand out what is left one point at a time, most important first.
  let guard = 0;
  while (left > 0 && guard++ < 200) {
    const next = shares.find((s) => (out[s.k] ?? 0) < MAX_PER_ATTR);
    if (!next) break;
    for (const s of shares) {
      if (left <= 0) break;
      if ((out[s.k] ?? 0) < MAX_PER_ATTR) {
        out[s.k] = (out[s.k] ?? 0) + 1;
        left--;
      }
    }
  }
  return out;
}

const P = (id: string, label: string, description: string, weights: Partial<Record<AttrKey, number>>): StylePreset => ({ id, label, description, weights });

export const STYLE_PRESETS: Record<Role, StylePreset[]> = {
  GK: [
    P('shot-stopper', 'Shot stopper', 'Lightning reflexes on the line.', { goalkeeping: 5, composure: 3, physical: 1 }),
    P('sweeper-keeper', 'Sweeper keeper', 'Starts attacks and rushes out.', { goalkeeping: 4, passing: 3, pace: 2, vision: 1 }),
  ],
  CB: [
    P('stopper', 'Stopper', 'Wins every duel and header.', { defending: 5, physical: 4, composure: 1 }),
    P('ball-playing', 'Ball-playing', 'Calm in possession, breaks lines.', { defending: 4, passing: 3, composure: 2, vision: 1 }),
  ],
  LB: [P('overlapping', 'Overlapping', 'Bombs forward all game.', { pace: 4, passing: 3, dribbling: 2, defending: 1 }), P('defensive-fb', 'Defensive full-back', 'Locks down the flank.', { defending: 5, physical: 3, pace: 2 })],
  RB: [P('overlapping', 'Overlapping', 'Bombs forward all game.', { pace: 4, passing: 3, dribbling: 2, defending: 1 }), P('defensive-fb', 'Defensive full-back', 'Locks down the flank.', { defending: 5, physical: 3, pace: 2 })],
  LWB: [P('wing-back', 'Attacking wing-back', 'Lives on the touchline.', { pace: 4, dribbling: 3, passing: 3 }), P('two-way', 'Two-way runner', 'Up and down for 90 minutes.', { physical: 4, defending: 3, pace: 3 })],
  RWB: [P('wing-back', 'Attacking wing-back', 'Lives on the touchline.', { pace: 4, dribbling: 3, passing: 3 }), P('two-way', 'Two-way runner', 'Up and down for 90 minutes.', { physical: 4, defending: 3, pace: 3 })],
  CDM: [P('anchor', 'Anchor', 'Shields the back four.', { defending: 5, physical: 3, composure: 2 }), P('regista', 'Deep playmaker', 'Dictates from deep.', { passing: 4, vision: 3, composure: 2, defending: 1 })],
  CM: [P('box-to-box', 'Box-to-box', 'Everywhere at once.', { physical: 3, passing: 3, defending: 2, shooting: 2 }), P('deep-lying', 'Deep-lying playmaker', 'Sees passes nobody else does.', { passing: 4, vision: 4, composure: 2 })],
  CAM: [P('playmaker', 'Playmaker', 'The team runs through you.', { vision: 4, passing: 4, dribbling: 2 }), P('shadow-striker', 'Shadow striker', 'Arrives late in the box.', { shooting: 4, dribbling: 3, composure: 3 })],
  LM: [P('wide-mid', 'Wide playmaker', 'Crosses and cut-backs.', { passing: 4, dribbling: 3, pace: 3 }), P('workhorse', 'Workhorse', 'Covers every blade of grass.', { physical: 4, pace: 3, defending: 3 })],
  RM: [P('wide-mid', 'Wide playmaker', 'Crosses and cut-backs.', { passing: 4, dribbling: 3, pace: 3 }), P('workhorse', 'Workhorse', 'Covers every blade of grass.', { physical: 4, pace: 3, defending: 3 })],
  LW: [P('speedster', 'Speedster', 'Burns full-backs for fun.', { pace: 5, dribbling: 4, shooting: 1 }), P('inside-forward', 'Inside forward', 'Cuts in and shoots.', { shooting: 4, dribbling: 4, composure: 2 })],
  RW: [P('speedster', 'Speedster', 'Burns full-backs for fun.', { pace: 5, dribbling: 4, shooting: 1 }), P('inside-forward', 'Inside forward', 'Cuts in and shoots.', { shooting: 4, dribbling: 4, composure: 2 })],
  CF: [P('false-nine', 'False nine', 'Drops deep and links play.', { vision: 3, passing: 3, dribbling: 3, shooting: 1 }), P('complete-forward', 'Complete forward', 'Does a bit of everything.', { shooting: 3, dribbling: 3, physical: 2, pace: 2 })],
  ST: [
    P('poacher', 'Poacher', 'Lives in the six-yard box.', { shooting: 5, composure: 4, pace: 1 }),
    P('target-man', 'Target man', 'Holds it up and wins headers.', { physical: 5, shooting: 4, composure: 1 }),
    P('complete-forward', 'Complete forward', 'Does a bit of everything.', { shooting: 3, pace: 3, dribbling: 2, physical: 2 }),
  ],
};

export interface Celebration {
  id: string;
  label: string;
  text: string;
}

export const CELEBRATIONS: Celebration[] = [
  { id: 'knee-slide', label: 'Knee slide', text: 'races away and knee-slides to the corner flag!' },
  { id: 'backflip', label: 'Backflip', text: 'pulls off a backflip in front of the fans!' },
  { id: 'shush', label: 'Shush the crowd', text: 'puts a finger to his lips and shushes the away end.' },
  { id: 'heart', label: 'Heart hands', text: 'makes a heart with his hands for the fans.' },
  { id: 'robot', label: 'The robot', text: 'breaks into the robot by the corner flag.' },
  { id: 'calm', label: 'Ice cold', text: 'just stands there, arms folded. Ice cold.' },
];

export function celebrationText(id: string): string {
  return (CELEBRATIONS.find((c) => c.id === id) ?? CELEBRATIONS[0]).text;
}
