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
  const kept = steps.filter((st, i) => i === 0 || (kickoff && i === 1) || i >= steps.length - tail || (st.act !== 'pass' && st.act !== 'run'));
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
