import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { MatchState, PassOutcome, resolveMoment } from '../../src/engine/match';

// What the pass scene showed is what the match counts and the pitch plays.
function passMoment(seed: number, outcome: PassOutcome, kind: 'through' | 'cross' = 'through') {
  const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'CM', seed });
  const s: MatchState = startUserMatch(game)!;
  const me = game.career!.playerId;
  const side = s.home.onPitch.includes(me) ? 'home' : 'away';
  const mate = s[side].onPitch.find((id) => id !== me && game.world.players[id].position === 'FWD')!;
  const other = side === 'home' ? 'away' : 'home';
  const keeperId = s[other].onPitch.find((id) => game.world.players[id].position === 'GK')!;
  s.pending = { kind: 'pass', side, minute: 30, actorId: me, keeperId, bonus: 0, options: [{ playerId: mate, kind, openness: 0.5, threat: 0.28 }] };
  const shotsBefore = s[side].shots;
  resolveMoment(game.world, s, 0.95, mate, undefined, undefined, undefined, undefined, outcome);
  return { s, side, mate, shots: s[side].shots - shotsBefore };
}

describe('pass scenes', () => {
  it('an offside through ball shows the flag and gives no shot', () => {
    const { s, mate, shots } = passMoment(5, 'offside');
    expect(shots).toBe(0);
    expect(s.play?.some((st) => st.act === 'offside' && st.other === mate)).toBe(true);
  });

  it('a cut-out ball gives no shot', () => {
    const { shots } = passMoment(6, 'cut');
    expect(shots).toBe(0);
  });

  it('a ball into his path leads to his shot', () => {
    const { shots, s, mate } = passMoment(7, 'ok');
    expect(shots).toBe(1);
    expect(s.play?.some((st) => st.carrier === mate)).toBe(true);
  });

  it('a good cross is shown as a cross and a header', () => {
    const { s } = passMoment(8, 'ok', 'cross');
    expect(s.play?.some((st) => st.act === 'cross' && st.header)).toBe(true);
  });
});
