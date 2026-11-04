import { AttrKey, Player, Position } from './types';
import { SKILLS, canUpgrade, skillLevel } from './skills';
import { ROLES, ROLE_NEIGHBOURS, Role, isRole } from './roles';

// The ability tree: one large map of branches, all plain data. A node costs
// level points and needs an attribute, and opens once a node above it is
// owned. Nodes are levels of an ability, techniques that change a moment,
// small permanent stat gains, weak foot stars, and new positions.

export interface Technique {
  id: string;
  label: string;
  description: string;
  icon: string;
  attr: AttrKey;
  needs: number;
  cost: number;
}

export const TECHNIQUES: Technique[] = [
  { id: 'fakeshot', label: 'Fake shot', description: 'Shot moments: a Fake button sends the keeper the wrong way, once.', icon: 'swap-horizontal', attr: 'composure', needs: 66, cost: 2 },
  { id: 'curler', label: 'Curler', description: 'Curled shots bend further: round defenders and away from the keeper.', icon: 'color-wand', attr: 'shooting', needs: 66, cost: 2 },
  { id: 'splitter', label: 'Defence splitter', description: 'Through balls: a much wider window to release them.', icon: 'git-network', attr: 'vision', needs: 66, cost: 2 },
  { id: 'lastditch', label: 'Last-ditch', description: 'Your first defensive mistake each match is not punished: you recover in time.', icon: 'shield-half', attr: 'defending', needs: 66, cost: 2 },
  { id: 'sweeper', label: 'Sweeper keeper', description: 'Saves: more time to react to the shot.', icon: 'hand-right', attr: 'goalkeeping', needs: 66, cost: 2 },
  { id: 'poacher', label: 'Poacher', description: 'Shots from inside the box go in more often.', icon: 'locate', attr: 'shooting', needs: 58, cost: 2 },
  { id: 'longrange', label: 'Long ranger', description: 'Long shots: a wider window to hit from far out.', icon: 'rocket', attr: 'shooting', needs: 62, cost: 2 },
  { id: 'target', label: 'Target man', description: 'Headers: you win more of them against your marker.', icon: 'arrow-up-circle', attr: 'physical', needs: 60, cost: 2 },
  { id: 'crosser', label: 'Whipped crosses', description: 'Crosses: a wider window to find your man.', icon: 'arrow-redo', attr: 'passing', needs: 58, cost: 2 },
  { id: 'coolhead', label: 'Cool head', description: 'Walking away from a flare-up always ends it.', icon: 'snow', attr: 'composure', needs: 55, cost: 1 },
  { id: 'trusted', label: "Coach's man", description: 'The coach gives you longer before taking you off.', icon: 'ribbon', attr: 'composure', needs: 50, cost: 1 },
  { id: 'ironman', label: 'Iron man', description: 'Injuries in matches keep you out for less time.', icon: 'fitness', attr: 'physical', needs: 62, cost: 2 },
  { id: 'spotkick', label: 'Spot kick king', description: 'Penalties: the aim marker moves slower.', icon: 'football', attr: 'composure', needs: 60, cost: 2 },
  { id: 'ballwinner', label: 'Ball winner', description: 'Tackles: more time to read your man.', icon: 'hand-left', attr: 'defending', needs: 56, cost: 2 },
  { id: 'reader', label: 'Reads the game', description: 'Interceptions: more time to read the pass.', icon: 'eye', attr: 'vision', needs: 56, cost: 2 },
  { id: 'commander', label: 'Commands the box', description: 'Keepers: more reach in save moments.', icon: 'megaphone', attr: 'goalkeeping', needs: 60, cost: 2 },
];

export type NodeEffect =
  | { kind: 'skill'; skill: string; level: number }
  | { kind: 'tech'; tech: string }
  | { kind: 'stat'; attr: AttrKey; tag: string }
  | { kind: 'foot'; stars: number }
  | { kind: 'position'; role: Role };

export type TreeNode = NodeEffect & {
  id: string;
  // Where it sits on the map, in cells.
  x: number;
  y: number;
  // Owning any of these opens it. None means it is open from the start.
  parents: string[];
};

export interface Branch {
  id: string;
  label: string;
  icon: string;
  // Who it suits most, and who may use it at all.
  roles?: Role[];
  only?: Position[];
  nodes: TreeNode[];
}

const sk = (skill: string, level: number): NodeEffect => ({ kind: 'skill', skill, level });
const te = (tech: string): NodeEffect => ({ kind: 'tech', tech });
const st = (attr: AttrKey, tag: string): NodeEffect => ({ kind: 'stat', attr, tag });

type Row = NodeEffect[];
interface BranchDef {
  id: string;
  label: string;
  icon: string;
  roles?: Role[];
  only?: Position[];
  rows: Row[];
}

// Each row hangs from the row above it: owning any node there opens this one.
const BRANCHES: BranchDef[] = [
  { id: 'striker', label: 'Striker', icon: 'football', roles: ['ST', 'CF'], only: ['FWD', 'MID'], rows: [[sk('finisher', 1)], [sk('finisher', 2), st('shooting', 'a')], [te('poacher'), sk('finesse', 1)], [sk('finisher', 3), st('composure', 'a')], [te('fakeshot'), sk('clutch', 1)], [st('shooting', 'b'), sk('clutch', 2)], [te('target')]] },
  { id: 'winger', label: 'Winger', icon: 'flash', roles: ['LW', 'RW', 'LM', 'RM'], only: ['FWD', 'MID', 'DEF'], rows: [[sk('speedster', 1)], [sk('dribbler', 1), st('pace', 'a')], [sk('speedster', 2), sk('dribbler', 2)], [te('crosser'), st('dribbling', 'a')], [sk('speedster', 3), sk('dribbler', 3)], [st('pace', 'b'), te('curler')]] },
  { id: 'playmaker', label: 'Playmaker', icon: 'git-network', roles: ['CAM', 'CM'], only: ['MID', 'FWD'], rows: [[sk('playmaker', 1)], [sk('playmaker', 2), st('vision', 'a')], [st('passing', 'a'), sk('finesse', 2)], [sk('playmaker', 3), te('reader')], [te('splitter'), st('vision', 'b')], [te('longrange')]] },
  { id: 'engine', label: 'Box to box', icon: 'battery-charging', roles: ['CM', 'CDM'], only: ['MID', 'DEF'], rows: [[sk('engine', 1)], [sk('engine', 2), st('physical', 'a')], [st('passing', 'b'), st('defending', 'c')], [sk('engine', 3), sk('leader', 1)], [te('ballwinner'), sk('leader', 2)], [st('physical', 'b')]] },
  { id: 'holder', label: 'Holding', icon: 'shield', roles: ['CDM'], only: ['MID', 'DEF'], rows: [[sk('wall', 1)], [st('defending', 'a'), te('reader')], [sk('wall', 2), st('composure', 'b')], [te('ballwinner'), sk('leader', 1)], [sk('wall', 3)], [te('lastditch')]] },
  { id: 'fullback', label: 'Full-back', icon: 'walk', roles: ['LB', 'RB', 'LWB', 'RWB'], only: ['DEF', 'MID'], rows: [[st('pace', 'c')], [sk('speedster', 1), st('defending', 'd')], [te('crosser'), sk('wall', 1)], [sk('speedster', 2), st('passing', 'c')], [te('ballwinner'), sk('wall', 2)], [te('lastditch')]] },
  { id: 'centreback', label: 'Centre-back', icon: 'shield-half', roles: ['CB'], only: ['DEF'], rows: [[sk('wall', 1)], [sk('wall', 2), st('physical', 'c')], [te('target'), st('defending', 'b')], [sk('wall', 3), sk('leader', 1)], [te('lastditch'), sk('leader', 2)], [sk('leader', 3)]] },
  { id: 'keeper', label: 'Goalkeeper', icon: 'hand-left', only: ['GK'], rows: [[sk('shotstopper', 1)], [sk('shotstopper', 2), st('goalkeeping', 'a')], [te('commander'), st('composure', 'c')], [sk('shotstopper', 3), sk('playmaker', 1)], [te('sweeper'), st('goalkeeping', 'b')], [sk('leader', 1), sk('playmaker', 2)], [sk('clutch', 1), sk('leader', 2)]] },
  { id: 'physical', label: 'Physical', icon: 'barbell', rows: [[st('physical', 'd')], [te('ironman'), st('pace', 'd')], [sk('engine', 1), st('physical', 'e')], [sk('engine', 2), st('pace', 'e')], [sk('engine', 3)]] },
  { id: 'mind', label: 'Mind', icon: 'bulb', rows: [[te('trusted')], [te('coolhead'), st('composure', 'd')], [sk('clutch', 1), sk('leader', 1)], [sk('clutch', 2), sk('leader', 2), st('vision', 'c')], [sk('clutch', 3), sk('leader', 3)]] },
  { id: 'setpiece', label: 'Set pieces', icon: 'navigate', only: ['FWD', 'MID', 'DEF'], rows: [[sk('setpiece', 1)], [te('spotkick'), st('shooting', 'c')], [sk('setpiece', 2), te('crosser')], [te('curler'), sk('finesse', 1)], [sk('setpiece', 3)]] },
];

// Weak foot: everyone starts on two stars.
const FOOT_ROWS: Row[] = [[{ kind: 'foot', stars: 3 }], [{ kind: 'foot', stars: 4 }], [{ kind: 'foot', stars: 5 }]];

// How wide one branch is, and the cells between nodes, on the map.
const BRANCH_GAP = 3;

function layout(id: string, column: number, rows: Row[]): TreeNode[] {
  const out: TreeNode[] = [];
  let above: string[] = [];
  rows.forEach((row, y) => {
    const here: string[] = [];
    row.forEach((effect, i) => {
      const nodeId = `${id}.${y}.${i}`;
      out.push({ ...effect, id: nodeId, x: column + (i - (row.length - 1) / 2) * 1.05, y, parents: above });
      here.push(nodeId);
    });
    above = here;
  });
  return out;
}

// Positions fan out from the role he plays: neighbours first, then theirs.
function positionRows(p: Pick<Player, 'role'>): Row[] {
  const start = p.role && isRole(p.role) ? p.role : null;
  if (!start) return [];
  const seen = new Set<Role>([start]);
  const rows: Row[] = [];
  let ring: Role[] = [start];
  while (ring.length) {
    const next = [...new Set(ring.flatMap((r) => ROLE_NEIGHBOURS[r]))].filter((r) => !seen.has(r));
    next.forEach((r) => seen.add(r));
    if (next.length) rows.push(next.map((role) => ({ kind: 'position', role })));
    ring = next;
  }
  return rows.slice(0, 3);
}

const memo = new Map<string, Branch[]>();

// The branches open to this player, the ones for his role first.
export function treeFor(p: Pick<Player, 'position' | 'role'>): Branch[] {
  const key = `${p.position}|${p.role ?? ''}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const role = p.role && isRole(p.role) ? p.role : undefined;
  const open = BRANCHES.filter((b) => !b.only || b.only.includes(p.position)).sort((a, b) => Number(!!role && !!b.roles?.includes(role)) - Number(!!role && !!a.roles?.includes(role)));
  const extras: { id: string; label: string; icon: string; rows: Row[] }[] = p.position === 'GK' ? [] : [{ id: 'positions', label: 'Positions', icon: 'git-compare', rows: positionRows(p) }];
  if (p.position !== 'GK') extras.push({ id: 'foot', label: 'Weak foot', icon: 'footsteps', rows: FOOT_ROWS });
  const all: { id: string; label: string; icon: string; roles?: Role[]; only?: Position[]; rows: Row[] }[] = [...open, ...extras];
  const out: Branch[] = all.map((b, i) => ({ id: b.id, label: b.label, icon: b.icon, roles: b.roles, only: b.only, nodes: layout(b.id, i * BRANCH_GAP + 1, b.rows) }));
  memo.set(key, out);
  return out;
}

export function allNodes(p: Pick<Player, 'position' | 'role'>): TreeNode[] {
  return treeFor(p).flatMap((b) => b.nodes);
}

export function techniqueById(id: string): Technique | undefined {
  return TECHNIQUES.find((t) => t.id === id);
}

export function hasTechnique(p: Player, id: string): boolean {
  return skillLevel(p, id) > 0;
}

// Every position he can play, the main one first.
export function rolesOf(p: Pick<Player, 'role' | 'secondaryRole' | 'roles'>): string[] {
  return [...new Set([p.role, p.secondaryRole, ...(p.roles ?? [])].filter((r): r is string => !!r))];
}

export function nodeOwned(p: Player, n: NodeEffect): boolean {
  if (n.kind === 'skill') return skillLevel(p, n.skill) >= n.level;
  if (n.kind === 'tech') return hasTechnique(p, n.tech);
  if (n.kind === 'stat') return !!p.tree?.includes(`${n.attr}.${n.tag}`);
  if (n.kind === 'foot') return (p.weakFoot ?? 2) >= n.stars;
  return rolesOf(p).includes(n.role);
}

export function nodeLabel(n: NodeEffect): string {
  if (n.kind === 'tech') return techniqueById(n.tech)?.label ?? n.tech;
  if (n.kind === 'skill') return `${SKILLS.find((s) => s.id === n.skill)?.label ?? n.skill} ${'I'.repeat(n.level)}`;
  if (n.kind === 'stat') return `${n.attr[0].toUpperCase()}${n.attr.slice(1)} +1`;
  if (n.kind === 'foot') return `Weak foot ${n.stars} stars`;
  return ROLES[n.role].label;
}

export function nodeDescription(n: NodeEffect): string {
  if (n.kind === 'tech') return techniqueById(n.tech)?.description ?? '';
  if (n.kind === 'skill') return SKILLS.find((s) => s.id === n.skill)?.description ?? '';
  if (n.kind === 'stat') return `One point of ${n.attr}, for good.`;
  if (n.kind === 'foot') return 'Shots on your weaker foot stray less.';
  return `The coach can pick you as a ${ROLES[n.role].label.toLowerCase()}.`;
}

export function nodeCost(n: NodeEffect): number {
  if (n.kind === 'tech') return techniqueById(n.tech)?.cost ?? 2;
  if (n.kind === 'foot') return n.stars - 1;
  if (n.kind === 'position') return 2;
  return 1;
}

// A position asks for the attribute that role leans on most.
function roleAttr(role: Role): AttrKey {
  const weights = ROLES[role].weights;
  return (Object.keys(weights) as AttrKey[]).sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))[0];
}

// What a node needs: the attribute and its value.
export function nodeNeeds(n: TreeNode | NodeEffect): { attr: AttrKey; value: number } {
  if (n.kind === 'tech') {
    const t = techniqueById(n.tech)!;
    return { attr: t.attr, value: t.needs };
  }
  if (n.kind === 'skill') {
    const def = SKILLS.find((s) => s.id === n.skill)!;
    return { attr: def.attr, value: def.needs[n.level - 1] };
  }
  if (n.kind === 'stat') return { attr: n.attr, value: 40 + ('y' in n ? (n as TreeNode).y * 8 : 0) };
  if (n.kind === 'foot') return { attr: 'composure', value: 35 + n.stars * 8 };
  return { attr: roleAttr(n.role), value: 40 };
}

export type NodeState = 'owned' | 'ready' | 'next' | 'locked';

function openFor(p: Player, n: TreeNode, nodes: TreeNode[]): boolean {
  return !n.parents.length || n.parents.some((id) => {
    const parent = nodes.find((x) => x.id === id);
    return !!parent && nodeOwned(p, parent);
  });
}

export function canUnlock(p: Player, n: TreeNode, points: number, nodes = allNodes(p)): { ok: boolean; reason?: string } {
  if (nodeOwned(p, n)) return { ok: false, reason: 'Already yours.' };
  if (!openFor(p, n, nodes)) return { ok: false, reason: 'Unlock a node above it first.' };
  if (n.kind === 'skill') {
    if (skillLevel(p, n.skill) !== n.level - 1) return { ok: false, reason: 'Unlock the level before it first.' };
    return canUpgrade(p, n.skill, points);
  }
  if (n.kind === 'foot' && (p.weakFoot ?? 2) !== n.stars - 1) return { ok: false, reason: 'Unlock the star before it first.' };
  const needs = nodeNeeds(n);
  if (p.attrs[needs.attr] < needs.value) return { ok: false, reason: `Needs ${needs.attr} ${needs.value}.` };
  const cost = nodeCost(n);
  if (points < cost) return { ok: false, reason: `Needs ${cost} level point${cost > 1 ? 's' : ''}.` };
  return { ok: true };
}

// owned; ready to buy; next (open, but short of points or the attribute);
// locked (nothing above it is owned yet).
export function nodeState(p: Player, n: TreeNode, points: number, nodes = allNodes(p)): NodeState {
  if (nodeOwned(p, n)) return 'owned';
  if (!openFor(p, n, nodes)) return 'locked';
  return canUnlock(p, n, points, nodes).ok ? 'ready' : 'next';
}

// Every node the player can unlock right now, for the upgrade badge.
export function readyNodes(p: Player, points: number): TreeNode[] {
  const nodes = allNodes(p);
  return nodes.filter((n) => nodeState(p, n, points, nodes) === 'ready');
}

// The node's effect on the player, once paid for.
export function applyNode(p: Player, n: NodeEffect): void {
  if (n.kind === 'skill') p.skills = { ...(p.skills ?? {}), [n.skill]: n.level };
  else if (n.kind === 'tech') p.skills = { ...(p.skills ?? {}), [n.tech]: 1 };
  else if (n.kind === 'stat') {
    p.tree = [...(p.tree ?? []), `${n.attr}.${n.tag}`];
    p.attrs[n.attr] = Math.min(99, p.attrs[n.attr] + 1);
  } else if (n.kind === 'foot') p.weakFoot = n.stars;
  else p.roles = [...(p.roles ?? []), n.role];
}
