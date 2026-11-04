import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { MatchState, MomentKind, ShoutKind, chooseMoment, resolveMoment, shout, stepMinute } from '../../src/engine/match';
import { moveToShow, stepWatched, trimMove } from '../../src/engine/pace';
import { PlayStep } from '../../src/engine/play';
import { CAPTION_HOLD, CaptionQueue } from '../../src/ui/captions';

function play(seed: number, step: (g: ReturnType<typeof newCareerGame>, s: MatchState) => void) {
  const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });
  const s = startUserMatch(game)!;
  let guard = 0;
  while (!s.finished && guard++ < 3000) {
    if (s.pending) {
      if (s.pending.kind === 'choice') chooseMoment(game.world, s, 'shot');
      resolveMoment(game.world, s, 0.7, s.pending?.options?.[0]?.playerId);
    } else step(game, s);
  }
  return s;
}

describe('the watched clock', () => {
  it('never changes a result', () => {
    for (const seed of [31, 32, 33, 34]) {
      const plain = play(seed, (g, s) => stepMinute(g.world, s));
      let t = 0;
      const watched = play(seed, (g, s) => stepWatched(g.world, s, (t += 9)));
      expect([watched.home.goals, watched.away.goals]).toEqual([plain.home.goals, plain.away.goals]);
      expect(watched.events.map((e) => e.text)).toEqual(plain.events.map((e) => e.text));
    }
  });

  it('shows every shot and card, and folds only quiet minutes', () => {
    let t = 0;
    const seen: PlayStep[] = [];
    const s = play(35, (g, m) => {
      const before = m.events.filter((e) => e.type === 'goal').length;
      stepWatched(g.world, m, (t += 30));
      const goals = m.events.filter((e) => e.type === 'goal').length;
      const steps = moveToShow(m) ?? [];
      seen.push(...steps);
      if (goals > before) expect(steps.some((st) => st.act === 'goal')).toBe(true);
    });
    expect(s.finished).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
  });

  it('keeps the start and the finish of a long move', () => {
    const at = { x: 0.5, y: 0.5, side: 'home' as const };
    const steps: PlayStep[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((carrier) => ({ ...at, carrier, act: 'pass' }));
    steps.push({ ...at, carrier: 'f', act: 'run' }, { ...at, carrier: null, act: 'goal' });
    const out = trimMove(steps);
    expect(out.length).toBeLessThan(steps.length);
    expect(out[0].carrier).toBe('a');
    expect(out[out.length - 1].act).toBe('goal');
  });

  it('plays a dropped pass to the man who runs on with the ball', () => {
    const at = { x: 0.5, y: 0.5, side: 'home' as const };
    const out = trimMove([
      { ...at, carrier: 'a', act: 'start' },
      { ...at, carrier: 'b', act: 'pass' },
      { ...at, carrier: 'c', act: 'pass' },
      { ...at, carrier: 'c', act: 'run' },
      { ...at, carrier: 'd', act: 'pass' },
      { ...at, carrier: null, act: 'miss' },
    ], 3);
    expect(out[1]).toMatchObject({ carrier: 'c', act: 'pass' });
  });
});

describe('captions', () => {
  it('holds each line long enough to read', () => {
    const q = new CaptionQueue();
    const shown: { text: string; at: number }[] = [];
    let last = '';
    for (let i = 0; i < 2000; i++) {
      const now = i / 60;
      if (i % 30 === 0) q.offer(`Pass number ${i}`, now);
      const text = q.read(now);
      if (text !== last) shown.push({ text, at: now });
      last = text;
    }
    for (let i = 1; i < shown.length; i++) expect(shown[i].at - shown[i - 1].at).toBeGreaterThanOrEqual(CAPTION_HOLD - 0.02);
  });

  it('lets a goal cut straight in and a shot jump the small lines', () => {
    const q = new CaptionQueue();
    q.offer('A picks it up', 0);
    expect(q.read(CAPTION_HOLD)).toBe('A picks it up');
    q.offer('B drives forward', 2);
    q.offer('C shoots!', 2.1);
    q.offer('D picks it up', 2.2);
    expect(q.read(3.3)).toBe('C shoots!');
    q.offer('GOAL! C', 3.4);
    expect(q.read(3.4)).toBe('GOAL! C');
  });
});

describe('calls', () => {
  const count = (kind: ShoutKind | null) => {
    const c: Partial<Record<MomentKind, number>> = {};
    for (let seed = 41; seed <= 58; seed++) {
      const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'CAM', seed });
      const s = startUserMatch(game);
      if (!s) continue;
      let guard = 0;
      while (!s.finished && guard++ < 3000) {
        if (s.pending) {
          const k = s.pending.kind === 'choice' ? 'shot' : s.pending.kind;
          c[k] = (c[k] ?? 0) + 1;
          if (s.pending.kind === 'choice') chooseMoment(game.world, s, 'shot');
          resolveMoment(game.world, s, 0.7, s.pending?.options?.[0]?.playerId);
        } else {
          if (kind) shout(game.world, s, kind);
          stepMinute(game.world, s);
        }
      }
    }
    return c;
  };

  it('Call for it brings more passes, Make a run more shots', () => {
    const call = count('call');
    const run = count('run');
    expect(call.pass ?? 0).toBeGreaterThan(run.pass ?? 0);
    const attacking = (c: typeof run) => (c.shot ?? 0) + (c.header ?? 0) + (c.dribble ?? 0);
    expect(attacking(run)).toBeGreaterThan(attacking(call));
  });
});
