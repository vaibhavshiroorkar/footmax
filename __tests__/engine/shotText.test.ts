import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { MatchState, resolveMoment, stepMinute } from '../../src/engine/match';

// Every shot's feed line must say what the pitch then plays: the side of
// the goal, over or wide, a block, a corner.
describe('feed lines match the pitch', () => {
  it('agree on every shot across several matches', () => {
    let checked = 0;
    for (const seed of [3, 11, 19, 27]) {
      const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });
      const s: MatchState = startUserMatch(game)!;
      for (let guard = 0; guard < 200 && !s.finished; guard++) {
        const before = s.events.length;
        if (s.pending) resolveMoment(game.world, s, 0.6, s.pending.options?.[0]?.playerId);
        else if (s.pausedAtHalf) s.pausedAtHalf = false;
        else stepMinute(game.world, s);
        const shot = s.events.slice(before).reverse().find((e) => e.shot);
        if (!shot?.shot || !s.play) continue;
        const end = s.play.find((st) => st.act === 'goal' || st.act === 'save' || st.act === 'miss');
        if (!end) continue;
        const f = shot.shot;
        checked++;
        expect(end.act).toBe(shot.type);
        expect(end.aim).toBe(f.aim);
        const text = shot.text.toLowerCase();
        if (shot.type === 'goal' && !f.penalty) expect(text).toContain(f.aim < 0.5 ? 'left' : 'right');
        if (shot.type === 'miss') {
          if (f.blocker) {
            expect(end.blocker).toBe(f.blocker);
            expect(text).toMatch(/block|wall/);
          } else if (f.over) {
            expect(end.over).toBe(true);
            expect(text).toMatch(/over/);
          } else expect(text).toMatch(/wide/);
        }
        const corner = f.tipped || f.deflected || !!f.blocker;
        expect(end.restart === 'corner').toBe(corner);
        if (corner) expect(text).toContain('corner');
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});
