import { Game, Look } from '../engine/types';
import { fullName, overall } from '../engine/player';

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
}

export function newSlotId(): string {
  return `s${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function slotMeta(id: string, game: Game, name?: string): SlotMeta {
  const w = game.world;
  const when = w.phase === 'tournament' ? `Summer ${w.season + 1}` : `${w.season}/${String(w.season + 1).slice(2)}, week ${w.week}`;
  const base = { id, name, mode: game.mode, when, updatedAt: Date.now() };
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
