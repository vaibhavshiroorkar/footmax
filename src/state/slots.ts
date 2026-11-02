import { Game, Look } from '../engine/types';
import { fullName, overall } from '../engine/player';
import { Totals, gameTotals } from '../engine/totals';

export const MAX_SLOTS = 6;

// What the title screen shows for a save without loading it.
export interface SlotMeta {
  id: string;
  // A name the player typed; the career or manager name otherwise.
  name?: string;
  mode: 'career' | 'manager';
  title: string;
  detail: string;
  when: string;
  rating?: number;
  crest?: { colors: [string, string]; short: string; national?: boolean };
  look?: Look;
  number?: number;
  updatedAt: number;
  // Career numbers for leaderboards, refreshed on every save.
  board?: Totals;

  // Cloud sync (see sync.ts). A save with an owner syncs to that account.
  owner?: string;
  // Bumps on every local save.
  localRev?: number;
  // localRev and the cloud revision as of the last successful sync.
  syncedLocalRev?: number;
  cloudRev?: number;
  // The newest revision the cloud has, when it is ahead of this device.
  remoteRev?: number;
  // Listed from the cloud but not downloaded to this device yet.
  cloudOnly?: boolean;
  // Both this device and the cloud changed since the last sync.
  conflict?: boolean;
}

// Fields that describe the save itself, as stored in the cloud row.
const SYNC_KEYS = ['owner', 'localRev', 'syncedLocalRev', 'cloudRev', 'remoteRev', 'cloudOnly', 'conflict'] as const;

export function displayMeta(m: SlotMeta): SlotMeta {
  const rest: SlotMeta = { ...m };
  for (const k of SYNC_KEYS) delete rest[k];
  return rest;
}

export const isDirty = (m: SlotMeta) => (m.localRev ?? 0) > (m.syncedLocalRev ?? 0);

export function newSlotId(): string {
  return `s${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function slotMeta(id: string, game: Game, name?: string): SlotMeta {
  const w = game.world;
  const when = w.phase === 'tournament' ? `Summer ${w.season + 1}` : `${w.season}/${String(w.season + 1).slice(2)}, week ${w.week}`;
  const base = { id, name, mode: game.mode, when, updatedAt: Date.now(), board: gameTotals(game) };
  if (game.mode === 'career' && game.career) {
    const p = w.players[game.career.playerId];
    const club = p.clubId ? w.clubs[p.clubId] : null;
    return {
      ...base,
      title: fullName(p),
      detail: game.career.retired ? `Retired at ${p.age}` : `${p.role ?? p.position}, age ${p.age}, ${club?.name ?? 'free agent'}`,
      rating: overall(p),
      crest: club ? { colors: club.colors, short: club.short } : undefined,
      look: game.career.look,
      number: game.career.number,
    };
  }
  const m = game.manager!;
  const club = m.clubId ? w.clubs[m.clubId] : null;
  const nation = m.nationalTeamId ? w.nationalTeams[m.nationalTeamId] : null;
  const team = club ?? nation;
  return {
    ...base,
    title: m.name,
    detail: [club?.name, nation?.name].filter(Boolean).join(' and ') || 'Out of work',
    crest: team ? { colors: team.colors, short: team.short, national: !!team.national } : undefined,
  };
}
