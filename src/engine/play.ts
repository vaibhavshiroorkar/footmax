import { Club, Player, Position, World } from './types';
import { Rng, clamp } from './rng';
import { ROLES, isRole } from './roles';

// What the live pitch shows: real moves built from what the sim decided
// this minute. The sim picks who shoots and whether it goes in; this file
// only lays out the passes that led there. It draws from its own random
// stream, so watching a match never changes its result.

export type PlayAct = 'start' | 'pass' | 'run' | 'shot' | 'goal' | 'save' | 'miss' | 'win' | 'moment';

export interface PlayStep {
  // Ball position: x across (0..1), y from the home goal (0) to the away goal (1).
  x: number;
  y: number;
  // Who has the ball after this step. Null while it is in the air or the net.
  carrier: string | null;
  side: 'home' | 'away';
  act: PlayAct;
}

export interface Spot {
  // From the side's own goal (0) to the opponent's (1).
  depth: number;
  // From the side's left (0) to its right (1), facing the opponent's goal.
  lat: number;
}

const ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

function spotX(p: Player): number {
  return p.role && isRole(p.role) ? ROLES[p.role].spot.x : 0.5;
}

// Each player's place in the team's shape, from its formation. Within a
// line, players with a known role stand on their side (left-back left).
export function formationSpots(world: World, team: Club, ids: string[]): Record<string, Spot> {
  const players = ids.map((id) => world.players[id]).filter(Boolean) as Player[];
  const sorted = [...players].sort((a, b) => ORDER.indexOf(a.position) - ORDER.indexOf(b.position));
  const keeper = sorted.find((p) => p.position === 'GK');
  const outfield = sorted.filter((p) => p !== keeper);
  const rows = team.formation.split('-').map(Number);
  const out: Record<string, Spot> = {};
  if (keeper) out[keeper.id] = { depth: 0.04, lat: 0.5 };
  let i = 0;
  rows.forEach((n, r) => {
    const line = outfield.slice(i, i + n).sort((a, b) => spotX(a) - spotX(b));
    const depth = 0.2 + (0.56 * r) / Math.max(1, rows.length - 1);
    line.forEach((p, k) => (out[p.id] = { depth, lat: (k + 1) / (line.length + 1) }));
    i += n;
  });
  // Anyone left over (a red card, a forced change) slots into midfield.
  for (; i < outfield.length; i++) out[outfield[i].id] = { depth: 0.5, lat: 0.5 };
  return out;
}

// Side-relative spot to pitch coordinates. Home attacks up the pitch.
export function toPitch(side: 'home' | 'away', s: Spot): { x: number; y: number } {
  return side === 'home' ? { x: s.lat, y: s.depth } : { x: 1 - s.lat, y: 1 - s.depth };
}

// Preferred shirt numbers by broad position, most wanted first.
const PREFERRED: Record<Position, number[]> = {
  GK: [1, 13, 12, 23, 31],
  DEF: [2, 3, 4, 5, 6, 15, 14, 22, 24, 26, 12],
  MID: [8, 6, 10, 7, 14, 16, 17, 18, 20, 21],
  FWD: [9, 11, 7, 10, 19, 20, 17, 27, 29],
};

// Squad numbers for one side. Club players keep their number between
// matches (stored on the player); national teams number their squad fresh.
export function assignNumbers(world: World, ids: string[], keep: boolean, fixed: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  const used = new Set<number>();
  for (const [id, n] of Object.entries(fixed)) {
    if (ids.includes(id)) {
      out[id] = n;
      used.add(n);
    }
  }
  if (keep) {
    for (const id of ids) {
      const n = world.players[id]?.shirt;
      if (out[id] === undefined && n && !used.has(n)) {
        out[id] = n;
        used.add(n);
      }
    }
  }
  for (const id of ids) {
    if (out[id] !== undefined) continue;
    const p = world.players[id];
    const want = PREFERRED[p?.position ?? 'MID'];
    let n = want.find((x) => !used.has(x)) ?? 0;
    for (let k = 2; !n; k++) if (!used.has(k)) n = k;
    out[id] = n;
    used.add(n);
    if (keep && p) p.shirt = n;
  }
  return out;
}

export interface PlaySide {
  key: 'home' | 'away';
  team: Club;
  ids: string[];
  keeperId?: string;
}

export interface PlayOutcome {
  // Shot result, or 'moment' when the user is about to play one, or null
  // for a minute with no chance.
  result: 'goal' | 'save' | 'miss' | 'moment' | null;
  shooterId?: string;
  assistId?: string;
}

// One minute of play for the side in possession. prev is whoever had the
// ball at the end of the last move, so the next one carries on from there.
export function buildPlay(world: World, seed: number, att: PlaySide, def: PlaySide, start: { x: number; y: number }, outcome: PlayOutcome, prev?: string | null): PlayStep[] {
  const rng = new Rng(seed >>> 0 || 1);
  const spots = formationSpots(world, att.team, att.ids);
  const fwd = att.key === 'home' ? 1 : -1;
  const depthOf = (y: number) => (att.key === 'home' ? y : 1 - y);
  // The team moves up as a block, so a receiver stands a little ahead of
  // his spot when the ball is high up the pitch.
  const at = (id: string, ballDepth: number): { x: number; y: number } => {
    const s = spots[id] ?? { depth: 0.5, lat: 0.5 };
    const depth = clamp(s.depth + (ballDepth - 0.45) * 0.3 + rng.range(-0.04, 0.06), 0.03, 0.92);
    const lat = clamp(s.lat + rng.range(-0.07, 0.07), 0.06, 0.94);
    return toPitch(att.key, { depth, lat });
  };
  const steps: PlayStep[] = [];
  const add = (pos: { x: number; y: number }, carrier: string | null, act: PlayAct, side = att.key) => steps.push({ x: clamp(pos.x, 0.03, 0.97), y: clamp(pos.y, 0, 1), carrier, side, act });
  const here = () => steps[steps.length - 1];
  const nearest = (pos: { x: number; y: number }, ids: string[]) =>
    [...ids].sort((p, q) => {
      const a = toPitch(att.key, spots[p] ?? { depth: 0.5, lat: 0.5 });
      const b = toPitch(att.key, spots[q] ?? { depth: 0.5, lat: 0.5 });
      return Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y);
    })[0];
  // Passes mostly go forward, a short way: a defender finds a midfielder,
  // a midfielder a forward. A long ball over the top is rarer.
  const nextFrom = (holder: string, not: string[]): string | undefined => {
    const from = spots[holder]?.depth ?? 0.4;
    const pool = att.ids.filter((id) => id !== holder && !not.includes(id) && spots[id] && world.players[id]?.position !== 'GK');
    if (!pool.length) return undefined;
    return rng.weighted(pool, pool.map((id) => Math.exp(-((spots[id].depth - from - 0.18) ** 2) / 0.02) + 0.04));
  };

  const outfield = att.ids.filter((id) => world.players[id]?.position !== 'GK');
  let holder: string;
  if (prev && att.ids.includes(prev)) {
    holder = prev;
    add(start, holder, 'start');
  } else {
    // The ball changes hands: whoever is closest picks it up.
    holder = nearest(start, outfield.length ? outfield : att.ids);
    if (!holder) return [];
    add(start, holder, prev ? 'win' : 'start');
  }
  if (world.players[holder]?.position !== 'GK') add({ x: here().x + rng.range(-0.06, 0.06), y: here().y + fwd * rng.range(0.03, 0.08) }, holder, 'run');

  const shooter = outcome.shooterId;
  // Quiet minutes are short; chances get the full move.
  const buildUp = outcome.result ? rng.int(1, 2) : rng.int(0, 1);
  for (let i = 0; i < buildUp; i++) {
    const next = nextFrom(holder, shooter ? [shooter] : []);
    if (!next) break;
    add(at(next, depthOf(here().y)), next, 'pass');
    holder = next;
  }

  if (!outcome.result || !shooter) {
    // No chance this minute: the move breaks down and the other side wins it.
    if (rng.chance(0.6)) {
      const winner = def.ids.length ? rng.pick(def.ids.filter((id) => world.players[id]?.position !== 'GK').concat(def.ids).slice(0, 10)) : undefined;
      if (winner) add({ x: here().x + rng.range(-0.06, 0.06), y: here().y + fwd * rng.range(0.03, 0.07) }, winner, 'win', def.key);
    }
    return steps;
  }

  const assist = outcome.assistId;
  if (assist && assist !== holder && spots[assist]) {
    add(at(assist, Math.max(0.6, depthOf(here().y))), assist, 'pass');
    holder = assist;
  }
  // The shooter arrives in the box: either the pass finds him, or he runs it in.
  const lat = clamp((spots[shooter]?.lat ?? 0.5) * 0.6 + 0.2 + rng.range(-0.08, 0.08), 0.15, 0.85);
  add(toPitch(att.key, { depth: rng.range(0.8, 0.89), lat }), shooter, holder === shooter ? 'run' : 'pass');
  if (outcome.result === 'moment') return steps;
  addFinish(steps, rng, att.key, shooter, outcome.result, def.keeperId);
  return steps;
}

// The end of a move: into the net, into the keeper's hands, or wide.
export function addFinish(steps: PlayStep[], rng: Rng, side: 'home' | 'away', shooterId: string, result: 'goal' | 'save' | 'miss', keeperId?: string): void {
  const goalY = side === 'home' ? 1 : 0;
  const inward = side === 'home' ? -1 : 1;
  const last = steps[steps.length - 1];
  if (last && last.carrier !== shooterId) steps.push({ x: 0.5 + rng.range(-0.15, 0.15), y: goalY + inward * rng.range(0.1, 0.16), carrier: shooterId, side, act: 'run' });
  const keeperSide = side === 'home' ? 'away' : 'home';
  if (result === 'goal') {
    steps.push({ x: 0.5 + rng.range(-0.08, 0.08), y: goalY - inward * 0.005, carrier: null, side, act: 'goal' });
  } else if (result === 'save') {
    steps.push({ x: 0.5 + rng.range(-0.06, 0.06), y: goalY + inward * 0.035, carrier: keeperId ?? null, side: keeperSide, act: 'save' });
  } else {
    const wide = rng.chance(0.5) ? rng.range(0.28, 0.38) : rng.range(0.62, 0.72);
    steps.push({ x: wide, y: goalY - inward * 0.01, carrier: null, side, act: 'miss' });
  }
}

// A visual seed for a minute, drawn without touching the match's own stream.
export function playSeed(rngState: number, minute: number, events: number): number {
  return ((rngState ^ 0x5bd1e995) + minute * 7919 + events * 104729) >>> 0;
}

export function stepCount(steps: PlayStep[] | undefined): number {
  return steps?.length ?? 0;
}
