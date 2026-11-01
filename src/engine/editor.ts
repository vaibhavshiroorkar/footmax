import { Club, Player, Position, World } from './types';
import { clamp } from './rng';
import { fairWage, overall, weightsFor } from './player';
import { autoSkills } from './skills';
import { ROLES, Role, isRole } from './roles';
import { movePlayer } from './transfers';
import { ClubSeed, DataPack, PlayerSeed, validatePack } from '../data/pack';
import { START_YEAR } from './generator';

export interface PlayerEdit {
  firstName?: string;
  lastName?: string;
  nationId?: string;
  position?: Position;
  age?: number;
  overall?: number;
  potential?: number;
  clubId?: string | null;
  // Exact role, or null to clear it.
  role?: string | null;
}

// Changing the overall shifts the attributes that matter for the position,
// so the player keeps his shape.
function setOverall(p: Player, target: number) {
  for (let i = 0; i < 5; i++) {
    const diff = target - overall(p);
    if (Math.abs(diff) < 0.5) break;
    const w = weightsFor(p);
    for (const k of Object.keys(w) as (keyof typeof w)[]) p.attrs[k] = clamp(p.attrs[k] + diff, 1, 99);
  }
}

export function editPlayer(world: World, id: string, e: PlayerEdit): void {
  const p = world.players[id];
  if (!p) return;
  if (e.firstName !== undefined) p.firstName = e.firstName.trim();
  if (e.lastName !== undefined && e.lastName.trim()) p.lastName = e.lastName.trim();
  if (e.nationId) p.nationId = e.nationId;
  if (e.role !== undefined) {
    const ovr = overall(p);
    p.role = e.role && isRole(e.role) ? e.role : undefined;
    if (p.role) p.position = ROLES[p.role as Role].broad;
    setOverall(p, ovr);
  }
  if (e.position && e.position !== p.position && !p.role) {
    const ovr = overall(p);
    p.position = e.position;
    setOverall(p, ovr);
  }
  if (e.age !== undefined) p.age = clamp(Math.round(e.age), 15, 45);
  if (e.overall !== undefined) setOverall(p, clamp(Math.round(e.overall), 20, 99));
  if (e.potential !== undefined) p.potential = clamp(Math.round(e.potential), overall(p), 99);
  else p.potential = Math.max(p.potential, overall(p));
  if (e.clubId !== undefined && e.clubId !== p.clubId) movePlayer(world, p, e.clubId, p.wage, p.contractYears || 2);
  p.wage = Math.max(p.wage, Math.round(fairWage(p) * 0.6));
  p.skills = autoSkills(p);
}

export interface ClubEdit {
  name?: string;
  short?: string;
  reputation?: number;
  colors?: [string, string];
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function editClub(world: World, id: string, e: ClubEdit): void {
  const c: Club | undefined = world.clubs[id] ?? world.nationalTeams[id];
  if (!c) return;
  if (e.name?.trim()) c.name = e.name.trim();
  if (e.short?.trim()) c.short = e.short.trim().slice(0, 4).toUpperCase();
  if (e.reputation !== undefined) c.reputation = clamp(Math.round(e.reputation), 10, 99);
  if (e.colors && HEX.test(e.colors[0]) && HEX.test(e.colors[1])) c.colors = e.colors;
}

// Birth year is written relative to START_YEAR so a re-import rebuilds
// the same ages.
function toSeed(p: Player, season: number): PlayerSeed {
  const name = p.firstName ? `${p.firstName} ${p.lastName}` : `!${p.lastName}`;
  return { name, pos: p.position, nation: p.nationId, born: season - p.age, ovr: overall(p), pot: p.potential };
}

function clubSeed(world: World, c: Club, onlyReal: boolean): ClubSeed {
  const players = c.playerIds
    .map((id) => world.players[id])
    .filter((p) => p && (!onlyReal || p.real))
    .map((p) => toSeed(p, START_YEAR));
  return { name: c.name, short: c.short, rep: c.reputation, colors: c.colors, players };
}

// Turns the current world back into a data pack. With onlyReal, generated
// depth players are left out so the file stays small and editable.
export function exportPack(world: World, name: string, onlyReal = true): DataPack {
  const leagues = world.leagues
    .filter((l) => l.clubIds.length >= 4)
    .map((l) => ({
      id: l.id,
      nation: l.nationId,
      tier: l.tier,
      name: l.name,
      parent: l.parentId,
      swap: l.swap,
      clubs: l.clubIds.map((id) => clubSeed(world, world.clubs[id], onlyReal)),
    }));
  const byNation = new Map<string, ClubSeed[]>();
  for (const c of Object.values(world.clubs)) {
    if (c.leagueId) continue;
    const seed = clubSeed(world, c, onlyReal);
    if (onlyReal && !seed.players.length) continue;
    byNation.set(c.nationId, [...(byNation.get(c.nationId) ?? []), seed]);
  }
  return {
    format: 'footmax-pack',
    version: 1,
    name,
    leagues,
    otherClubs: [...byNation.entries()].map(([nation, clubs]) => ({ nation, clubs })),
  };
}

export function parsePackText(text: string): { pack?: DataPack; error?: string } {
  try {
    return validatePack(JSON.parse(text));
  } catch (e) {
    return { error: `Not valid JSON: ${(e as Error).message}` };
  }
}
