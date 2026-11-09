import { Club, Fixture, World } from './types';
import { clamp, Rng } from './rng';
import { leagueStrength } from './generator';
import { teamById } from './lineup';

// Where a match is played and who watches it. Pure and seeded by the fixture,
// so the same match always has the same crowd. Only the presentation reads it
// (the pitch, the crowd noise, the matchday card); results never do.
// Sources for the numbers are in RESEARCH.md ("Grounds and crowds").

// The career ladder's rungs, by league strength (mean club reputation):
// grassroots, semi-pro, professional, top flight, elite. ladder.tsx labels them.
export const RUNG_MINS = [0, 35, 50, 63, 76];

export function rungOf(strength: number): number {
  let i = 0;
  RUNG_MINS.forEach((min, k) => {
    if (strength >= min) i = k;
  });
  return i;
}

// rail: spectators along a rail, no seats. main: one small stand.
// four: a stand on every side. bowl: four tall stands joined at the corners.
export type StandKind = 'rail' | 'main' | 'four' | 'bowl';
export type Occasion = 'league' | 'europe' | 'international' | 'tournament' | 'final';
export type Mowing = 'none' | 'faint' | 'bands' | 'checks';

export interface Ground {
  level: number;
  occasion: Occasion;
  // Played at a neutral venue: both sets of fans share the ground.
  neutral: boolean;
  capacity: number;
  attendance: number;
  awayFans: number;
  stands: StandKind;
  grass: { a: string; b: string; mowing: Mowing; wear: number };
  lights: boolean;
  // Volume of the crowd murmur, 0..1.
  noise: number;
  home: [string, string];
  away: [string, string];
  seed: number;
}

// Capacity by club reputation, interpolated on a log scale. Anchored on real
// averages: Premier League grounds about 40,000, the Championship about
// 22,000, League Two 5,000 to 6,000, step 7 and below a few hundred.
const CAPACITY: [number, number][] = [
  [15, 150],
  [25, 400],
  [35, 1500],
  [45, 4000],
  [52, 9000],
  [60, 20000],
  [70, 30000],
  [80, 42000],
  [90, 60000],
  [100, 80000],
];

export function capacityFor(reputation: number): number {
  const r = clamp(reputation, CAPACITY[0][0], CAPACITY[CAPACITY.length - 1][0]);
  for (let i = 1; i < CAPACITY.length; i++) {
    const [r1, c1] = CAPACITY[i];
    const [r0, c0] = CAPACITY[i - 1];
    if (r <= r1) {
      const t = (r - r0) / (r1 - r0);
      return Math.round(Math.exp(Math.log(c0) + t * (Math.log(c1) - Math.log(c0))));
    }
  }
  return CAPACITY[CAPACITY.length - 1][1];
}

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}

// Rounds a crowd the way a stadium announcer would read it out.
function count(n: number): number {
  return n >= 1000 ? Math.round(n / 10) * 10 : Math.round(n);
}

const GRASS: { a: string; b: string; mowing: Mowing; wear: number }[] = [
  // A council pitch: dull, uneven, bare in the goalmouths.
  { a: '#5b8a3f', b: '#5b8a3f', mowing: 'none', wear: 0.85 },
  { a: '#4f8a40', b: '#4a8340', mowing: 'faint', wear: 0.55 },
  { a: '#358a48', b: '#2f8043', mowing: 'bands', wear: 0.25 },
  { a: '#2b8a4b', b: '#237a41', mowing: 'bands', wear: 0.08 },
  // Hybrid turf, cut both ways.
  { a: '#2a8c4c', b: '#20763f', mowing: 'checks', wear: 0 },
];

function occasionOf(world: World, f: Fixture, home: Club): Occasion {
  if (f.europe && f.stage === 'Final') return 'final';
  if (f.europe) return 'europe';
  if (world.phase === 'tournament' && home.national) return 'tournament';
  if (home.national) return 'international';
  return 'league';
}

export function groundFor(world: World, f: Fixture): Ground {
  const home = teamById(world, f.homeId);
  const away = teamById(world, f.awayId);
  const seed = hash(f.id);
  const rng = new Rng(seed);
  const occasion = occasionOf(world, f, home);
  const neutral = occasion === 'final' || occasion === 'tournament';
  const league = home.leagueId ? world.leagues.find((l) => l.id === home.leagueId) : undefined;
  // A club's ground follows its own size and its league's: a big club in a
  // second tier still plays in a proper stadium.
  const standing = league ? (home.reputation + leagueStrength(world, league)) / 2 : home.reputation;
  let level = home.national ? (home.reputation >= 55 ? 4 : 3) : rungOf(standing);
  let capacity = capacityFor(home.reputation);
  if (home.national) capacity = Math.max(8000, capacity);
  if (occasion === 'final') capacity = 70000 + rng.int(0, 12) * 1000;
  if (occasion === 'tournament') capacity = 40000 + rng.int(0, 30) * 1000;
  if (neutral) level = 4;
  // European nights need a UEFA-approved ground, whoever the club is.
  if (occasion === 'europe') level = Math.max(level, 3);

  // Big clubs sell out; small ones rarely fill what they have. The Premier
  // League ran at 98.8% of capacity in 2024/25.
  let fill = 0.45 + (home.reputation - 20) / 110 + rng.range(-0.05, 0.05);
  if (occasion !== 'league') fill += 0.12;
  if (f.stage && /final/i.test(f.stage)) fill += 0.1;
  fill = occasion === 'final' ? 1 : clamp(fill, 0.3, 1);
  const attendance = count(capacity * fill);

  // Away fans: half each at a neutral venue. Otherwise the Premier League's
  // rule (3,000 or 10% of a smaller ground), UEFA's 5% in Europe, and a few
  // travellers mixed in at the lower levels.
  const awayFans = count(
    neutral ? attendance * 0.45 : occasion === 'europe' || occasion === 'international' ? Math.min(attendance * 0.4, capacity * 0.05) : level >= 2 ? Math.min(attendance * 0.4, capacity < 30000 ? capacity * 0.1 : 3000) : attendance * 0.08,
  );

  const stands: StandKind = level >= 4 || capacity >= 45000 ? 'bowl' : level >= 2 ? 'four' : level === 1 ? 'main' : 'rail';
  // Floodlit: every European and international night, and some top-flight
  // evening kick-offs. Grassroots grounds have no lights.
  const lights = occasion !== 'league' ? true : level >= 3 ? rng.chance(0.35) : level >= 1 ? rng.chance(0.15) : false;
  const noise = clamp((Math.log10(Math.max(10, attendance)) - 1.5) / 3.4, 0.05, 1) * 0.42;
  return {
    level,
    occasion,
    neutral,
    capacity,
    attendance,
    awayFans,
    stands,
    grass: GRASS[level],
    lights,
    noise,
    home: home.colors,
    away: away.colors,
    seed,
  };
}

const LINES = [
  'A few dozen watch from the rail.',
  'A small stand and a few hundred locals.',
  'Four stands and a proper football crowd.',
  'A big crowd, TV cameras and a pitch like a carpet.',
  'A full house. This is the elite.',
];

// One line for the matchday card, by the level and the occasion.
export function groundLine(g: Ground): string {
  if (g.occasion === 'final') return 'A final. Half the ground is theirs.';
  if (g.occasion === 'tournament') return 'A tournament crowd, both ends singing.';
  if (g.occasion === 'europe') return 'A European night under the lights.';
  if (g.occasion === 'international') return 'The national anthem, a packed ground.';
  if (g.level >= 4 && g.attendance < g.capacity * 0.9) return 'A big ground, not quite full.';
  if (g.level === 0 && g.attendance >= 200) return 'A few hundred watch from the rail.';
  return LINES[g.level];
}
