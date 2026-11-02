import { newCareerGame, startUserMatch } from '../../src/engine/game';
import { MatchState, chooseMoment, resolveMoment, stepMinute } from '../../src/engine/match';
import { teamById } from '../../src/engine/lineup';
import { PlayStep, formationSpots } from '../../src/engine/play';
import { Game } from '../../src/engine/types';
import { PL, PW, PitchSim, inBox } from '../../src/ui/pitchSim';

const DEBUG = !!process.env.RULES_DEBUG;

// Plays whole matches through the live pitch and checks the laws of the
// game frame by frame: everyone on the pitch, keepers in their area, each
// side in its own half at kick-off, opponents back at set pieces,
// attackers onside when the ball is played to them, and every card shown.
function referee(seed: number) {
  const game: Game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'CM', seed });
  const s: MatchState = startUserMatch(game)!;
  const sim = new PitchSim();
  const sync = () =>
    sim.sync(
      (['home', 'away'] as const).flatMap((side) => {
        const team = teamById(game.world, s[side].clubId);
        const spots = formationSpots(game.world, team, s[side].onPitch);
        return s[side].onPitch.map((id) => ({ id, side, spot: spots[id], pos: game.world.players[id].position, pace: game.world.players[id].attrs.pace, name: id }));
      }),
    );
  sync();
  const starters = new Set(sim.bodies.keys());
  const stats = { frames: 0, outOfBounds: 0, keeperOut: 0, kickoffs: 0, kickoffBad: 0, setPieces: 0, setPieceBad: 0, passes: 0, offside: 0, cardSteps: 0, cardsShown: 0, corners: 0 };
  let queued: PlayStep[] | undefined;
  const enqueue = () => {
    if (s.play && s.play !== queued) {
      queued = s.play;
      stats.cardSteps += s.play.filter((x) => x.act === 'card').length;
      sim.enqueue(s.play.map((x) => ({ ...x })));
    }
  };
  let lastAct: PlayStep | null = null;
  let lastCallout: unknown = null;
  for (let frame = 0; frame < 80000 && !s.finished; frame++) {
    if (sim.holding && s.pending) {
      if (s.pending.kind === 'choice') chooseMoment(game.world, s, s.pending.choices?.[0] ?? 'shot');
      resolveMoment(game.world, s, 0.6, s.pending?.options?.[0]?.playerId);
      enqueue();
    } else if (sim.idle()) {
      if (s.minute === 46) sim.halfTime('away');
      stepMinute(game.world, s);
      sync();
      enqueue();
    }
    const before = sim.act?.step ?? null;
    const restartTaken = before?.act === 'start' && before.restart && before.restart !== 'kickoff' ? before : null;
    const kickoff = before?.act === 'start' && before.restart === 'kickoff' ? before : null;
    const tBefore = sim.act?.t ?? 0;
    const stageBefore = sim.act?.stage ?? 0;
    sim.update(0.05);
    stats.frames++;
    const now = sim.act?.step ?? null;
    const bodies = sim.active();
    for (const b of bodies) {
      if (b.x < -2 || b.x > PW + 2 || b.y < -1.5 || b.y > PL + 1.5) stats.outOfBounds++;
    }
    // Keepers stay in their area unless the move is about them.
    const step = sim.act?.step;
    // A keeper coming on as a sub jogs in from halfway: not wandering.
    for (const k of bodies.filter((b) => b.pos === 'GK' && starters.has(b.id))) {
      const busy = step && (step.carrier === k.id || step.other === k.id || sim.act?.keeperId === k.id || sim.ball.owner === k.id);
      if (!busy && sim.layout === 'play' && !inBox({ x: k.x, y: k.y + (k.side === 'home' ? -1.5 : 1.5) }, k.side)) {
        stats.keeperOut++;
        if (DEBUG && stats.keeperOut % 40 === 1) console.log('KEEPER', k.side, k.x.toFixed(1), k.y.toFixed(1), step?.act, step?.restart, 'prev', lastAct?.act, 'owner', sim.ball.owner === k.id);
      }
    }
    // The moment a kick-off is taken.
    if (kickoff && now !== kickoff) {
      stats.kickoffs++;
      const bad = bodies.some((b) => {
        if (b.id === kickoff.carrier) return false;
        const ownHalf = b.side === 'home' ? b.y <= PL / 2 + 1 : b.y >= PL / 2 - 1;
        const outsideCircle = b.side === kickoff.side || Math.hypot(b.x - PW / 2, b.y - PL / 2) >= 8.5;
        return !ownHalf || !outsideCircle;
      });
      if (bad) {
        stats.kickoffBad++;
        if (DEBUG) console.log('KICKOFF', kickoff.side, 't', tBefore.toFixed(2), 'carrier', !!sim.bodies.get(kickoff.carrier ?? ''), 'minute', s.minute, bodies.filter((b) => b.id !== kickoff.carrier && (!(b.side === 'home' ? b.y <= PL / 2 + 1 : b.y >= PL / 2 - 1) || (b.side !== kickoff.side && Math.hypot(b.x - PW / 2, b.y - PL / 2) < 8.5))).map((b) => `${b.side}:${b.pos}:${b.x.toFixed(1)},${b.y.toFixed(1)} target ${JSON.stringify(sim.targetFor(b as never))} v ${b.vx.toFixed(2)},${b.vy.toFixed(2)} down ${b.down} layout ${sim.layout} kickoffSide ${sim.kickoffSide} sp ${sim.setPiece?.kind} near ${[...sim.bodies.values()].filter((o) => o !== b && Math.hypot(o.x - b.x, o.y - b.y) < 3).map((o) => `${o.side}:${o.pos}:${o.leaving ? 'LEAVING' : ''}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(';')}`).join(' '));
      }
    }
    // The moment a free kick or corner is taken.
    if (restartTaken && now !== restartTaken && (restartTaken.restart === 'freekick' || restartTaken.restart === 'corner')) {
      stats.setPieces++;
      if (restartTaken.restart === 'corner') stats.corners++;
      const close = bodies.some((b) => b.side !== restartTaken.side && b.pos !== 'GK' && Math.hypot(b.x - sim.ball.x, b.y - sim.ball.y) < 8);
      if (close) {
        stats.setPieceBad++;
        if (DEBUG) console.log('SETPIECE', restartTaken.restart, 't', tBefore.toFixed(2), 'stage', stageBefore, 'next', now?.act, bodies.filter((b) => b.side !== restartTaken.side && b.pos !== 'GK' && Math.hypot(b.x - sim.ball.x, b.y - sim.ball.y) < 8).map((b) => `${b.id === sim.act?.step.carrier ? 'JOB ' : ''}${b.pos} d=${Math.hypot(b.x - sim.ball.x, b.y - sim.ball.y).toFixed(1)} down=${b.down.toFixed(1)}`).join(' | '));
      }
    }
    // A pass to a team-mate: was he onside when it was played?
    if (now && now !== lastAct && now.act === 'pass' && now.carrier && lastAct?.act !== 'start') {
      const r = sim.bodies.get(now.carrier);
      if (r && r.side === now.side) {
        stats.passes++;
        const depth = r.side === 'home' ? r.y : PL - r.y;
        if (depth > sim.offsideLine[r.side] + 2) stats.offside++;
      }
    }
    lastAct = now;
    if (sim.callout !== lastCallout) {
      lastCallout = sim.callout;
      if (sim.callout?.tone === 'yellow' || sim.callout?.tone === 'red') stats.cardsShown++;
    }
  }
  return { s, stats };
}

describe('the laws on the live pitch', () => {
  const runs = [31, 32, 33, 34].map(referee);
  const total = runs.reduce(
    (t, r) => {
      for (const k of Object.keys(r.stats) as (keyof typeof r.stats)[]) t[k] = (t[k] ?? 0) + r.stats[k];
      return t;
    },
    {} as Record<string, number>,
  );

  it('finishes every match', () => {
    for (const r of runs) expect(r.s.finished).toBe(true);
  });

  it('keeps everyone on the pitch and keepers in their area', () => {
    expect(total.outOfBounds).toBe(0);
    expect(total.keeperOut / total.frames).toBeLessThan(0.002);
  });

  it('lines both sides up properly for kick-offs', () => {
    expect(total.kickoffs).toBeGreaterThan(4);
    expect(total.kickoffBad).toBe(0);
  });

  it('keeps opponents back at free kicks and corners, and corners happen', () => {
    expect(total.corners).toBeGreaterThan(0);
    expect(total.setPieceBad / Math.max(1, total.setPieces)).toBeLessThan(0.1);
  });

  it('plays passes to players who are onside', () => {
    expect(total.passes).toBeGreaterThan(100);
    expect(total.offside / total.passes).toBeLessThan(0.03);
  });

  it('shows every card the engine gives', () => {
    expect(total.cardsShown).toBe(total.cardSteps);
  });

  if (DEBUG) console.log(JSON.stringify(total));
});
