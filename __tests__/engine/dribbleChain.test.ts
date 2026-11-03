import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { MatchState, chooseMoment, resolveMoment } from '../../src/engine/match';

// Beating your man gives a choice; beating a second man makes it bigger.
function dribbleMoment(seed: number) {
  const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });
  const p = game.world.players[game.career!.playerId];
  p.attrs.dribbling = 99;
  const s: MatchState = startUserMatch(game)!;
  const side = s.home.onPitch.includes(p.id) ? 'home' : 'away';
  const other = side === 'home' ? 'away' : 'home';
  const keeperId = s[other].onPitch.find((id) => game.world.players[id].position === 'GK')!;
  s.pending = { kind: 'dribble', side, minute: 20, actorId: p.id, keeperId, bonus: 0 };
  return { game, s };
}

describe('after beating your man', () => {
  it('chooses what comes next, and a second man pays more', () => {
    let checked = false;
    for (let seed = 1; seed < 40 && !checked; seed++) {
      const { game, s } = dribbleMoment(seed);
      resolveMoment(game.world, s, 1);
      if (s.pending?.kind !== 'choice') continue;
      expect(s.pending.beaten).toBe(1);
      expect(s.pending.choices).toEqual(['shot', 'pass', 'dribble']);
      const first = s.pending.bonus;
      chooseMoment(game.world, s, 'dribble');
      expect(s.pending?.kind).toBe('dribble');
      resolveMoment(game.world, s, 1);
      if (s.pending?.kind !== 'choice') continue;
      expect(s.pending.beaten).toBe(2);
      expect(s.pending.choices).toEqual(['shot', 'pass']);
      expect(s.pending.bonus).toBeGreaterThan(first);
      chooseMoment(game.world, s, 'shot');
      expect(s.pending?.view).toBe('oneonone');
      checked = true;
    }
    expect(checked).toBe(true);
  });
});
