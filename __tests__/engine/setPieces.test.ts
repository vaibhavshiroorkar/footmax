import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { KeyMoment, MatchState, chooseMoment, resolveMoment, stepMinute } from '../../src/engine/match';
import { judgeHeader } from '../../src/engine/contact';
import { Rng } from '../../src/engine/rng';

function moments(seeds: number[]) {
  const seen: KeyMoment[] = [];
  for (const seed of seeds) {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });
    const s: MatchState | null = startUserMatch(game);
    if (!s) continue;
    for (let g = 0; g < 3000 && !s.finished; g++) {
      if (s.pending) {
        seen.push({ ...s.pending });
        if (s.pending.kind === 'choice') chooseMoment(game.world, s, s.pending.choices?.[0] ?? 'shot');
        resolveMoment(game.world, s, 0.7, s.pending?.options?.[0]?.playerId);
      } else stepMinute(game.world, s);
    }
    expect(s.finished).toBe(true);
  }
  return seen;
}

describe('corners', () => {
  const seen = moments([81, 82, 83, 84, 85, 86, 87, 88]);

  it('give the user a choice of where to be, or the corner to take', () => {
    const corners = seen.filter((m) => m.corner);
    expect(corners.length).toBeGreaterThan(0);
    for (const m of corners) {
      expect(m.setPiece).toBe(true);
      if (m.kind === 'choice') expect(m.choices).toEqual(['header', 'shot']);
      else expect(m.kind).toBe('pass');
    }
  });

  it('a waiting man shoots from the edge of the box', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 90 });
    const s = startUserMatch(game)!;
    s.pending = { side: 'home', minute: 10, keeperId: s.away.onPitch[0], actorId: s.home.onPitch[9], bonus: 0, kind: 'choice', choices: ['header', 'shot'], corner: true, setPiece: true };
    chooseMoment(game.world, s, 'shot');
    expect(s.pending?.kind).toBe('shot');
    expect(s.pending?.view).toBe('outside');
  });
});

describe('going up for a header', () => {
  const rng = new Rng(5);
  const rand = () => rng.next();
  const rate = (o: Partial<Parameters<typeof judgeHeader>[0]>) => {
    let won = 0;
    for (let i = 0; i < 1500; i++) if (judgeHeader({ timing: 0.02, window: 0.1, rightLane: true, air: 70, marker: 0.5, rand, ...o }).contact) won++;
    return won / 1500;
  };

  it('rewards the right run and a good jump', () => {
    expect(rate({})).toBeGreaterThan(rate({ rightLane: false }));
    expect(rate({ timing: 0.3 })).toBe(0);
  });

  it('lets height and strength win the ball', () => {
    expect(rate({ air: 95, timing: 0.1 })).toBeGreaterThan(rate({ air: 40, timing: 0.1 }));
  });

  it('a strong marker wins more', () => {
    expect(rate({ marker: 0.3, timing: 0.1 })).toBeGreaterThan(rate({ marker: 0.75, timing: 0.1 }));
  });
});
