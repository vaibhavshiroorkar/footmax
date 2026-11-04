import { Game } from './types';
import { moodWeekly } from './mood';
import { nightOutRisk } from './perks';
import { Rng, clamp } from './rng';
import { careerPlayer, gainFame } from './careerBase';
import { addMessage } from './inbox';
import { fullName } from './player';

// Life off the pitch has consequences. Arrests bring bans and, in the end,
// jail; bribes can come out years later; injuries can end a career.

export function lifeOf(game: Game): { arrests: number; bribes: number; partner?: string } {
  const c = game.career!;
  c.life = c.life ?? { arrests: 0, bribes: 0 };
  return c.life;
}

// The career ends here, not by choice. The career-over screen gives why.
export function endCareer(game: Game, reason: string): void {
  const c = game.career!;
  const p = careerPlayer(game);
  c.retired = true;
  c.endReason = reason;
  p.retired = true;
}

// Arrested after a night out: a fine, a ban and lost fame. A third arrest
// means jail, and that is the end of the career.
export function arrest(ctx: { game: Game }): string {
  // A cool head talks his way out of some of them.
  const me = ctx.game.world.players[ctx.game.career?.playerId ?? ''];
  if (me && Math.random() > nightOutRisk(me)) return 'It nearly got out of hand, but you kept your head and walked away.';
  const game = ctx.game;
  const c = game.career!;
  const p = careerPlayer(game);
  const life = lifeOf(game);
  life.arrests++;
  if (life.arrests >= 3) {
    endCareer(game, 'Jailed after a third arrest. The career is over.');
    return 'Arrested again. This time the judge sends you to prison. Your career is over.';
  }
  const ban = 2 + life.arrests * 2;
  p.suspendedWeeks = Math.max(p.suspendedWeeks ?? 0, ban);
  c.money = Math.max(0, c.money - 10000);
  c.fame = clamp(c.fame - 6, 0, 100);
  p.morale = clamp(p.morale - 10, 0, 100);
  return `Arrested. A $10K fine and a ${ban}-week ban from the club. ${life.arrests === 2 ? 'One more and it is prison.' : 'The papers love it.'}`;
}

// Each week: an old bribe may come out, and an old body may give way.
export function lifeWeekly(game: Game, rng: Rng): void {
  const c = game.career;
  if (!c || c.retired) return;
  const p = careerPlayer(game);
  const life = lifeOf(game);
  moodWeekly(game, rng);
  if (c.retired) return;
  if (life.bribes > 0 && rng.chance(0.015 * life.bribes)) {
    if (life.bribes >= 3) {
      endCareer(game, 'Banned for life for match fixing.');
      addMessage(game, 'news', 'Banned for life', `An investigation finds ${fullName(p)} took money to fix matches. The federation bans him from football for life.`);
      return;
    }
    p.suspendedWeeks = Math.max(p.suspendedWeeks ?? 0, 12);
    c.fame = clamp(c.fame - 15, 0, 100);
    life.bribes = 0;
    addMessage(game, 'news', 'Caught: match fixing', `Papers reveal ${fullName(p)} took cash to get booked. A 12-week ban, and the fans turn on him.`);
  }
  // Rare, worse with age: an injury that ends it all.
  const risk = p.age >= 34 ? 0.004 : p.age >= 31 ? 0.0015 : 0.0003;
  if (p.stats.apps > 0 && rng.chance(risk)) {
    endCareer(game, 'A career-ending injury.');
    addMessage(game, 'news', 'Career-ending injury', `Scans show the damage is too great. At ${p.age}, ${fullName(p)} has to retire.`);
    return;
  }
  // Good news now and then: the fame is worth something.
  if (c.fame >= 40 && rng.chance(0.01)) {
    gainFame(c, 2);
    c.money += 5000;
    addMessage(game, 'news', 'A fan favourite', 'A local mural of you goes viral, and a brand sends a $5K thank-you.');
  }
}
