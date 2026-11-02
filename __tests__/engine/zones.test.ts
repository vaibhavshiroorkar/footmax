import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { MatchState, MomentKind, Zone, chooseMoment, resolveMoment, stepMinute } from '../../src/engine/match';
import { Game } from '../../src/engine/types';
import { Role } from '../../src/engine/roles';

// Plays matches for one player in one zone, resolving every moment, and
// counts the kinds of moment he got.
function moments(role: Role, zone: Zone) {
  const counts: Partial<Record<MomentKind, number>> = {};
  for (let seed = 1; seed <= 12; seed++) {
    const game: Game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role, seed });
    const s: MatchState | null = startUserMatch(game);
    if (!s) continue;
    s.zone = zone;
    let guard = 0;
    while (!s.finished && guard++ < 2000) {
      if (s.pending) {
        const k = s.pending.kind;
        counts[k] = (counts[k] ?? 0) + 1;
        if (k === 'choice') chooseMoment(game.world, s, 'shot');
        resolveMoment(game.world, s, 0.7, s.pending?.options?.[0]?.playerId);
      } else stepMinute(game.world, s);
    }
    expect(s.finished).toBe(true);
  }
  return counts;
}

const sum = (c: Partial<Record<MomentKind, number>>, kinds: MomentKind[]) => kinds.reduce((n, k) => n + (c[k] ?? 0), 0);
const DEFENDING: MomentKind[] = ['tackle', 'block', 'clear', 'intercept'];
const ATTACKING: MomentKind[] = ['shot', 'choice', 'dribble', 'header'];

describe('zones', () => {
  it('gives a midfielder in the middle passes and interceptions', () => {
    const c = moments('CM', 'middle');
    expect(c.intercept ?? 0).toBeGreaterThan(0);
    expect(c.pass ?? 0).toBeGreaterThan(0);
  });

  it('gives a defender at the back blocks and clearances', () => {
    const c = moments('CB', 'defend');
    expect((c.block ?? 0) + (c.clear ?? 0)).toBeGreaterThan(0);
    expect(sum(c, DEFENDING)).toBeGreaterThan(sum(c, ATTACKING));
  });

  it('pushing up trades defending moments for attacking ones', () => {
    const back = moments('CM', 'defend');
    const up = moments('CM', 'attack');
    expect(sum(up, ATTACKING)).toBeGreaterThan(sum(back, ATTACKING));
    expect(sum(back, DEFENDING)).toBeGreaterThan(sum(up, DEFENDING));
  });
});
