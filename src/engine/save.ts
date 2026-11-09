import { ATTR_KEYS, Attributes, Game, Position } from './types';
import { overall } from './player';
import { rolesFor } from './roles';
import { SAVE_VERSION } from './game';

// Attributes are stored as arrays in ATTR_KEYS order, and floats keep one
// decimal. With 6,000+ players this keeps a late-game save near 2 MB.
export function serialize(game: Game): string {
  return JSON.stringify(game, (key, v) => {
    if (key === 'attrs' && v && typeof v === 'object' && !Array.isArray(v)) return ATTR_KEYS.map((k) => Math.round((v as Attributes)[k] * 10) / 10);
    if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 100) / 100;
    return v;
  });
}

// Upgrades a parsed save one version at a time. The key is the version a
// step upgrades FROM. Add a step whenever SAVE_VERSION goes up, so older
// saves (local and cloud) keep loading instead of being thrown away.
export const MIGRATIONS: Record<number, (g: Record<string, unknown>) => void> = {
  // 2 -> 3: every player gets an exact role (LB, CDM, RW...), so lineups and
  // the pitch can put him in his position. The role is the one his
  // attributes suit best; left and right sides are split evenly.
  2: (g) => {
    const world = g.world as { players: Record<string, { id: string; position: Position; role?: string; attrs: Attributes }> };
    for (const p of Object.values(world.players)) {
      if (p.role) continue;
      const options = rolesFor(p.position);
      const tie = [...p.id].reduce((h, ch) => h + ch.charCodeAt(0), 0) % 2;
      let best = options[0];
      let top = -1;
      for (const role of options) {
        const v = overall({ attrs: p.attrs, position: p.position, role }) + (role.startsWith(tie ? 'R' : 'L') ? 0.01 : 0);
        if (v > top) {
          top = v;
          best = role;
        }
      }
      p.role = best;
    }
  },
  // 3 -> 4: the old second position becomes the first entry in the list the
  // ability tree adds to. Skills and techniques carry straight over.
  3: (g) => {
    const world = g.world as { players: Record<string, { secondaryRole?: string; roles?: string[] }> };
    for (const p of Object.values(world.players)) {
      if (!p.secondaryRole) continue;
      p.roles = [p.secondaryRole];
      delete p.secondaryRole;
    }
  },
  // 4 -> 5: a career ended by jail, a ban, injury or depression used to leave
  // the player on his club's books. He leaves now, as he does on retiring.
  4: (g) => {
    const career = g.career as { playerId: string; retired: boolean } | null;
    const world = g.world as { players: Record<string, { clubId: string | null }>; clubs: Record<string, { playerIds: string[] }> };
    const p = career?.retired ? world.players[career.playerId] : undefined;
    if (!p?.clubId) return;
    const club = world.clubs[p.clubId];
    if (club) club.playerIds = club.playerIds.filter((id) => id !== career!.playerId);
    p.clubId = null;
  },
};

export type LoadResult = { ok: true; game: Game } | { ok: false; error: 'corrupt' | 'too-new' };

export function loadSave(text: string): LoadResult {
  let g: Record<string, unknown> & { version?: number; world?: unknown };
  try {
    g = JSON.parse(text, (key, v) => {
      if (key === 'attrs' && Array.isArray(v)) {
        const out = {} as Attributes;
        ATTR_KEYS.forEach((k, i) => (out[k] = v[i]));
        return out;
      }
      return v;
    });
  } catch {
    return { ok: false, error: 'corrupt' };
  }
  if (!g || typeof g !== 'object' || !g.world || typeof g.version !== 'number') return { ok: false, error: 'corrupt' };
  if (g.version > SAVE_VERSION) return { ok: false, error: 'too-new' };
  while (g.version < SAVE_VERSION) {
    const step = MIGRATIONS[g.version];
    if (!step) return { ok: false, error: 'corrupt' };
    step(g);
    g.version++;
  }
  return { ok: true, game: g as unknown as Game };
}

export function deserialize(text: string): Game | null {
  const r = loadSave(text);
  return r.ok ? r.game : null;
}

export function loadErrorText(error: 'corrupt' | 'too-new'): string {
  return error === 'too-new' ? 'This save was made by a newer version of FootMax. Refresh the page to update.' : 'This save is damaged and cannot be opened.';
}
