import { Club, Game, Player } from './types';
import { Rng, clamp } from './rng';
import { careerPlayer, gainFame } from './careerBase';
import { leagueOf, tablePosition } from './league';
import { squad } from './lineup';
import { managerClub } from './manager';
import { adjustRelation } from './relations';
import { fullName, marketValue } from './player';

// Media and off-pitch events. Each one is its own situation with its own
// answers, picked from what is going on (a big game, a bad one, a rumour,
// the table), and the last few are not repeated.

type Ctx = {
  game: Game;
  rng: Rng;
  // Career: the user's player and his club. Manager: the club he runs.
  me?: Player;
  club?: Club;
  // The club's last league result, if any.
  last?: { result: 'W' | 'D' | 'L'; scored: number; conceded: number; vs: Club };
};

type Answer = { id: string; label: string; effect: (c: Ctx) => string };

type MediaEvent = {
  id: string;
  mode: 'career' | 'manager';
  // Tied to what just happened (a brace, a defeat): picked first.
  topical?: boolean;
  when: (c: Ctx) => boolean;
  title: (c: Ctx) => string;
  body: (c: Ctx) => string;
  answers: Answer[];
};

const morale = (p: Player | undefined, d: number) => p && (p.morale = clamp(p.morale + d, 0, 100));
const fame = (c: Ctx, d: number) => c.game.career && gainFame(c.game.career, d);
const energy = (c: Ctx, d: number) => c.game.career && (c.game.career.energy = clamp(c.game.career.energy + d, 0, 100));
const money = (c: Ctx, d: number) => c.game.career && (c.game.career.money += d);
const board = (c: Ctx, d: number) => c.game.manager && (c.game.manager.boardConfidence = clamp(c.game.manager.boardConfidence + d, 0, 100));
const squadMorale = (c: Ctx, d: number, only?: (p: Player) => boolean) => {
  if (c.club) for (const p of squad(c.game.world, c.club)) if (!only || only(p)) morale(p, d);
};
// A bigger club in the same league, for transfer talk.
const biggerClub = (c: Ctx): Club | undefined => {
  if (!c.club) return undefined;
  const league = leagueOf(c.game.world, c.club.id);
  const others = (league?.clubIds ?? []).map((id) => c.game.world.clubs[id]).filter((x) => x && x.id !== c.club!.id && x.reputation > c.club!.reputation);
  return others.sort((a, b) => b.reputation - a.reputation)[0];
};
const star = (c: Ctx): Player | undefined => (c.club ? [...squad(c.game.world, c.club)].sort((a, b) => marketValue(b) - marketValue(a))[0] : undefined);

const EVENTS: MediaEvent[] = [
  // --- Career ---------------------------------------------------------
  {
    id: 'brace',
    topical: true,
    mode: 'career',
    when: (c) => (c.game.career?.lastMatch?.goals ?? 0) >= 2,
    title: () => 'The talk of the town',
    body: (c) => `Your ${c.game.career!.lastMatch!.goals} goals are all over the highlights. A prime-time show wants you on tonight.`,
    answers: [
      { id: 'team', label: 'Credit the team', effect: (c) => (squadMorale(c, 2), fame(c, 1), 'The dressing room loves it. Team morale up.') },
      { id: 'spotlight', label: 'Enjoy the spotlight', effect: (c) => (fame(c, 5), morale(c.me, -2), 'You light up the studio. Fame up, a few team-mates are not impressed.') },
      { id: 'family', label: 'Dedicate it to family', effect: (c) => (fame(c, 2), morale(c.me, 5), 'A heartfelt moment. Fans warm to you and you feel great.') },
    ],
  },
  {
    id: 'pile-on',
    topical: true,
    mode: 'career',
    when: (c) => (c.game.career?.lastMatch?.played ?? false) && (c.game.career?.lastMatch?.rating ?? 7) < 6,
    title: () => 'Fans on your back',
    body: () => 'After that last game your phone will not stop buzzing. The comments are brutal.',
    answers: [
      { id: 'own', label: 'Own it in public', effect: (c) => (morale(c.me, 3), fame(c, 1), '"I was not good enough. I will fix it." Respect earned.') },
      { id: 'hit', label: 'Hit back at the critics', effect: (c) => (fame(c, 3), morale(c.me, -5), 'It goes viral, but now every touch you take is under a microscope.') },
      { id: 'logoff', label: 'Log off and rest', effect: (c) => (energy(c, 15), morale(c.me, 1), 'A quiet week. You come back fresher.') },
    ],
  },
  {
    id: 'linked',
    mode: 'career',
    when: (c) => !!biggerClub(c),
    title: (c) => `Linked with ${biggerClub(c)!.name}`,
    body: (c) => `Papers say ${biggerClub(c)!.name} are watching you. A reporter catches you outside training.`,
    answers: [
      { id: 'loyal', label: '"I am happy here"', effect: (c) => (adjustRelation(c.game, c.club!.id, 8), morale(c.me, 2), 'Your club like the loyalty.') },
      { id: 'never', label: '"Never say never"', effect: (c) => { const b = biggerClub(c)!; adjustRelation(c.game, b.id, 10); adjustRelation(c.game, c.club!.id, -6); fame(c, 2); return `${b.name} took note. Your own club did too.`; } },
      { id: 'walk', label: 'Walk past', effect: () => 'No comment. The story fades.' },
    ],
  },
  {
    id: 'jibe',
    mode: 'career',
    when: (c) => !!c.last,
    title: (c) => `${c.last!.vs.name} have a go`,
    body: (c) => `A ${c.last!.vs.name} player calls you "overrated" on a podcast. Everyone wants your reply.`,
    answers: [
      { id: 'feet', label: 'Let my feet talk', effect: (c) => (morale(c.me, 4), 'You say nothing and train harder. Morale up.') },
      { id: 'fire', label: 'Fire back', effect: (c) => (fame(c, 4), morale(c.me, -2), 'The clip does numbers. Now you have to back it up.') },
      { id: 'laugh', label: 'Laugh it off', effect: (c) => (fame(c, 1), morale(c.me, 2), 'A cheeky emoji reply. Fans love it.') },
    ],
  },
  {
    id: 'hospital',
    mode: 'career',
    when: () => true,
    title: () => 'Children\'s hospital visit',
    body: () => 'The local children\'s hospital asks if you can visit the ward this week.',
    answers: [
      { id: 'go', label: 'Go in person', effect: (c) => (fame(c, 2), morale(c.me, 6), energy(c, -10), 'The kids lose their minds. Best day of the month.') },
      { id: 'shirt', label: 'Send signed shirts', effect: (c) => (fame(c, 1), morale(c.me, 1), 'A kind gesture. The ward puts them on the wall.') },
      { id: 'busy', label: 'Too busy', effect: (c) => (morale(c.me, -1), 'You stay focused on football.') },
    ],
  },
  {
    id: 'documentary',
    mode: 'career',
    when: (c) => (c.game.career?.fame ?? 0) >= 35,
    title: () => 'A documentary crew',
    body: () => 'A streaming service wants to film your season, at home and at training.',
    answers: [
      { id: 'all', label: 'Let them film it all', effect: (c) => (fame(c, 6), money(c, 20000), energy(c, -15), 'Big money and bigger fame. Cameras everywhere.') },
      { id: 'match', label: 'Matchdays only', effect: (c) => (fame(c, 2), money(c, 5000), 'A smaller deal. Your home stays private.') },
      { id: 'no', label: 'Keep it private', effect: (c) => (morale(c.me, 2), 'You keep your life to yourself.') },
    ],
  },
  {
    id: 'letter',
    mode: 'career',
    when: () => true,
    title: () => 'A letter from a young fan',
    body: () => 'A nine-year-old writes that you are the reason they started playing.',
    answers: [
      { id: 'write', label: 'Write back', effect: (c) => (morale(c.me, 4), fame(c, 1), 'The family posts your reply. It warms a lot of hearts.') },
      { id: 'invite', label: 'Invite them to training', effect: (c) => (morale(c.me, 3), fame(c, 3), energy(c, -5), 'Photos with the whole squad. The club shares it everywhere.') },
    ],
  },
  {
    id: 'boots',
    mode: 'career',
    when: (c) => (c.game.career?.fame ?? 0) >= 20,
    title: () => 'Signature boots?',
    body: () => 'A boot brand wants to design a pair around you, but they want a say in your celebrations.',
    answers: [
      { id: 'sign', label: 'Take the deal', effect: (c) => (money(c, 15000), fame(c, 3), morale(c.me, -2), 'Your own boots. Their marketing team will be in touch. A lot.') },
      { id: 'free', label: 'Only on my terms', effect: (c) => (money(c, 5000), morale(c.me, 2), 'A smaller deal, your celebrations stay yours.') },
      { id: 'pass', label: 'Pass', effect: () => 'You stick with what you know.' },
    ],
  },
  {
    id: 'idol',
    mode: 'career',
    when: () => true,
    title: () => 'Podcast: who was your idol?',
    body: () => 'A football podcast wants the story of how you got here.',
    answers: [
      { id: 'humble', label: 'Talk about the grind', effect: (c) => (morale(c.me, 3), fame(c, 1), 'Honest and real. Listeners love it.') },
      { id: 'bold', label: '"I will be better than him"', effect: (c) => (fame(c, 4), morale(c.me, -2), 'Big words. The clip is everywhere.') },
      { id: 'skip', label: 'Skip it', effect: () => 'You keep your head down.' },
    ],
  },

  // --- Manager --------------------------------------------------------
  {
    id: 'after-loss',
    topical: true,
    mode: 'manager',
    when: (c) => c.last?.result === 'L',
    title: (c) => `After the ${c.last!.conceded}-${c.last!.scored} defeat`,
    body: (c) => `Reporters want answers after losing to ${c.last!.vs.name}.`,
    answers: [
      { id: 'back', label: 'Back the players', effect: (c) => (squadMorale(c, 3), board(c, -1), 'The squad feel protected. The board want results.') },
      { id: 'ref', label: 'Blame the referee', effect: (c) => (squadMorale(c, 1), board(c, -2), 'A fine might follow, but the fans are with you.') },
      { id: 'blame', label: 'Call out the players', effect: (c) => (squadMorale(c, -4), board(c, 3), 'Harsh words. The board like the standards, the dressing room does not.') },
    ],
  },
  {
    id: 'after-win',
    topical: true,
    mode: 'manager',
    when: (c) => c.last?.result === 'W' && c.last.scored - c.last.conceded >= 2,
    title: (c) => `${c.last!.scored}-${c.last!.conceded}. Riding high`,
    body: (c) => `A big win over ${c.last!.vs.name}. The press want a headline.`,
    answers: [
      { id: 'grounded', label: 'Stay grounded', effect: (c) => (squadMorale(c, 2), 'Feet on the ground. The squad stay hungry.') },
      { id: 'title', label: 'Talk up the title', effect: (c) => (board(c, 4), squadMorale(c, -1), 'The board love the ambition. The pressure is on.') },
      { id: 'star', label: 'Praise one player', effect: (c) => { const s = star(c); morale(s, 8); return s ? `${fullName(s)} is flying.` : 'Done.'; } },
    ],
  },
  {
    id: 'top',
    mode: 'manager',
    when: (c) => !!c.club && tablePosition(c.game.world, c.club.id) > 0 && tablePosition(c.game.world, c.club.id) <= 3,
    title: () => 'Title talk',
    body: (c) => `${c.club!.name} are ${ordinal(tablePosition(c.game.world, c.club!.id))}. Can you win it?`,
    answers: [
      { id: 'yes', label: '"Yes. We will."', effect: (c) => (board(c, 5), squadMorale(c, 1), 'Bold. Now deliver.') },
      { id: 'game', label: '"One game at a time"', effect: (c) => (squadMorale(c, 2), 'The cliche works. No extra pressure.') },
    ],
  },
  {
    id: 'bottom',
    mode: 'manager',
    when: (c) => {
      if (!c.club) return false;
      const n = leagueOf(c.game.world, c.club.id)?.clubIds.length ?? 0;
      return n > 0 && tablePosition(c.game.world, c.club.id) > n - 4;
    },
    title: () => 'Is your job on the line?',
    body: (c) => `${c.club!.name} are near the bottom. A reporter asks if you fear the sack.`,
    answers: [
      { id: 'time', label: 'Ask for patience', effect: (c) => (board(c, 2), 'The board give you a little room.') },
      { id: 'promise', label: 'Promise a turnaround', effect: (c) => (board(c, 5), squadMorale(c, -2), 'They will hold you to that.') },
      { id: 'fight', label: 'Rally the fans', effect: (c) => (squadMorale(c, 3), 'The crowd will be loud next week.') },
    ],
  },
  {
    id: 'star-rumour',
    mode: 'manager',
    when: (c) => !!star(c) && !!biggerClub(c),
    title: (c) => `${fullName(star(c)!)} to ${biggerClub(c)!.name}?`,
    body: (c) => `Rumours say ${biggerClub(c)!.name} want your best player. Is he for sale?`,
    answers: [
      { id: 'no', label: '"Not for sale"', effect: (c) => (morale(star(c), 6), `${fullName(star(c)!)} feels wanted.`) },
      { id: 'price', label: '"Everyone has a price"', effect: (c) => (board(c, 3), morale(star(c), -8), `The board like it. ${fullName(star(c)!)} does not.`) },
    ],
  },
  {
    id: 'academy',
    mode: 'manager',
    when: (c) => !!c.club && squad(c.game.world, c.club).some((p) => p.age <= 20),
    title: () => 'What about the kids?',
    body: () => 'Fans want to see academy players. A reporter asks if they will get a chance.',
    answers: [
      { id: 'promise', label: 'Promise them minutes', effect: (c) => (squadMorale(c, 6, (p) => p.age <= 20), 'The youngsters are buzzing.') },
      { id: 'earn', label: '"They must earn it"', effect: (c) => (squadMorale(c, 1, (p) => p.age > 20), 'The senior players nod along.') },
    ],
  },
  {
    id: 'rival-manager',
    mode: 'manager',
    when: (c) => !!c.last,
    title: (c) => `${c.last!.vs.name}'s manager hits out`,
    body: (c) => `The ${c.last!.vs.name} boss says your team "play boring football".`,
    answers: [
      { id: 'scoreboard', label: '"Check the scoreboard"', effect: (c) => (squadMorale(c, 3), board(c, 1), 'The players love it.') },
      { id: 'rise', label: 'Rise above it', effect: (c) => (board(c, 2), 'Classy. The board approve.') },
    ],
  },
];

function ordinal(n: number): string {
  const s = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
  return `${n}${s}`;
}

function context(game: Game, rng: Rng): Ctx {
  const world = game.world;
  const me = game.career ? careerPlayer(game) : undefined;
  const club = (me?.clubId ? world.clubs[me.clubId] : managerClub(game)) ?? undefined;
  let last: Ctx['last'];
  const league = club ? leagueOf(world, club.id) : undefined;
  const f = league?.fixtures.filter((x) => x.played && (x.homeId === club!.id || x.awayId === club!.id)).sort((a, b) => b.week - a.week)[0];
  if (f && club) {
    const home = f.homeId === club.id;
    const scored = home ? f.homeGoals : f.awayGoals;
    const conceded = home ? f.awayGoals : f.homeGoals;
    const vs = world.clubs[home ? f.awayId : f.homeId];
    if (vs) last = { result: scored > conceded ? 'W' : scored < conceded ? 'L' : 'D', scored, conceded, vs };
  }
  return { game, rng, me, club, last };
}

// The events seen lately, newest first, so they are not repeated.
function recent(game: Game): string[] {
  return game.inbox
    .filter((m) => m.action?.type === 'media' && m.action.event)
    .slice(-6)
    .map((m) => m.action!.event!);
}

// Picks a fitting event the user has not seen lately. Ones tied to what
// just happened (a brace, a defeat) come first.
export function pickMediaEvent(game: Game, rng: Rng): { id: string; title: string; body: string; choices: { id: string; label: string }[] } | null {
  const ctx = context(game, rng);
  const mode = game.career ? 'career' : 'manager';
  const seen = recent(game);
  const fits = EVENTS.filter((e) => e.mode === mode && !seen.includes(e.id) && e.when(ctx));
  if (!fits.length) return null;
  const weights = fits.map((e) => (e.topical ? 4 : 1));
  const e = rng.weighted(fits, weights);
  return { id: e.id, title: e.title(ctx), body: e.body(ctx), choices: e.answers.map(({ id, label }) => ({ id, label })) };
}

// Applies an answer. Null when the event is unknown (older saves).
export function answerMediaEvent(game: Game, eventId: string, answerId: string, rng: Rng): string | null {
  const e = EVENTS.find((x) => x.id === eventId);
  const a = e?.answers.find((x) => x.id === answerId);
  return a ? a.effect(context(game, rng)) : null;
}

export const MEDIA_EVENT_IDS = EVENTS.map((e) => e.id);
