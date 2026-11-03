import { Rng } from './rng';

// What a shot did, decided once and then used for both the feed line and
// the pitch, so the words always match the picture.
export type ShotShapeKind = 'driven' | 'curl' | 'low';
export type Pattern = 'through' | 'cross' | 'cutback' | 'build' | 'solo' | 'longshot' | 'corner';

export interface ShotFacts {
  // Across the goal from the shooter's view: 0 his left post, 1 his right.
  // Outside 0..1 is wide.
  aim: number;
  shape: ShotShapeKind;
  header?: boolean;
  penalty?: boolean;
  freekick?: boolean;
  // A miss inside the posts that went over the bar.
  over?: boolean;
  // A save pushed round the post or over: a corner.
  tipped?: boolean;
  // A miss that came off a defender and went behind: a corner.
  deflected?: boolean;
  // Blocked: a player id, 'lane' (whoever stands in the way on the pitch)
  // or 'wall' (a free kick into the wall). Always ends in a corner.
  blocker?: string;
  // How the chance was made, for the assist half of the line.
  pattern?: Pattern;
}

type Names = { p: string; a?: string; k: string; club?: string; d?: string };

const side = (f: ShotFacts) => (f.aim < 0.5 ? 'left' : 'right');
const noun = (f: ShotFacts) => (f.header ? 'header' : f.penalty ? 'penalty' : f.freekick ? 'free kick' : f.shape === 'curl' ? 'curler' : f.shape === 'low' ? 'low shot' : 'shot');

function fill(text: string, v: Names): string {
  return text
    .split('{p}').join(v.p)
    .split('{a}').join(v.a ?? '')
    .split('{k}').join(v.k)
    .split('{club}').join(v.club ?? '')
    .split('{d}').join(v.d ?? 'a defender');
}

// The build-up half: only says what the pitch shows.
function setUp(rng: Rng, f: ShotFacts, v: Names): string {
  if (f.penalty || f.freekick) return '';
  if (f.pattern === 'corner') return 'From the corner, ';
  if (!v.a) return '';
  switch (f.pattern) {
    case 'through':
      return rng.pick(['{a} slides it through. ', '{a} splits the defence. ']);
    case 'cross':
      return rng.pick(['{a} whips in a cross. ', '{a} crosses from wide. ']);
    case 'cutback':
      return '{a} cuts it back. ';
    default:
      return rng.pick(['Lovely ball from {a}. ', '{a} finds him. ']);
  }
}

export function goalLine(rng: Rng, f: ShotFacts, v: Names): string {
  const s = side(f);
  let finish: string;
  if (f.header) finish = rng.pick([`{p} heads it into the ${s} corner!`, `{p} rises highest and nods it in, ${s} side!`]);
  else if (f.penalty) finish = rng.pick([`{p} sends {k} the wrong way. Penalty scored, ${s} side!`, `{p} tucks the penalty into the ${s} corner.`]);
  else if (f.freekick)
    finish = f.shape === 'curl' ? `{p} curls the free kick round the wall into the ${s} corner!` : f.shape === 'low' ? `{p} drills the free kick under the wall and in!` : `{p} smashes the free kick over the wall and in!`;
  else if (f.shape === 'curl') finish = rng.pick([`{p} curls it into the ${s} corner!`, `{p} bends one round {k}, ${s} corner!`]);
  else if (f.shape === 'low') finish = rng.pick([`{p} drills it low into the ${s} corner!`, `{p} keeps it down and finds the bottom ${s} corner.`]);
  else finish = rng.pick([`{p} smashes it into the ${s} side of the net!`, `{p} drives it past {k}, ${s} side!`]);
  return fill(setUp(rng, f, v) + finish, v);
}

export function saveLine(rng: Rng, f: ShotFacts, v: Names): string {
  const n = noun(f);
  if (f.tipped) return fill(f.header ? `{k} tips {p}'s header over the bar. Corner.` : `{k} tips {p}'s ${n} round the post. Corner.`, v);
  if (f.penalty) return fill(`{k} saves the penalty from {p}!`, v);
  if (Math.abs(f.aim - 0.5) < 0.12) return fill(`{p}'s ${n} is straight at {k}.`, v);
  return fill(rng.pick([`{k} gets across to save {p}'s ${n}.`, `{k} keeps out {p}'s ${n} to the ${side(f)}.`]), v);
}

export function missLine(rng: Rng, f: ShotFacts, v: Names): string {
  const n = noun(f);
  if (f.blocker === 'wall') return fill(`{p}'s free kick hits the wall. Corner.`, v);
  if (f.blocker) return fill(f.blocker === 'lane' ? `{p}'s ${n} is blocked. Corner.` : `{d} blocks {p}'s ${n}. Corner.`, v);
  if (f.over) return fill(f.header ? `{p} heads it over the bar.` : f.penalty ? `{p} blazes the penalty over!` : rng.pick([`{p} blazes it over the bar.`, `{p}'s ${n} flies over.`]), v);
  const verb = f.header ? 'heads' : f.shape === 'curl' ? 'curls' : f.shape === 'low' ? 'drags' : 'fires';
  const wide = f.penalty ? `{p} puts the penalty wide of the ${side(f)} post!` : `{p} ${verb} it wide of the ${side(f)} post.`;
  return fill(wide + (f.deflected ? ' Off a defender, corner.' : ''), v);
}
