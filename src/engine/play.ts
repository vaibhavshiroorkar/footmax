import { Club, Formation, Player, Position, World } from './types';
import { Pattern, ShotFacts } from './shotText';
import { Rng, clamp } from './rng';
import { FORMATION_SLOTS, ROLES, ROLE_NEIGHBOURS, Role, isRole } from './roles';
import { overall } from './player';

// What the live pitch shows: real moves built from what the sim decided
// this minute. The sim picks who shoots and whether it goes in; this file
// lays out the football that led there (build-up, through balls, crosses,
// tackles, fouls, throw-ins, corners) and the pitch then animates it. It
// draws from its own random stream, so watching never changes a result.

export type PlayAct =
  | 'start'
  | 'pass'
  | 'cross'
  | 'run'
  | 'goal'
  | 'save'
  | 'miss'
  | 'win'
  | 'tackle'
  | 'foul'
  | 'out'
  | 'offside'
  | 'moment'
  // The referee shows a card to carrier; a sent-off player walks.
  | 'card'
  // carrier goes down injured.
  | 'injury'
  // carrier and other square up (see fight).
  | 'brawl';

// How play restarts after a stoppage.
export type Restart = 'kickoff' | 'throw' | 'corner' | 'goalkick' | 'freekick' | 'penalty';

export interface PlayStep {
  // Ball position: x across (0..1), y from the home goal (0) to the away goal (1).
  x: number;
  y: number;
  // Who has (or wins, or plays) the ball at this step. Null when it is
  // dead, in the net, or rolling out.
  carrier: string | null;
  // The side the step belongs to. For a stoppage, the side that restarts.
  side: 'home' | 'away';
  act: PlayAct;
  // Second player involved: the one tackled, fouled or caught offside.
  other?: string;
  // A stoppage at the end of a move: how the next one starts.
  restart?: Restart;
  // Shots with the head, after a cross.
  header?: boolean;
  // Where the user aimed a shot across the goal, from the shooter's view:
  // 0 is his left post, 1 his right; outside that is wide.
  aim?: number;
  // A shot that hit this defender (one the shot game showed in the way).
  blocker?: string;
  // The side that took a shot. step.side can name either team (see
  // defendingSide), so a shot says who struck it.
  shotBy?: 'home' | 'away';
  // A save pushed back into play.
  parried?: boolean;
  // A shot off the woodwork, back into play.
  frame?: 'post' | 'bar';
  // How a shot was struck: driven, curled or low (see ShotShape).
  shape?: 'driven' | 'curl' | 'low';
  // A miss inside the posts that goes over the bar.
  over?: boolean;
  // A goal VAR checks before it counts, and what it decides.
  var?: 'stands' | 'overturned';
  varReason?: string;
  // Ruled out on the spot with no review.
  call?: 'flag' | 'foul';
  // A foul the referee lets go, because the attack carries on.
  advantage?: boolean;
  // A foul that was a handball.
  handball?: boolean;
  // A 'brawl' step: how it ended. 'one' sends off carrier only.
  fight?: 'calm' | 'booked' | 'one' | 'both';
  // A 'card' step: which one.
  card?: 'yellow' | 'red';
}

export interface Spot {
  // From the side's own goal (0) to the opponent's (1).
  depth: number;
  // From the side's left (0) to its right (1), facing the opponent's goal.
  lat: number;
}

export interface Slot extends Spot {
  // The named position the player fills in this formation.
  role: Role;
}

// How well a player suits a slot: his own role first, then a learned second
// role, then a neighbouring role, then anything in the same line.
function fit(p: Player, role: Role): number {
  if (p.role === role) return 4;
  if (p.secondaryRole === role) return 3;
  if (p.role && isRole(p.role) && ROLE_NEIGHBOURS[p.role].includes(role)) return 2;
  if (ROLES[role].broad === p.position) return 1;
  return 0;
}

// Puts each player in a named slot of the team's formation (LB, CB, CB, RB,
// CDM...), the best-suited player first, and gives the slot's place on the
// pitch. Slots in a line are spread evenly from left to right; holding
// midfielders sit a little deeper and number tens a little higher.
export function assignSlots(world: World, team: Club, ids: string[]): Record<string, Slot> {
  const players = ids.map((id) => world.players[id]).filter(Boolean) as Player[];
  const keeper = players.find((p) => p.position === 'GK') ?? null;
  const outfield = players.filter((p) => p !== keeper);
  const rows = FORMATION_SLOTS[team.formation as Formation] ?? FORMATION_SLOTS['4-3-3'];
  const slots = rows.flatMap((row, r) =>
    row.map((role, k) => {
      const depth = 0.2 + (0.56 * r) / Math.max(1, rows.length - 1) + (role === 'CDM' ? -0.05 : role === 'CAM' ? 0.05 : 0);
      return { role, depth, lat: (k + 1) / (row.length + 1) };
    }),
  );
  const out: Record<string, Slot> = {};
  if (keeper) out[keeper.id] = { role: 'GK', depth: 0.04, lat: 0.5 };
  const free = new Set(outfield);
  const open = new Set(slots.map((_, i) => i));
  // Best fit first, so a natural left-back takes LB before anyone else.
  for (const need of [4, 3, 2, 1, 0]) {
    for (const i of [...open]) {
      const slot = slots[i];
      const pick = [...free].filter((p) => fit(p, slot.role) >= need).sort((x, y) => overall({ ...y, role: slot.role }) - overall({ ...x, role: slot.role }))[0];
      if (!pick) continue;
      out[pick.id] = slot;
      free.delete(pick);
      open.delete(i);
    }
  }
  // Anyone left over (more players than slots) holds midfield.
  for (const p of free) out[p.id] = { role: p.role && isRole(p.role) ? p.role : 'CM', depth: 0.5, lat: 0.5 };
  return out;
}

// Each player's place in the team's shape. See assignSlots.
export function formationSpots(world: World, team: Club, ids: string[]): Record<string, Spot> {
  return assignSlots(world, team, ids);
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
  // The chance comes from a cross (a header, or a header moment).
  cross?: boolean;
  // How the chance was made and what the shot did, when the match decided
  // it (see ShotFacts): the pitch then shows exactly what the feed says.
  pattern?: Pattern;
  facts?: ShotFacts;
}

// How the move starts: a dead ball to restart, or play carrying on.
export interface PlayStart {
  x: number;
  y: number;
  // Whoever had the ball at the end of the last move.
  prev?: string | null;
  restart?: Restart;
  // The side that takes the restart.
  restartSide?: 'home' | 'away';
}

// Everyone's place on the pitch, as shares of its length and width.
export type Positions = Record<string, { x: number; y: number }>;

// One minute of play for the side in possession.
// live: where everyone really is on the pitch right now, when it is watched,
// so the man who wins the ball is the man who is near it.
export function buildPlay(world: World, seed: number, att: PlaySide, def: PlaySide, from: PlayStart, outcome: PlayOutcome, live?: Positions): PlayStep[] {
  const rng = new Rng(seed >>> 0 || 1);
  const spots = formationSpots(world, att.team, att.ids);
  const defSpots = formationSpots(world, def.team, def.ids);
  const fwd = att.key === 'home' ? 1 : -1;
  const depthOf = (y: number) => (att.key === 'home' ? y : 1 - y);
  const pos = (depth: number, lat: number) => toPitch(att.key, { depth: clamp(depth, 0.02, 0.98), lat: clamp(lat, 0.03, 0.97) });
  const role = (id: string) => world.players[id]?.position;
  const outfield = att.ids.filter((id) => role(id) !== 'GK');
  const defOutfield = def.ids.filter((id) => role(id) !== 'GK');
  // A receiver stands a little ahead of his spot when the ball is high up.
  const at = (id: string, ballDepth: number) => {
    const s = spots[id] ?? { depth: 0.5, lat: 0.5 };
    return pos(s.depth + (ballDepth - 0.45) * 0.3 + rng.range(-0.04, 0.06), s.lat + rng.range(-0.07, 0.07));
  };
  const steps: PlayStep[] = [];
  const add = (p: { x: number; y: number }, carrier: string | null, act: PlayAct, extra: Partial<PlayStep> = {}, side = att.key) =>
    steps.push({ x: clamp(p.x, -0.02, 1.02), y: clamp(p.y, -0.02, 1.02), carrier, side, act, ...extra });
  const here = () => steps[steps.length - 1];
  const nearest = (p: { x: number; y: number }, ids: string[], key: 'home' | 'away') => {
    const sp = key === att.key ? spots : defSpots;
    return [...ids].sort((a, b) => {
      const pa = live?.[a] ?? toPitch(key, sp[a] ?? { depth: 0.5, lat: 0.5 });
      const pb = live?.[b] ?? toPitch(key, sp[b] ?? { depth: 0.5, lat: 0.5 });
      return Math.hypot(pa.x - p.x, pa.y - p.y) - Math.hypot(pb.x - p.x, pb.y - p.y);
    })[0];
  };
  // Passes mostly go forward, a short way.
  const nextFrom = (holder: string, not: string[]): string | undefined => {
    const fromDepth = spots[holder]?.depth ?? 0.4;
    const pool = outfield.filter((id) => id !== holder && !not.includes(id) && spots[id]);
    if (!pool.length) return undefined;
    return rng.weighted(pool, pool.map((id) => Math.exp(-((spots[id].depth - fromDepth - 0.18) ** 2) / 0.02) + 0.04));
  };

  // --- Who starts it ---
  let holder: string | undefined;
  if (from.restart && from.restartSide && from.restartSide !== att.key) {
    // The other side restarts and plays it, then loses it.
    const taker = from.restart === 'goalkick' && def.keeperId ? def.keeperId : nearest(from, defOutfield.length ? defOutfield : def.ids, def.key);
    if (taker) add(from, taker, 'start', { restart: from.restart }, def.key);
    let lostBy = taker;
    if (from.restart === 'kickoff' && taker) {
      // Rolled back to a midfielder, who then gives it away.
      const back = defOutfield.filter((id) => id !== taker && world.players[id]?.position === 'MID');
      const mate = back.length ? rng.pick(back) : undefined;
      if (mate) {
        add(toPitch(def.key, { depth: rng.range(0.32, 0.4), lat: clamp(defSpots[mate]?.lat ?? 0.5, 0.25, 0.75) }), mate, 'pass', {}, def.key);
        lostBy = mate;
      }
    }
    holder = nearest(here(), outfield.length ? outfield : att.ids, att.key);
    if (!holder) return steps;
    add({ x: clamp(here().x + rng.range(-0.06, 0.06), 0.05, 0.95), y: clamp(here().y - fwd * rng.range(0.04, 0.1), 0.08, 0.92) }, holder, 'win', { other: lostBy });
  } else if (from.restart) {
    if (from.restart === 'goalkick' && att.keeperId) holder = att.keeperId;
    else if (from.restart === 'corner') {
      // The best crosser takes corners.
      holder = [...outfield].sort((a, b) => (world.players[b]?.attrs.passing ?? 0) - (world.players[a]?.attrs.passing ?? 0))[0];
    } else holder = nearest(from, outfield.length ? outfield : att.ids, att.key);
    if (!holder) return steps;
    add(from, holder, 'start', { restart: from.restart });
    if (from.restart === 'kickoff') {
      const back = outfield.filter((id) => id !== holder && world.players[id]?.position === 'MID');
      const mate = back.length ? rng.pick(back) : undefined;
      if (mate) {
        add(pos(rng.range(0.32, 0.4), clamp(spots[mate]?.lat ?? 0.5, 0.25, 0.75)), mate, 'pass');
        holder = mate;
      }
    }
    if (from.restart === 'corner' && !(outcome.result && outcome.shooterId)) {
      // A corner with no chance from it: swung in and headed clear.
      const target = outfield.filter((id) => id !== holder && world.players[id]?.position !== 'GK');
      const aimAt = target.length ? rng.pick(target) : holder;
      add(pos(rng.range(0.88, 0.93), rng.range(0.38, 0.62)), aimAt, 'cross', { header: true });
      const clearer = defOutfield.length ? nearest(here(), defOutfield, def.key) : undefined;
      if (clearer) {
        add({ x: clamp(here().x + rng.range(-0.2, 0.2), 0.1, 0.9), y: here().y - fwd * rng.range(0.22, 0.32) }, clearer, 'win', { other: aimAt }, def.key);
        return steps;
      }
    }
  } else if (from.prev && att.ids.includes(from.prev)) {
    holder = from.prev;
    add(from, holder, 'start');
  } else {
    // The ball changes hands: whoever is closest picks it up.
    holder = nearest(from, outfield.length ? outfield : att.ids, att.key);
    if (!holder) return steps;
    add(from, holder, from.prev ? 'win' : 'start', from.prev ? { other: from.prev } : {});
  }

  const shooter = outcome.shooterId;
  const assist = outcome.assistId && outcome.assistId !== shooter ? outcome.assistId : undefined;

  // --- A chance ---
  if (outcome.result && shooter) {
    const fromCorner = from.restart === 'corner' && from.restartSide === att.key;
    const pattern = outcome.pattern
      ? outcome.pattern
      : fromCorner
      ? 'corner'
      : outcome.cross
        ? 'cross'
        : rng.weighted(assist ? ['through', 'cross', 'cutback', 'build'] : ['solo', 'longshot', 'build'], assist ? [3, 2, 2, 2] : [3, 2, 2]);
    if (pattern !== 'corner' && role(holder) !== 'GK') add({ x: here().x + rng.range(-0.05, 0.05), y: here().y + fwd * rng.range(0.03, 0.07) }, holder, 'run');
    // One or two passes to bring it forward first.
    if (pattern !== 'corner') {
      const n = depthOf(here().y) < 0.45 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const next = nextFrom(holder, [shooter, assist ?? '']);
        if (!next) break;
        add(at(next, depthOf(here().y)), next, 'pass');
        holder = next;
      }
    }
    const boxLat = () => clamp(0.5 + rng.range(-0.14, 0.14), 0.3, 0.7);
    let header = false;
    if (pattern === 'corner' || pattern === 'cross') {
      const wide = here().x < 0.5 === (att.key === 'home') ? 0.08 : 0.92;
      const crosser = pattern === 'corner' ? holder : assist ?? holder;
      if (pattern === 'cross') {
        if (crosser !== holder) add(pos(rng.range(0.66, 0.74), wide), crosser, 'pass');
        add(pos(rng.range(0.86, 0.92), wide + (wide < 0.5 ? 0.04 : -0.04)), crosser, 'run');
      }
      header = outcome.facts ? !!outcome.facts.header : outcome.cross || rng.chance(0.65);
      add(pos(rng.range(0.88, 0.94), boxLat()), shooter, 'cross', { header });
    } else if (pattern === 'through') {
      const passer = assist!;
      if (passer !== holder) add(at(passer, depthOf(here().y)), passer, 'pass');
      add(pos(rng.range(0.8, 0.86), clamp((spots[shooter]?.lat ?? 0.5) * 0.7 + 0.15, 0.2, 0.8)), shooter, 'pass');
      add(pos(rng.range(0.86, 0.9), boxLat()), shooter, 'run');
    } else if (pattern === 'cutback') {
      const wide = rng.chance(0.5) ? 0.14 : 0.86;
      const winger = assist!;
      if (winger !== holder) add(pos(rng.range(0.7, 0.78), wide), winger, 'pass');
      add(pos(rng.range(0.9, 0.95), wide + (wide < 0.5 ? 0.06 : -0.06)), winger, 'run');
      add(pos(rng.range(0.8, 0.85), boxLat()), shooter, 'pass');
    } else if (pattern === 'longshot') {
      add(pos(rng.range(0.68, 0.74), boxLat()), shooter, shooter === holder ? 'run' : 'pass');
    } else if (pattern === 'solo') {
      if (shooter !== holder) add(pos(rng.range(0.58, 0.66), spots[shooter]?.lat ?? 0.5), shooter, 'pass');
      add(pos(rng.range(0.74, 0.8), boxLat()), shooter, 'run');
      add(pos(rng.range(0.84, 0.88), boxLat()), shooter, 'run');
    } else {
      if (assist && assist !== holder) add(at(assist, Math.max(0.6, depthOf(here().y))), assist, 'pass');
      add(pos(rng.range(0.8, 0.88), boxLat()), shooter, shooter === here().carrier ? 'run' : 'pass');
    }
    if (outcome.result === 'moment') {
      add({ x: here().x, y: here().y }, shooter, 'moment', { header });
      return steps;
    }
    addFinish(steps, rng, att.key, shooter, outcome.result, def.keeperId, header, outcome.facts);
    return steps;
  }

  // --- A quiet minute: a pass or two, then the move ends somehow. Kept
  // short so the chances get the screen time. ---
  if (role(holder) !== 'GK' && rng.chance(0.4)) add({ x: here().x + rng.range(-0.06, 0.06), y: here().y + fwd * rng.range(0.03, 0.08) }, holder, 'run');
  const passes = rng.chance(0.7) ? 1 : 2;
  for (let i = 0; i < passes; i++) {
    const next = nextFrom(holder, []);
    if (!next) break;
    add(at(next, depthOf(here().y)), next, 'pass');
    holder = next;
  }
  const depth = depthOf(here().y);
  const ending = rng.weighted(['keep', 'intercept', 'tackle', 'foul', 'out', 'offside'], [3, 3, 2, 0.9, 1.3, depth > 0.5 ? 0.7 : 0]);
  const defender = defOutfield.length ? nearest(here(), defOutfield, def.key) : undefined;
  const near = () => ({ x: here().x + rng.range(-0.05, 0.05), y: here().y + fwd * rng.range(0.02, 0.06) });
  if (ending === 'intercept' && defender) {
    const target = nextFrom(holder, []);
    // A pass that never arrives: cut out on the way.
    const to = target ? at(target, depth) : near();
    add({ x: (here().x + to.x) / 2, y: (here().y + to.y) / 2 }, defender, 'win', { other: holder }, def.key);
  } else if (ending === 'tackle' && defender) {
    add(near(), defender, 'tackle', { other: holder }, def.key);
  } else if (ending === 'foul' && defender) {
    // In their half with the attack still on, the referee waves play on.
    if (depth > 0.45 && rng.chance(0.3)) add(here(), defender, 'foul', { other: holder, advantage: true }, att.key);
    else add(near(), defender, 'foul', { other: holder, restart: 'freekick', handball: rng.chance(0.08) || undefined }, att.key);
  } else if (ending === 'offside') {
    const runner = outfield.filter((id) => role(id) === 'FWD')[0] ?? outfield[0];
    if (runner) add(pos(rng.range(0.84, 0.9), clamp((spots[runner]?.lat ?? 0.5) + rng.range(-0.1, 0.1), 0.2, 0.8)), null, 'offside', { other: runner, restart: 'freekick' }, def.key);
  } else if (ending === 'out') {
    // Over the touchline for a throw, or behind for a corner or goal kick.
    if (depth > 0.8 && rng.chance(0.6)) {
      const corner = rng.chance(0.55);
      add(pos(1.01, here().x < 0.5 === (att.key === 'home') ? 0.3 : 0.7), null, 'out', { restart: corner ? 'corner' : 'goalkick' }, corner ? att.key : def.key);
    } else {
      const left = rng.chance(0.5);
      add({ x: left ? -0.01 : 1.01, y: clamp(here().y + fwd * rng.range(0.02, 0.1), 0.05, 0.95) }, null, 'out', { restart: 'throw' }, rng.chance(0.55) ? def.key : att.key);
    }
  }
  return steps;
}

// The end of a move: into the net, into the keeper's hands, or wide.
export function addFinish(steps: PlayStep[], rng: Rng, side: 'home' | 'away', shooterId: string, result: 'goal' | 'save' | 'miss', keeperId?: string, header = false, facts?: ShotFacts): void {
  const goalY = side === 'home' ? 1 : 0;
  const inward = side === 'home' ? -1 : 1;
  const last = steps[steps.length - 1];
  if (last && last.carrier !== shooterId) steps.push({ x: 0.5 + rng.range(-0.15, 0.15), y: goalY + inward * rng.range(0.1, 0.16), carrier: shooterId, side, act: 'run' });
  const keeperSide = side === 'home' ? 'away' : 'home';
  const aim = facts?.aim;
  const shape = facts?.shape;
  const head = facts ? !!facts.header : header;
  if (result === 'goal') {
    steps.push({ x: 0.5 + rng.range(-0.045, 0.045), y: goalY - inward * 0.012, carrier: null, side, act: 'goal', header: head, aim, shape, var: facts?.var, shotBy: side });
  } else if (facts?.var === 'overturned') {
    // In the net, then VAR rules it out: a free kick to the defenders.
    steps.push({ x: 0.5 + rng.range(-0.045, 0.045), y: goalY - inward * 0.012, carrier: null, side: keeperSide, act: 'goal', header: head, aim, shape, var: 'overturned', varReason: facts.varReason, call: facts.call, restart: 'freekick', shotBy: side });
  } else if (result === 'save') {
    // About a third are tipped round the post or over: a corner.
    const tipped = facts ? !!facts.tipped : rng.chance(0.33);
    steps.push({ x: 0.5 + rng.range(-0.05, 0.05), y: goalY + inward * 0.03, carrier: keeperId ?? null, side: tipped ? side : keeperSide, act: 'save', header: head, aim, shape, restart: tipped ? 'corner' : undefined, parried: facts?.parried, shotBy: side });
  } else if (facts?.blocker) {
    // Off the defender: behind for a corner, out for a throw, or still alive.
    const out = facts.blockOut;
    const left = rng.chance(0.5);
    const at = out === 'throw' ? { x: left ? -0.01 : 1.01, y: goalY + inward * 0.2 } : { x: 0.5, y: goalY + inward * (out === 'loose' ? 0.2 : 0.15) };
    steps.push({ ...at, carrier: null, side, act: 'miss', restart: out === 'loose' ? undefined : out === 'throw' ? 'throw' : 'corner', aim, shape, blocker: facts.blocker, shotBy: side });
  } else if (facts?.frame) {
    // Off the woodwork and back out: nobody has it, and play goes on.
    steps.push({ x: 0.5 + rng.range(-0.12, 0.12), y: goalY + inward * 0.1, carrier: null, side: keeperSide, act: 'miss', header: head, aim, shape, frame: facts.frame, shotBy: side });
  } else {
    const wide = rng.chance(0.5) ? rng.range(0.34, 0.43) : rng.range(0.57, 0.66);
    // Some are deflected behind off a defender: a corner, not a goal kick.
    const deflected = facts ? !!facts.deflected : rng.chance(0.18);
    steps.push({ x: wide, y: goalY - inward * 0.015, carrier: null, side: deflected ? side : keeperSide, act: 'miss', restart: deflected ? 'corner' : 'goalkick', header: head, aim, shape, over: facts?.over, shotBy: side });
  }
}

// The side facing a shot. step.side is not always that: on a stoppage it is
// the side that restarts, so a goal, a tipped save and a deflected miss (all
// scored by, or restarted by, the attackers) name the attackers instead.
export function defendingSide(step: Pick<PlayStep, 'act' | 'side' | 'var' | 'restart' | 'shotBy'>): 'home' | 'away' {
  if (step.shotBy) return step.shotBy === 'home' ? 'away' : 'home';
  const attackers = step.restart === 'corner' || (step.act === 'goal' && step.var !== 'overturned');
  return attackers ? (step.side === 'home' ? 'away' : 'home') : step.side;
}

// How the next move starts after this one ended.
export function nextStart(steps: PlayStep[] | undefined, fallback: { x: number; y: number }): PlayStart {
  const end = steps?.[steps.length - 1];
  if (!end) return { ...fallback };
  if (end.act === 'card' || end.act === 'injury') return nextStart(steps!.slice(0, -1), fallback);
  if (end.act === 'goal') return { x: 0.5, y: 0.5, restart: 'kickoff' };
  if (end.restart) {
    // Set pieces are taken from a sensible spot.
    let { x, y } = end;
    if (end.restart === 'throw') x = x < 0.5 ? 0 : 1;
    if (end.restart === 'corner') {
      x = x < 0.5 ? 0.01 : 0.99;
      y = y > 0.5 ? 0.995 : 0.005;
    }
    if (end.restart === 'goalkick') {
      x = 0.5;
      y = y > 0.5 ? 0.95 : 0.05;
    }
    return { x: clamp(x, 0, 1), y: clamp(y, 0, 1), restart: end.restart, restartSide: end.side };
  }
  return { x: end.x, y: end.y, prev: end.carrier };
}

// A visual seed for a minute, drawn without touching the match's own stream.
export function playSeed(rngState: number, minute: number, events: number): number {
  return ((rngState ^ 0x5bd1e995) + minute * 7919 + events * 104729) >>> 0;
}
