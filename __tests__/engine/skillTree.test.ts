import { newCareerGame } from '../../src/engine/game';
import { unlockNode } from '../../src/engine/career';
import { nodeState, readyNodes, treeFor } from '../../src/engine/skillTree';

function striker() {
  const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 21 });
  const p = game.world.players[game.career!.playerId];
  for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[k] = 90;
  p.skills = {};
  game.career!.skillPoints = 10;
  return { game, p };
}

describe('skill tree', () => {
  it('unlocks a branch in order', () => {
    const { game, p } = striker();
    const finishing = treeFor(p).find((b) => b.id === 'finishing')!;
    expect(nodeState(p, finishing, 0, 10)).toBe('ready');
    expect(nodeState(p, finishing, 1, 10)).toBe('locked');
    expect(unlockNode(game, 'finishing', 1).ok).toBe(false);
    expect(unlockNode(game, 'finishing', 0).ok).toBe(true);
    expect(nodeState(p, finishing, 1, game.career!.skillPoints)).toBe('ready');
  });

  it('a technique at the end costs its points and is kept', () => {
    const { game, p } = striker();
    for (let i = 0; i < 4; i++) expect(unlockNode(game, 'finishing', i).ok).toBe(true);
    const before = game.career!.skillPoints;
    expect(unlockNode(game, 'finishing', 4).ok).toBe(true);
    expect(p.skills?.fakeshot).toBe(1);
    expect(game.career!.skillPoints).toBe(before - 2);
  });

  it('only offers nodes next in line', () => {
    const { p } = striker();
    const ready = readyNodes(p, 10);
    expect(ready.every((r) => r.index === 0)).toBe(true);
    expect(ready).toHaveLength(3);
  });
});
