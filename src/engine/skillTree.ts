import { AttrKey, Player, Position } from './types';
import { SKILLS, canUpgrade, skillLevel } from './skills';

// Abilities as a tree per position: three branches, each an ordered chain.
// A node is a level of an existing skill or, at the end of a branch, a
// technique that changes a key moment. A node unlocks only when the one
// above it is owned.

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
];

export type TreeNode = { kind: 'skill'; skill: string; level: number } | { kind: 'tech'; tech: string };

export interface Branch {
  id: string;
  label: string;
  nodes: TreeNode[];
}

const sk = (skill: string, level: number): TreeNode => ({ kind: 'skill', skill, level });
const tech = (id: string): TreeNode => ({ kind: 'tech', tech: id });

// Each skill's levels sit in one branch, in order, so the chain and the
// levels never disagree.
const TREES: Record<Position, Branch[]> = {
  FWD: [
    { id: 'finishing', label: 'Finishing', nodes: [sk('finisher', 1), sk('finisher', 2), sk('finesse', 1), sk('finisher', 3), tech('fakeshot')] },
    { id: 'flair', label: 'Flair', nodes: [sk('dribbler', 1), sk('speedster', 1), sk('dribbler', 2), sk('speedster', 2), sk('dribbler', 3)] },
    { id: 'biggame', label: 'Big games', nodes: [sk('clutch', 1), sk('setpiece', 1), sk('clutch', 2), sk('setpiece', 2), tech('curler')] },
  ],
  MID: [
    { id: 'playmaking', label: 'Playmaking', nodes: [sk('playmaker', 1), sk('playmaker', 2), sk('finesse', 1), sk('playmaker', 3), tech('splitter')] },
    { id: 'engine', label: 'Engine', nodes: [sk('engine', 1), sk('leader', 1), sk('engine', 2), sk('leader', 2), sk('engine', 3)] },
    { id: 'shooting', label: 'Shooting', nodes: [sk('finisher', 1), sk('setpiece', 1), sk('finisher', 2), sk('clutch', 1), tech('curler')] },
  ],
  DEF: [
    { id: 'defending', label: 'Defending', nodes: [sk('wall', 1), sk('wall', 2), sk('wall', 3), tech('lastditch')] },
    { id: 'physical', label: 'Physical', nodes: [sk('engine', 1), sk('speedster', 1), sk('engine', 2), sk('engine', 3)] },
    { id: 'leadership', label: 'Leadership', nodes: [sk('leader', 1), sk('clutch', 1), sk('leader', 2), sk('playmaker', 1), sk('leader', 3)] },
  ],
  GK: [
    { id: 'stopping', label: 'Shot stopping', nodes: [sk('shotstopper', 1), sk('shotstopper', 2), sk('shotstopper', 3), tech('sweeper')] },
    { id: 'distribution', label: 'Distribution', nodes: [sk('playmaker', 1), sk('playmaker', 2), sk('playmaker', 3)] },
    { id: 'mind', label: 'Mind', nodes: [sk('leader', 1), sk('clutch', 1), sk('leader', 2), sk('clutch', 2), sk('engine', 1)] },
  ],
};

export function treeFor(p: Pick<Player, 'position'>): Branch[] {
  return TREES[p.position] ?? TREES.MID;
}

export function techniqueById(id: string): Technique | undefined {
  return TECHNIQUES.find((t) => t.id === id);
}

export function hasTechnique(p: Player, id: string): boolean {
  return skillLevel(p, id) > 0;
}

export function nodeOwned(p: Player, n: TreeNode): boolean {
  return n.kind === 'skill' ? skillLevel(p, n.skill) >= n.level : hasTechnique(p, n.tech);
}

export function nodeLabel(n: TreeNode): string {
  if (n.kind === 'tech') return techniqueById(n.tech)?.label ?? n.tech;
  const def = SKILLS.find((s) => s.id === n.skill);
  return `${def?.label ?? n.skill} ${'I'.repeat(n.level)}`;
}

export function nodeCost(n: TreeNode): number {
  return n.kind === 'tech' ? techniqueById(n.tech)?.cost ?? 2 : 1;
}

// What a node needs: the attribute and its value.
export function nodeNeeds(n: TreeNode): { attr: AttrKey; value: number } {
  if (n.kind === 'tech') {
    const t = techniqueById(n.tech)!;
    return { attr: t.attr, value: t.needs };
  }
  const def = SKILLS.find((s) => s.id === n.skill)!;
  return { attr: def.attr, value: def.needs[n.level - 1] };
}

export type NodeState = 'owned' | 'ready' | 'next' | 'locked';

// owned; ready (next in line and affordable); next (next in line, but short
// of points or the attribute); locked (an earlier node is missing).
export function nodeState(p: Player, branch: Branch, index: number, points: number): NodeState {
  const n = branch.nodes[index];
  if (nodeOwned(p, n)) return 'owned';
  if (!branch.nodes.slice(0, index).every((m) => nodeOwned(p, m))) return 'locked';
  return canUnlock(p, n, points).ok ? 'ready' : 'next';
}

export function canUnlock(p: Player, n: TreeNode, points: number): { ok: boolean; reason?: string } {
  if (nodeOwned(p, n)) return { ok: false, reason: 'Already yours.' };
  if (n.kind === 'skill') {
    if (skillLevel(p, n.skill) !== n.level - 1) return { ok: false, reason: 'Unlock the levels before it first.' };
    return canUpgrade(p, n.skill, points);
  }
  const t = techniqueById(n.tech)!;
  if (p.attrs[t.attr] < t.needs) return { ok: false, reason: `Needs ${t.attr} ${t.needs}.` };
  if (points < t.cost) return { ok: false, reason: `Needs ${t.cost} skill points.` };
  return { ok: true };
}

// Every node the player can unlock right now, for the upgrade badge.
export function readyNodes(p: Player, points: number): { branch: Branch; index: number; node: TreeNode }[] {
  const out: { branch: Branch; index: number; node: TreeNode }[] = [];
  for (const branch of treeFor(p)) {
    branch.nodes.forEach((node, index) => {
      if (nodeState(p, branch, index, points) === 'ready') out.push({ branch, index, node });
    });
  }
  return out;
}
