// Plays seeded matches through the live pitch and prints what a viewer gets:
// match length, moves, caption time and shots at the wrong goal. Moments
// resolve at once and on-ball waits are left out, so a real match runs longer.
// Run with `npm run match-probe`; add a count to change how many matches.
import { newCareerGame, startUserMatch } from '../src/engine/game';
import { chooseMoment, resolveMoment, stepMinute } from '../src/engine/match';
import { teamById } from '../src/engine/lineup';
import { formationSpots } from '../src/engine/play';
import { PL, PitchSim } from '../src/ui/pitchSim';

const DT = 1 / 60;
const BUSY = ['goal', 'save', 'miss', 'moment', 'foul', 'card', 'injury'];
const count = Number(process.argv[2] ?? 12);

const rows: Record<string, number>[] = [];
let finishes = 0;
let wrongGoal = 0;

for (let seed = 101; seed < 101 + count; seed++) {
  const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed });
  const s = startUserMatch(game)!;
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
  let queued: unknown;
  let frames = 0;
  let quiet = 0;
  let busy = 0;
  let moments = 0;
  let moveAt = 0;
  let moveBusy = false;
  let quietTime = 0;
  let busyTime = 0;
  let lastAct: unknown = null;
  let lastCaption = '';
  let captionAt = 0;
  const captions: number[] = [];
  const enqueue = () => {
    if (!s.play || s.play === queued) return;
    queued = s.play;
    if (frames > moveAt) {
      if (moveBusy) busyTime += (frames - moveAt) * DT;
      else quietTime += (frames - moveAt) * DT;
    }
    moveAt = frames;
    moveBusy = s.play.some((x) => BUSY.includes(x.act));
    if (moveBusy) busy++;
    else quiet++;
    sim.enqueue(s.play.map((x) => ({ ...x })));
  };
  for (; frames < 2_000_000 && !s.finished; frames++) {
    if (sim.holding && s.pending) {
      moments++;
      if (s.pending.kind === 'choice') chooseMoment(game.world, s, 'shot');
      resolveMoment(game.world, s, 0.7, s.pending?.options?.[0]?.playerId);
      enqueue();
    } else if (sim.idle()) {
      if (s.minute === 46) sim.halfTime('away');
      stepMinute(game.world, s);
      sync();
      enqueue();
    }
    sim.update(DT);
    const a = sim.act;
    if (a && a !== lastAct) {
      lastAct = a;
      const shooter = a.from ? sim.bodies.get(a.from) : undefined;
      if (shooter && ['goal', 'save', 'miss'].includes(a.step.act)) {
        finishes++;
        const goalY = shooter.side === 'home' ? PL : 0;
        const f = sim.ball.flight;
        if (f && !a.step.blocker && Math.abs(f.ty - goalY) > PL / 2) wrongGoal++;
      }
    }
    if (sim.caption !== lastCaption) {
      if (lastCaption) captions.push((frames - captionAt) * DT);
      lastCaption = sim.caption;
      captionAt = frames;
    }
  }
  captions.sort((x, y) => x - y);
  rows.push({
    seconds: frames * DT,
    quiet,
    busy,
    quietTime,
    busyTime,
    moments,
    goals: s.scorers.length,
    captionMedian: captions[Math.floor(captions.length / 2)],
    captionShort: captions.filter((c) => c < 1).length / captions.length,
  });
}

const mean = (k: string) => rows.reduce((n, r) => n + r[k], 0) / rows.length;
const f = (v: number, d = 2) => v.toFixed(d);
console.log(`${rows.length} matches`);
console.log(`seconds per match   ${f(mean('seconds'), 0)}`);
console.log(`moves               ${f(mean('quiet') + mean('busy'), 0)} (${f(mean('quiet'), 0)} quiet at ${f(mean('quietTime') / mean('quiet'))} s, ${f(mean('busy'), 0)} busy at ${f(mean('busyTime') / mean('busy'))} s)`);
console.log(`moments, goals      ${f(mean('moments'))}, ${f(mean('goals'))}`);
console.log(`caption median      ${f(mean('captionMedian'))} s`);
console.log(`captions under 1 s  ${f(mean('captionShort') * 100, 0)}%`);
console.log(`wrong-goal shots    ${wrongGoal} of ${finishes}`);
