import { newCareerGame } from '../../src/engine/game';
import { arrest, lifeOf, lifeWeekly } from '../../src/engine/lifeEvents';
import { available } from '../../src/engine/lineup';
import { Rng } from '../../src/engine/rng';
import { addMessage } from '../../src/engine/inbox';
import { respond } from '../../src/engine/offers';

function career() {
  return newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 41 });
}

describe('life with consequences', () => {
  it('an arrest bans him; a third is prison and the end', () => {
    // A cool head can talk his way out, so take that roll away.
    const roll = jest.spyOn(Math, 'random').mockReturnValue(0);
    const game = career();
    const p = game.world.players[game.career!.playerId];
    arrest({ game });
    expect(p.suspendedWeeks).toBeGreaterThan(0);
    expect(available(p)).toBe(false);
    arrest({ game });
    expect(game.career!.retired).toBe(false);
    arrest({ game });
    expect(game.career!.retired).toBe(true);
    expect(game.career!.endReason).toMatch(/Jail/);
    roll.mockRestore();
  });

  it('taken bribes can come out later', () => {
    const game = career();
    const p = game.world.players[game.career!.playerId];
    lifeOf(game).bribes = 1;
    const rng = new Rng(1);
    for (let i = 0; i < 400 && !(p.suspendedWeeks ?? 0); i++) lifeWeekly(game, rng);
    expect(p.suspendedWeeks).toBeGreaterThan(0);
  });

  it('a life event answer changes his life', () => {
    const game = career();
    const msg = addMessage(game, 'media', 'Someone special', '...', { type: 'media', event: 'romance', choices: [{ id: 'date', label: 'Ask them out' }] });
    respond(game, msg.id, 'date');
    expect(lifeOf(game).partner).toBeTruthy();
  });
});
