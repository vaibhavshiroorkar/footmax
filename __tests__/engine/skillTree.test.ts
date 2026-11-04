import { newCareerGame } from '../../src/engine/game';
import { startMove, tickMove, train, unlockNode } from '../../src/engine/career';
import { allNodes, canUnlock, nodeOwned, nodeState, readyNodes, rolesOf, treeFor } from '../../src/engine/skillTree';
import { moveFee, moveWeeks, perkLines, sessionEnergy } from '../../src/engine/perks';
import { SKILL_MOVES } from '../../src/engine/skills';
import { ROLE_LIST, Role } from '../../src/engine/roles';
import { MIGRATIONS } from '../../src/engine/save';
import { ATTR_KEYS } from '../../src/engine/types';

const game = (role: Role = 'ST', seed = 3) => newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role, seed });
const me = (g: ReturnType<typeof game>) => g.world.players[g.career!.playerId];
const maxed = (g: ReturnType<typeof game>) => {
  const p = me(g);
  for (const k of ATTR_KEYS) p.attrs[k] = 99;
  g.career!.skillPoints = 999;
  return p;
};

describe('the ability tree', () => {
  it.each(ROLE_LIST)('is large for a %s, and every node can be reached', (role) => {
    const g = game(role);
    const p = maxed(g);
    const nodes = allNodes(p);
    expect(nodes.length).toBeGreaterThanOrEqual(role === 'GK' ? 25 : 60);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
    // Buy everything buyable until nothing changes.
    for (let pass = 0; pass < 40; pass++) {
      const ready = readyNodes(p, g.career!.skillPoints);
      if (!ready.length) break;
      for (const n of ready) unlockNode(g, n.id);
    }
    const left = nodes.filter((n) => !nodeOwned(p, n));
    expect(left.map((n) => n.id)).toEqual([]);
  });

  it('puts the branch for his role first', () => {
    expect(treeFor(me(game('ST')))[0].id).toBe('striker');
    expect(treeFor(me(game('CB')))[0].id).toBe('centreback');
    expect(treeFor(me(game('LW')))[0].id).toBe('winger');
    expect(treeFor(me(game('GK')))[0].id).toBe('keeper');
  });

  it('costs level points and needs the attribute', () => {
    const g = game('ST');
    const p = me(g);
    const first = treeFor(p)[0].nodes[0];
    g.career!.skillPoints = 0;
    p.attrs.shooting = 99;
    expect(canUnlock(p, first, 0).ok).toBe(false);
    p.attrs.shooting = 10;
    expect(canUnlock(p, first, 5).ok).toBe(false);
    p.attrs.shooting = 70;
    g.career!.skillPoints = 2;
    expect(unlockNode(g, first.id).ok).toBe(true);
    expect(g.career!.skillPoints).toBe(1);
  });

  it('locks a node until one above it is owned', () => {
    const g = game('ST');
    const p = maxed(g);
    const branch = treeFor(p)[0];
    const deep = branch.nodes[branch.nodes.length - 1];
    expect(nodeState(p, deep, 99)).toBe('locked');
    expect(unlockNode(g, deep.id).ok).toBe(false);
  });

  it('unlocks several positions', () => {
    const g = game('ST');
    const p = maxed(g);
    const roles = allNodes(p).filter((n) => n.kind === 'position' && n.parents.length === 0);
    expect(roles.length).toBeGreaterThanOrEqual(2);
    for (const n of roles) expect(unlockNode(g, n.id).ok).toBe(true);
    expect(rolesOf(p).length).toBe(1 + roles.length);
  });

  it('holds weak foot stars, one at a time', () => {
    const g = game('ST');
    const p = maxed(g);
    expect(p.weakFoot).toBe(2);
    const stars = allNodes(p).filter((n) => n.kind === 'foot');
    expect(stars.length).toBe(3);
    expect(unlockNode(g, stars[1].id).ok).toBe(false);
    expect(unlockNode(g, stars[0].id).ok).toBe(true);
    expect(p.weakFoot).toBe(3);
  });

  it('a stat node adds to the attribute, once', () => {
    const g = game('ST');
    const p = maxed(g);
    p.attrs.physical = 80;
    const n = allNodes(p).find((x) => x.kind === 'stat' && x.parents.length === 0 && x.attr === 'physical')!;
    expect(unlockNode(g, n.id).ok).toBe(true);
    expect(p.attrs.physical).toBe(81);
    expect(unlockNode(g, n.id).ok).toBe(false);
  });
});

describe('skill moves', () => {
  it('cost money and take weeks, one at a time', () => {
    const g = game('ST');
    const p = maxed(g);
    const m = SKILL_MOVES.find((x) => x.stars === 2)!;
    const other = SKILL_MOVES.find((x) => x.stars === 1)!;
    g.career!.money = 0;
    expect(startMove(g, m.id).ok).toBe(false);
    g.career!.money = 1_000_000;
    const points = g.career!.skillPoints;
    expect(startMove(g, m.id).ok).toBe(true);
    expect(g.career!.skillPoints).toBe(points);
    expect(g.career!.money).toBe(1_000_000 - moveFee(m, p));
    expect(startMove(g, other.id).ok).toBe(false);
    for (let w = 0; w < moveWeeks(m) - 1; w++) expect(tickMove(g)).toBeNull();
    expect(p.moves ?? []).not.toContain(m.id);
    expect(tickMove(g)).toBe(m.id);
    expect(p.moves).toContain(m.id);
    expect(g.career!.moveTraining).toBeUndefined();
  });

  it('charge more for harder moves', () => {
    const p = me(game());
    const fees = [1, 2, 3, 4, 5].map((s) => moveFee(SKILL_MOVES.find((m) => m.stars === s)!, p));
    expect([...fees].sort((a, b) => a - b)).toEqual(fees);
  });
});

describe('attribute perks', () => {
  it('physical lowers what a session costs, and energy stays out of 100', () => {
    const g = game('ST');
    const p = me(g);
    p.attrs.physical = 40;
    expect(sessionEnergy(p)).toBe(28);
    p.attrs.physical = 90;
    expect(sessionEnergy(p)).toBe(22);
    g.career!.energy = 100;
    train(g, 'finishing');
    expect(g.career!.energy).toBe(78);
  });

  it('lists what the attributes give him', () => {
    const p = me(game());
    p.attrs.vision = 80;
    p.attrs.pace = 90;
    const lines = perkLines(p).map((l) => l.label);
    expect(lines).toContain('Vision');
    expect(lines).toContain('Pace');
  });
});

describe('old saves', () => {
  it('turn the second position into the list', () => {
    const g = { world: { players: { a: { secondaryRole: 'CB' }, b: {} } } } as never as Record<string, unknown>;
    MIGRATIONS[3](g);
    const players = (g.world as { players: Record<string, { roles?: string[]; secondaryRole?: string }> }).players;
    expect(players.a.roles).toEqual(['CB']);
    expect(players.a.secondaryRole).toBeUndefined();
    expect(players.b.roles).toBeUndefined();
  });
});
