import { newCareerGame } from '../../src/engine/game';
import { CASES, equip, equippedItem, openCase, sell } from '../../src/engine/equipment';

function career() {
  const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 31 });
  game.career!.money = 1_000_000;
  return game;
}

describe('cases and equipment', () => {
  it('a case costs its price and gives a piece that is worn if it is better', () => {
    const game = career();
    const p = game.world.players[game.career!.playerId];
    const r = openCase(game, 'gold');
    expect(r.ok).toBe(true);
    expect(game.career!.money).toBe(1_000_000 - CASES.find((c) => c.id === 'gold')!.price);
    const item = r.item!;
    expect(['epic', 'legendary']).toContain(item.rarity);
    expect(equippedItem(game, item.slot)?.id).toBe(item.id);
    expect(p.attrs[item.attr]).toBeGreaterThan(0);
  });

  it('wearing adds the bonus and swapping takes the old one off', () => {
    const game = career();
    const p = game.world.players[game.career!.playerId];
    const a = { id: 'x1', slot: 'boots' as const, name: 'A', rarity: 'rare' as const, attr: 'shooting' as const, bonus: 2 };
    const b = { id: 'x2', slot: 'boots' as const, name: 'B', rarity: 'epic' as const, attr: 'pace' as const, bonus: 3 };
    game.career!.equipment = [a, b];
    const shooting = p.attrs.shooting;
    const pace = p.attrs.pace;
    equip(game, 'x1');
    expect(p.attrs.shooting).toBeCloseTo(Math.min(99, shooting + 2));
    equip(game, 'x2');
    expect(p.attrs.shooting).toBeCloseTo(shooting);
    expect(p.attrs.pace).toBeCloseTo(Math.min(99, pace + 3));
    expect(sell(game, 'x2')).toMatch(/Take it off/);
    expect(sell(game, 'x1')).toMatch(/Sold/);
  });

  it('cannot open a case without the money', () => {
    const game = career();
    game.career!.money = 0;
    expect(openCase(game, 'bronze').ok).toBe(false);
  });
});
