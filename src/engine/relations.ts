import { Game } from './types';
import { Rng, clamp } from './rng';
import { fairWage, fullName, overall, roundMoney, formatMoney } from './player';
import { targetOverall } from './generator';
import { addMessage, hasOpen } from './inbox';
import { careerPlayer } from './careerBase';
import { formAverage } from './lineup';
import { inTransferWindow } from './transfers';

// Career player's standing with clubs. The stored value is a modifier built
// from history (offers turned down, loans, pitches); interest adds ability,
// fame and level on top.

export function relationMod(game: Game, clubId: string): number {
  return game.career?.relations?.[clubId] ?? 0;
}

export function adjustRelation(game: Game, clubId: string, delta: number): void {
  const c = game.career;
  if (!c || !clubId) return;
  c.relations = { ...(c.relations ?? {}), [clubId]: clamp((c.relations?.[clubId] ?? 0) + delta, -100, 100) };
}

// 0..100: how much a club wants the player.
export function clubInterest(game: Game, clubId: string): number {
  const p = careerPlayer(game);
  const club = game.world.clubs[clubId];
  const gap = overall(p) - targetOverall(club.reputation);
  const form = formAverage(p) ?? 6.5;
  return Math.round(clamp(50 + gap * 6 + game.career!.fame * 0.25 + (form - 6.5) * 10 + relationMod(game, clubId) * 0.5, 0, 100));
}

// 0..100: how much the current coach trusts the player.
export function coachTrust(game: Game): number {
  const p = careerPlayer(game);
  if (!p.clubId) return 0;
  const form = formAverage(p) ?? 6.5;
  return Math.round(clamp(55 + (form - 6.6) * 30 + relationMod(game, p.clubId) * 0.5, 0, 100));
}

export function trustLabel(v: number): string {
  if (v >= 80) return 'Key player';
  if (v >= 60) return 'Trusted';
  if (v >= 40) return 'Neutral';
  if (v >= 20) return 'Doubted';
  return 'Out of favour';
}

// Clubs worth pitching to: playable leagues, roughly the player's level.
export function interestedClubs(game: Game, limit = 25): { clubId: string; interest: number }[] {
  const p = careerPlayer(game);
  const ovr = overall(p);
  return Object.values(game.world.clubs)
    .filter((c) => c.leagueId && c.id !== p.clubId && targetOverall(c.reputation) <= ovr + 18 && targetOverall(c.reputation) >= ovr - 14)
    .map((c) => ({ clubId: c.id, interest: clubInterest(game, c.id) }))
    .sort((a, b) => b.interest - a.interest)
    .slice(0, limit);
}

export function canPitch(game: Game): string | null {
  const c = game.career!;
  const p = careerPlayer(game);
  if ((c.pitchCooldown ?? 0) > 0) return `Your agent needs ${c.pitchCooldown} more week(s) before pitching again.`;
  if (p.clubId && !inTransferWindow(game.world.week)) return 'Clubs only listen during transfer windows (weeks 1-5 and 19-22).';
  if (p.loan) return 'You are on loan until the summer.';
  return null;
}

// Your agent offers you to a club. Interest decides the answer.
export function offerSelf(game: Game, clubId: string): string {
  const blocked = canPitch(game);
  if (blocked) return blocked;
  const c = game.career!;
  const p = careerPlayer(game);
  const club = game.world.clubs[clubId];
  c.pitchCooldown = 3;
  const interest = clubInterest(game, clubId);
  // Draw from the world's stream and store where it got to. Seeding from the
  // state plus an offset and writing that back shifted the whole stream.
  const rng = new Rng(game.world.rngState);
  const roll = rng.next();
  const wage = roundMoney(fairWage(p) * rng.range(0.95, 1.2) * (c.items.includes('agent') ? 1.15 : 1));
  const years = rng.int(2, 4);
  game.world.rngState = rng.state;
  if (roll < clamp((interest - 30) / 60, 0.05, 0.9) && !hasOpen(game, 'club-offer')) {
    adjustRelation(game, clubId, 5);
    addMessage(game, 'offer', `${club.name} are interested`, `After your agent's pitch, ${club.name} offer ${fullName(p)} ${formatMoney(wage)} a week for ${years} years.`, {
      type: 'club-offer',
      clubId,
      wage,
      years,
      patience: 1,
      weeksLeft: 2,
      choices: [
        { id: 'accept', label: 'Accept' },
        { id: 'counter', label: 'Ask for more', needsAmount: true },
        { id: 'decline', label: 'Decline' },
      ],
    });
    return `${club.name} like what they hear. Their offer is in your inbox.`;
  }
  adjustRelation(game, clubId, -4);
  return `${club.name} are not interested right now. Improve your form and try again.`;
}

// After each club game: the coach reacts to a bad run.
export function formCheck(game: Game): void {
  const c = game.career!;
  const p = careerPlayer(game);
  if (!p.clubId) return;
  if ((c.formWarnCooldown ?? 0) > 0) c.formWarnCooldown = (c.formWarnCooldown ?? 0) - 1;
  const avg = formAverage(p);
  if (avg === null || (p.form?.length ?? 0) < 3) return;
  if (avg >= 7.3) adjustRelation(game, p.clubId, 2);
  if (avg < 6.2) {
    adjustRelation(game, p.clubId, -2);
    if (!c.formWarnCooldown) {
      c.formWarnCooldown = 5;
      addMessage(game, 'news', 'The coach wants more', `Your last games averaged ${avg.toFixed(1)}. Keep this up and you will lose your place in the team.`);
    }
  }
}
