import { Game, Player } from './types';
import { Rng, clamp } from './rng';
import { careerPlayer } from './career';
import { addMessage } from './inbox';
import { endCareer } from './lifeEvents';

// Morale sits here when nothing is happening.
export const SETTLED_MORALE = 70;
// Below this, week after week, it stops being a bad patch.
const LOW = 30;
const WEEKS_TO_DEPRESSION = 4;
const WEEKS_TO_WALK_AWAY = 12;
const RECOVERED = 45;

// How much his head and legs add to or take off his attributes in a moment.
// A happy, fresh player gains a little. A low, tired one loses a lot more.
export function formShift(p: Pick<Player, 'morale' | 'fitness'>): number {
  return clamp((p.morale - 60) * 0.14 - Math.max(0, 70 - p.fitness) * 0.3, -16, 6);
}

// A week of the career player's state of mind. Weeks of low morale become
// depression. Left alone it ends careers; help and better days lift it.
export function moodWeekly(game: Game, rng: Rng): void {
  const c = game.career;
  if (!c || c.retired) return;
  const p = careerPlayer(game);
  c.lowWeeks = p.morale < LOW ? (c.lowWeeks ?? 0) + 1 : Math.max(0, (c.lowWeeks ?? 0) - 1);
  if (!c.depressed) {
    if (c.lowWeeks < WEEKS_TO_DEPRESSION) return;
    c.depressed = true;
    addMessage(game, 'news', 'You are not yourself', 'Football has stopped being fun, and it has been weeks. This is depression, and it will not lift by itself. Talk to someone: see a therapist on the Life tab.');
    return;
  }
  if (p.morale >= RECOVERED) {
    c.depressed = false;
    c.lowWeeks = 0;
    addMessage(game, 'news', 'Feeling better', 'The fog is lifting. You look forward to training again.');
    return;
  }
  p.morale = clamp(p.morale - 1, 0, 100);
  if (c.lowWeeks >= WEEKS_TO_WALK_AWAY && rng.chance(0.1)) {
    endCareer(game, 'Stepped away from football for the sake of mental health.');
    addMessage(game, 'news', 'Stepping away', `At ${p.age} you decide to stop playing. Nothing matters more than getting well.`);
  }
}
