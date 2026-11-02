import { Rng } from './rng';

const LINES = {
  goal: [
    '{p} fires it home! {club} score.',
    'GOAL! {p} finishes coolly past the keeper.',
    '{p} finds the bottom corner. What a finish!',
    'It is in! {p} keeps calm and scores for {club}.',
    '{p} smashes it into the roof of the net!',
  ],
  goalAssist: [
    '{a} picks out {p}, who scores! {club} lead the way.',
    'Lovely ball from {a}, and {p} buries it.',
    '{a} slides it through, {p} makes no mistake.',
  ],
  save: [
    '{p} shoots, but {k} makes a fine save.',
    '{k} gets down well to stop {p}.',
    'Good effort from {p}, tipped away by {k}.',
  ],
  miss: [
    '{p} drags a shot wide.',
    '{p} lifts it over the bar.',
    'Half chance for {p}, but it flies off target.',
    '{p} snatches at it and misses.',
  ],
  blocked: ['{p} shoots, but it is blocked.', 'A defender throws himself in front of {p}.'],
  penaltyGoal: ['{p} steps up... and scores the penalty!', 'Penalty converted by {p}. No chance for {k}.'],
  penaltyMiss: ['{k} saves the penalty from {p}!', '{p} puts the penalty wide!'],
  headerGoal: ['{p} rises highest and heads it in!', 'Bullet header from {p}! {club} score.', '{p} glances the cross into the corner!'],
  headerMiss: ['{p} gets his head to it, but it goes over.', '{p} meets the cross but heads wide.'],
  freekickGoal: ['{p} curls the free kick over the wall and in!', 'Free kick from {p}... it nestles in the top corner!'],
  freekickMiss: ['{p} hits the wall with the free kick.', 'The free kick from {p} sails over.'],
  dribbleFail: ['{p} tries to go past his man but loses it.', '{p} is crowded out and the move breaks down.'],
  passFail: ['{p} tries the pass but it is cut out.', 'Loose ball from {p}, and the chance is gone.'],
  yellow: ['{p} goes into the book for a late tackle.', 'Yellow card for {p}.'],
  red: ['Red card! {p} is sent off.', '{p} sees red after a reckless challenge!'],
  injury: ['{p} is down injured and needs treatment.', '{p} pulls up holding his leg.'],
  sub: ['Substitution for {club}: {p} on, {o} off.'],
  quiet: [
    '{club} keep the ball well in midfield.',
    'Patient build-up from {club}.',
    '{club} press high, looking for a mistake.',
    'A scrappy spell in midfield.',
  ],
};

export type LineKind = keyof typeof LINES;

export function line(rng: Rng, kind: LineKind, vars: Record<string, string>): string {
  let text = rng.pick(LINES[kind]);
  for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(v);
  return text;
}
