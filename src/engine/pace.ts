import { MatchState, stepMinute } from './match';
import { PlayAct, PlayStep, Positions } from './play';
import { World } from './types';

// The match clock and the pitch run at different speeds. The engine still
// plays every minute in order, so a result never depends on watching. This
// only decides how much of it the pitch shows: runs of quiet minutes fold into
// one ball, and long build-ups lose their middle.

// Pitch seconds per match minute at 1x.
export const MINUTE_SECONDS = 1.63;
// The most quiet minutes one fold can swallow, so the clock never leaps.
const MAX_FOLD = 6;
// Steps kept at the end of a move, the finish included. Chances keep more of
// their build-up than a quiet minute does.
const TAIL = 2;
const QUIET_TAIL = 1;
// The longest pass a cut may leave, in metres. Longer ones keep a middle touch.
const LONG_GAP = 40;
const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot((a.x - b.x) * 68, (a.y - b.y) * 105);

const BIG: PlayAct[] = ['goal', 'save', 'miss', 'moment', 'card', 'injury', 'brawl'];

// A chance or a card, or the ball ending at the user's feet, where he can act.
function matters(s: MatchState, steps: PlayStep[]): boolean {
  return steps.some((st) => BIG.includes(st.act)) || (!!s.focus.playerId && steps[steps.length - 1]?.carrier === s.focus.playerId);
}

// Drops passes and runs from the middle of a move. A run whose man lost the
// pass that reached him gets the ball played to him instead.
export function trimMove(steps: PlayStep[], tail = TAIL): PlayStep[] {
  if (steps.length <= tail + 1) return steps;
  const kickoff = steps[0].restart === 'kickoff';
  const keep = steps.map((st, i) => i === 0 || (kickoff && i === 1) || i >= steps.length - tail || (st.act !== 'pass' && st.act !== 'run'));
  // A cut that would leave a pass over LONG_GAP metres keeps the dropped
  // touch nearest its middle, so the ball goes along the ground in two
  // passes instead of one long ball nobody played.
  let prev = 0;
  for (let i = 1; i < steps.length; i++) {
    if (!keep[i]) continue;
    if (steps[i].act === 'pass' && gap(steps[prev], steps[i]) > LONG_GAP) {
      const mid = { x: (steps[prev].x + steps[i].x) / 2, y: (steps[prev].y + steps[i].y) / 2 };
      let best = -1;
      for (let j = prev + 1; j < i; j++) {
        if (steps[j].side !== steps[i].side || !steps[j].carrier) continue;
        if (best < 0 || gap(steps[j], mid) < gap(steps[best], mid)) best = j;
      }
      if (best >= 0) keep[best] = true;
    }
    prev = i;
  }
  const kept = steps.filter((_, i) => keep[i]);
  let holder = kept[0].carrier;
  return kept.map((st, i) => {
    const out = i > 0 && st.act === 'run' && st.carrier !== holder ? { ...st, act: 'pass' as const } : st;
    if (st.carrier) holder = st.carrier;
    return out;
  });
}

// How the ball gets from the last move shown to where the folded minutes left
// it: one ball to the man who ended up with it, or the stoppage itself.
function bridge(end: PlayStep): PlayStep[] {
  if (end.act === 'foul') return end.other ? [{ x: end.x, y: end.y, carrier: end.other, side: end.side, act: 'pass' }, end] : [end];
  if (end.restart) return [end];
  return end.carrier ? [{ x: end.x, y: end.y, carrier: end.carrier, side: end.side, act: 'pass' }] : [];
}

// Plays the next minute for the pitch, running on through quiet minutes while
// the clock is behind. seconds: how long the pitch has been playing at 1x.
// bodies: where the pitch has everyone, so a move starts from the real picture.
export function stepWatched(world: World, s: MatchState, seconds: number, bodies?: Positions): void {
  const target = seconds / MINUTE_SECONDS;
  s.bodies = bodies;
  let folded = 0;
  let last: PlayStep | undefined;
  let before = s.play;
  for (;;) {
    stepMinute(world, s);
    if (s.finished || s.pausedAtHalf || !s.play || s.play === before) return;
    const steps = s.play;
    if (s.pending || matters(s, steps) || s.minute >= target || folded >= MAX_FOLD || steps[0]?.restart === 'kickoff') break;
    folded++;
    last = steps[steps.length - 1];
    before = steps;
  }
  s.shown = { of: s.play, steps: [...(last ? bridge(last) : []), ...trimMove(s.play, s.play.some((st) => BIG.includes(st.act)) ? TAIL : QUIET_TAIL)] };
}

// The move the pitch should play right now.
export function moveToShow(s: MatchState): PlayStep[] | undefined {
  return s.shown?.of === s.play ? s.shown?.steps : s.play;
}
