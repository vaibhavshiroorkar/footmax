import { Position } from '../engine/types';
import { ROLES, isRole } from '../engine/roles';

// A data pack is the editable database a new world is built from. The
// built-in pack lives in leagues/ and otherClubs.ts; users can export it,
// edit it and import it back as JSON.

export interface PlayerSeed {
  name: string;
  pos: Position;
  nation: string;
  born: number;
  ovr: number;
  pot?: number;
  // Exact role (ST, LW, CB...). The broad pos is derived from it.
  role?: string;
}

export interface ClubSeed {
  name: string;
  short: string;
  rep: number;
  colors: [string, string];
  players: PlayerSeed[];
}

export interface LeagueSeed {
  id: string;
  nation: string;
  tier: number;
  name: string;
  // League above, and how many clubs move up and down each season.
  parent?: string;
  swap?: number;
  clubs: ClubSeed[];
}

export interface OtherClubsSeed {
  nation: string;
  clubs: ClubSeed[];
}

export interface DataPack {
  format: 'footmax-pack';
  version: 1;
  name: string;
  leagues: LeagueSeed[];
  otherClubs: OtherClubsSeed[];
}

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

// Packed player list: "Full Name POS NAT YY OVR; ...". The last four
// tokens are fixed, so names can contain spaces. A leading "!" marks a
// one-name player (for example "!Rodri").
export function parsePlayers(packed: string): PlayerSeed[] {
  return packed
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const parts = s.split(/\s+/);
      const ovr = Number(parts.pop());
      const yy = Number(parts.pop());
      const nation = parts.pop()!;
      const code = parts.pop()!;
      // Either a broad position (FWD) or an exact role (ST, LW...).
      const role = isRole(code) && code !== 'GK' ? code : undefined;
      const pos = (role ? ROLES[role].broad : code) as Position;
      if (!POSITIONS.includes(pos) || !Number.isFinite(ovr) || !Number.isFinite(yy)) {
        throw new Error(`Bad player entry: "${s}"`);
      }
      return { name: parts.join(' '), pos, nation, born: yy > 30 ? 1900 + yy : 2000 + yy, ovr, ...(role ? { role } : {}) };
    });
}

export function club(name: string, short: string, rep: number, c1: string, c2: string, packed = ''): ClubSeed {
  return { name, short, rep, colors: [c1, c2], players: parsePlayers(packed) };
}

export function validatePack(raw: unknown): { pack?: DataPack; error?: string } {
  const p = raw as DataPack;
  if (!p || typeof p !== 'object') return { error: 'Not a JSON object.' };
  if (p.format !== 'footmax-pack') return { error: 'Missing "format": "footmax-pack".' };
  if (!Array.isArray(p.leagues) || !p.leagues.length) return { error: 'The pack needs at least one league.' };
  for (const l of p.leagues) {
    if (!l.id || !l.nation || !Array.isArray(l.clubs) || l.clubs.length < 4) return { error: `League ${l.id ?? '?'} needs an id, a nation and at least 4 clubs.` };
    for (const c of l.clubs) {
      if (!c.name || !Array.isArray(c.players)) return { error: `A club in ${l.id} is missing a name or players list.` };
      for (const pl of c.players) {
        // JSON packs may put an exact role in pos; split it into pos + role.
        const code: string = pl.pos;
        if (isRole(code) && code !== 'GK') {
          pl.role = code;
          pl.pos = ROLES[code].broad;
        }
        if (pl.role && !isRole(pl.role)) return { error: `Unknown role "${pl.role}" for ${pl.name}.` };
        if (!pl.name || !POSITIONS.includes(pl.pos) || !(pl.ovr >= 1 && pl.ovr <= 99)) return { error: `Bad player "${pl.name ?? '?'}" at ${c.name}.` };
      }
    }
  }
  if (!Array.isArray(p.otherClubs)) p.otherClubs = [];
  return { pack: p };
}
