import { Choice, Game, Message, Player } from './types';
import { Rng, clamp } from './rng';
import { avgRating, fairWage, formatMoney, fullName, marketValue, overall, roundMoney } from './player';
import { addMessage, hasOpen } from './inbox';
import { addXp, careerPlayer, squadStatus } from './career';
import { targetOverall, nationById, majorNations } from './generator';
import { autoLineup, squad } from './lineup';
import { MIN_SQUAD, inTransferWindow, loanPlayer, movePlayer } from './transfers';
import { nationalPool, pickNationalSquad } from './international';
import { jobOffers, managerClub, nationJobOffer } from './manager';
import { adjustRelation } from './relations';

const ACCEPT: Choice = { id: 'accept', label: 'Accept' };
const DECLINE: Choice = { id: 'decline', label: 'Decline' };
const COUNTER: Choice = { id: 'counter', label: 'Counter', needsAmount: true };

const SPONSOR_BRANDS = ['Volt Energy', 'Kestrel Boots', 'Nimbus Phones', 'Arcadia Watches', 'Peak Water', 'Orbit Games', 'Lumen Sportswear', 'Halo Headphones'];

// --- Career: what lands in the player's inbox ----------------------------

export function careerOffers(game: Game, rng: Rng): void {
  const c = game.career!;
  const p = careerPlayer(game);
  const world = game.world;
  if (c.requestCooldown > 0) c.requestCooldown--;
  if ((c.pitchCooldown ?? 0) > 0) c.pitchCooldown = (c.pitchCooldown ?? 0) - 1;
  sponsorOffer(game, rng);
  if (inTransferWindow(world.week) || !p.clubId) clubOffer(game, rng);
  if (inTransferWindow(world.week) && p.age <= 23 && squadStatus(game) === 'Squad player' && !p.loan) loanOffer(game, rng);
  if (p.stats.apps >= 3 && rng.chance(0.08)) mediaRequest(game, rng);
  if (c.fame >= 30 && rng.chance(0.03)) nationSwitchOffer(game, rng);
}

function sponsorOffer(game: Game, rng: Rng) {
  const c = game.career!;
  if (c.fame < 12 || c.sponsors.length >= 3 || hasOpen(game, 'sponsor') || !rng.chance(0.06 + c.fame / 400)) return;
  const brand = rng.pick(SPONSOR_BRANDS.filter((b) => !c.sponsors.some((s) => s.name === b)));
  if (!brand) return;
  const weekly = roundMoney(c.fame ** 2 * 12 + 500);
  addMessage(game, 'offer', `${brand} want you`, `${brand} offer ${formatMoney(weekly)} a week for 30 weeks to wear and post their gear.`, {
    type: 'sponsor',
    brand,
    weekly,
    patience: 1,
    weeksLeft: 3,
    choices: [ACCEPT, { ...COUNTER, label: 'Ask for more' }, DECLINE],
  });
}

function clubOffer(game: Game, rng: Rng) {
  const world = game.world;
  const c = game.career!;
  const p = careerPlayer(game);
  if (hasOpen(game, 'club-offer')) return;
  const ovr = overall(p);
  const current = p.clubId ? world.clubs[p.clubId] : null;
  const agent = c.items.includes('agent');
  const interestP = current ? (ovr - targetOverall(current.reputation)) / 30 + c.fame / 300 + (agent ? 0.08 : 0) + (c.wantsMove ? 0.25 : 0) : 0.8;
  if (!rng.chance(clamp(interestP, 0, 0.7))) return;
  const fits = Object.values(world.clubs).filter(
    (club) => club.leagueId && club.id !== p.clubId && Math.abs(targetOverall(club.reputation) - ovr) <= 6 && (!current || club.reputation >= current.reputation - 3),
  );
  if (!fits.length) return;
  const club = rng.pick(fits);
  const wage = roundMoney(fairWage(p) * rng.range(1.05, 1.4) * (agent ? 1.2 : 1));
  const years = rng.int(2, 5);
  addMessage(game, 'offer', `Offer from ${club.name}`, `${club.name} (rep ${club.reputation}) offer ${formatMoney(wage)} a week for ${years} years.`, {
    type: 'club-offer',
    clubId: club.id,
    wage,
    years,
    patience: 2,
    weeksLeft: 2,
    choices: [ACCEPT, { ...COUNTER, label: 'Ask for more' }, DECLINE],
  });
}

function loanOffer(game: Game, rng: Rng) {
  const world = game.world;
  const p = careerPlayer(game);
  if (hasOpen(game, 'loan-offer') || !rng.chance(0.25)) return;
  const home = world.clubs[p.clubId!];
  const fits = Object.values(world.clubs).filter((c) => c.leagueId && c.id !== home.id && c.reputation < home.reputation && targetOverall(c.reputation) <= overall(p) + 3);
  if (!fits.length) return;
  const club = rng.pick(fits);
  addMessage(game, 'offer', `Loan offer: ${club.name}`, `${club.name} want you on loan until the end of the season. You would play every week. ${home.name} are happy to let you go.`, {
    type: 'loan-offer',
    clubId: club.id,
    weeksLeft: 2,
    choices: [ACCEPT, DECLINE],
  });
}

function mediaRequest(game: Game, rng: Rng) {
  if (hasOpen(game, 'media')) return;
  const outlets = ['Sky Sports', 'a podcast', 'the local paper', 'a TV talk show', 'a big YouTube channel'];
  addMessage(game, 'media', 'Interview request', `${rng.pick(outlets)} want an interview after your recent games. How do you play it?`, {
    type: 'media',
    weeksLeft: 1,
    choices: [
      { id: 'humble', label: 'Stay humble' },
      { id: 'bold', label: 'Talk big' },
      { id: 'decline', label: 'Skip it' },
    ],
  });
}

function nationSwitchOffer(game: Game, rng: Rng) {
  const world = game.world;
  const p = careerPlayer(game);
  if (p.caps >= 3 || hasOpen(game, 'nation-switch')) return;
  const own = world.nationalTeams[nationById(world, p.nationId)!.teamId];
  if (own.playerIds.includes(p.id)) return;
  // A nation whose squad he would make, as through a parent or grandparent.
  const options = majorNations(world).filter((n) => n.id !== p.nationId && pickNationalSquad(world, n.id).length && overall(p) >= nationalCutoff(game, n.id));
  if (!options.length) return;
  const nation = rng.pick(options);
  addMessage(game, 'national', `${nation.name} come calling`, `Through your family, you are eligible for ${nation.name}. Their coach wants you in the squad. Switching is for good.`, {
    type: 'nation-switch',
    nationId: nation.id,
    weeksLeft: 3,
    choices: [
      { id: 'accept', label: `Play for ${nation.name}` },
      { id: 'decline', label: 'Stay loyal' },
    ],
  });
}

function nationalCutoff(game: Game, nationId: string): number {
  const pool = nationalPool(game.world, nationId).map(overall).sort((a, b) => b - a);
  return pool[22] ?? 0;
}

export function callUpMessage(game: Game): void {
  const p = careerPlayer(game);
  const nation = nationById(game.world, p.nationId);
  if (!nation || p.injuryWeeks) return;
  addMessage(game, 'national', `Called up by ${nation.name}`, `The ${nation.name} coach has named you in the squad for this international break.`, {
    type: 'callup',
    nationId: nation.id,
    weeksLeft: 1,
    choices: [
      { id: 'accept', label: 'Report for duty' },
      { id: 'decline', label: 'Withdraw (rest)' },
    ],
  });
}

// User-started requests from the career profile.
export function careerRequest(game: Game, kind: 'raise' | 'move' | 'loan'): string {
  const c = game.career!;
  const p = careerPlayer(game);
  if (!p.clubId) return 'You need a club first.';
  if (c.requestCooldown > 0) return `The club will not hear another request for ${c.requestCooldown} weeks.`;
  c.requestCooldown = 6;
  const club = game.world.clubs[p.clubId];
  if (kind === 'raise') {
    const deserved = fairWage(p) > p.wage * 1.1 || (p.stats.apps >= 5 && avgRating(p.stats) >= 7.2);
    if (!deserved) {
      p.morale = clamp(p.morale - 5, 0, 100);
      return `${club.name} say you have not earned a raise yet.`;
    }
    const wage = roundMoney(Math.max(p.wage * 1.2, fairWage(p)));
    addMessage(game, 'offer', `${club.name} offer a new deal`, `${club.name} offer ${formatMoney(wage)} a week for 4 years.`, {
      type: 'renewal',
      clubId: club.id,
      wage,
      years: 4,
      patience: 1,
      weeksLeft: 3,
      choices: [ACCEPT, { ...COUNTER, label: 'Ask for more' }, DECLINE],
    });
    return 'Your agent opens talks. Check your inbox.';
  }
  if (kind === 'move') {
    c.wantsMove = true;
    p.morale = clamp(p.morale - 3, 0, 100);
    return `You tell ${club.name} you want to leave. Expect more offers when the window opens.`;
  }
  if (squadStatus(game) === 'Starter') return `${club.name} need you and refuse to loan you out.`;
  const rng = new Rng(game.world.rngState);
  loanOffer(game, new Rng(rng.int(1, 1e9)));
  return hasOpen(game, 'loan-offer') ? 'A loan offer is in your inbox.' : 'No club has come forward yet. Try again later.';
}

export function ownClubRenewal(game: Game, rng: Rng): void {
  const p = careerPlayer(game);
  if (!p.clubId) return;
  const club = game.world.clubs[p.clubId];
  if (overall(p) < targetOverall(club.reputation) - 14 && p.age > 19) return;
  const wage = Math.max(p.wage, roundMoney(fairWage(p) * rng.range(1, 1.2)));
  const years = rng.int(2, 4);
  addMessage(game, 'offer', `${club.name} offer a new deal`, `Stay at ${club.name} on ${formatMoney(wage)} a week for ${years} years.`, {
    type: 'renewal',
    clubId: club.id,
    wage,
    years,
    patience: 1,
    weeksLeft: 30,
    choices: [ACCEPT, { ...COUNTER, label: 'Ask for more' }, DECLINE],
  });
}

// --- Manager: what lands in the manager's inbox -----------------------------

// Out of work: a club offer every few weeks while none is open, so a sacked
// manager is never stuck. Better records reach bigger clubs.
function unemployedOffers(game: Game, rng: Rng): void {
  const m = game.manager!;
  if (!hasOpen(game, 'job') && rng.chance(0.35)) {
    const record = m.trophies.length * 4 + m.seasonsManaged * 2;
    jobOffers(game, rng, 10, Math.min(90, 50 + record), 2);
  }
  if (!m.nationalTeamId && !hasOpen(game, 'nation-job') && rng.chance(0.04)) nationJobOffer(game, rng);
}

export function managerOffers(game: Game, rng: Rng): void {
  const club = managerClub(game);
  if (!club) {
    unemployedOffers(game, rng);
    return;
  }
  const world = game.world;
  if (inTransferWindow(world.week)) {
    saleBid(game, rng);
    loanRequest(game, rng);
  }
  playerDemands(game, rng);
  if (rng.chance(0.06)) pressConference(game, rng);
}

function saleBid(game: Game, rng: Rng) {
  const world = game.world;
  const club = managerClub(game)!;
  if (club.playerIds.length <= MIN_SQUAD || !rng.chance(0.4)) return;
  const players = squad(world, club).filter((p) => !p.loan);
  const listed = players.filter((p) => p.listed === 'transfer');
  const pool = listed.length && rng.chance(0.7) ? listed : players;
  const p = rng.pick(pool);
  if (!p || hasOpen(game, 'sale-bid', p.id)) return;
  const buyers = Object.values(world.clubs).filter((c) => c.id !== club.id && c.leagueId && targetOverall(c.reputation) >= overall(p) - 6 && c.budget >= marketValue(p));
  if (!buyers.length) return;
  const buyer = rng.pick(buyers);
  const fee = roundMoney(marketValue(p) * rng.range(p.listed ? 0.85 : 0.9, 1.4));
  addMessage(game, 'offer', `${buyer.name} bid for ${fullName(p)}`, `${buyer.name} offer ${formatMoney(fee)} for ${fullName(p)} (value ${formatMoney(marketValue(p))}).`, {
    type: 'sale-bid',
    clubId: buyer.id,
    playerId: p.id,
    fee,
    patience: 2,
    weeksLeft: 2,
    choices: [ACCEPT, COUNTER, DECLINE],
  });
}

function loanRequest(game: Game, rng: Rng) {
  const world = game.world;
  const club = managerClub(game)!;
  if (!rng.chance(0.2)) return;
  const xi = autoLineup(world, club);
  const young = squad(world, club).filter((p) => p.age <= 22 && !xi.includes(p.id) && !p.loan);
  if (!young.length || club.playerIds.length <= MIN_SQUAD) return;
  const p = rng.pick(young);
  if (hasOpen(game, 'loan-request', p.id)) return;
  const takers = Object.values(world.clubs).filter((c) => c.leagueId && c.id !== club.id && c.reputation < club.reputation);
  if (!takers.length) return;
  const taker = rng.pick(takers);
  const share = rng.pick([0.5, 0.75, 1]);
  addMessage(game, 'offer', `${taker.name} want ${fullName(p)} on loan`, `${taker.name} would take ${fullName(p)} for the season and pay ${Math.round(share * 100)}% of his wages. Game time would help him grow.`, {
    type: 'loan-request',
    clubId: taker.id,
    playerId: p.id,
    wageShare: share,
    weeksLeft: 2,
    choices: [ACCEPT, DECLINE],
  });
}

function playerDemands(game: Game, rng: Rng) {
  const world = game.world;
  const club = managerClub(game)!;
  for (const p of squad(world, club)) {
    if (p.loan) continue;
    if (p.morale < 25 && !p.listed && rng.chance(0.15) && !hasOpen(game, 'transfer-request', p.id)) {
      addMessage(game, 'offer', `${fullName(p)} wants to leave`, `${fullName(p)} is unhappy and has asked to go on the transfer list.`, {
        type: 'transfer-request',
        playerId: p.id,
        weeksLeft: 2,
        choices: [
          { id: 'accept', label: 'List him' },
          { id: 'decline', label: 'Refuse' },
        ],
      });
      continue;
    }
    const underpaid = fairWage(p) > p.wage * 1.35 && overall(p) >= targetOverall(club.reputation) - 2;
    if ((underpaid || p.contractYears <= 1) && rng.chance(0.04) && !hasOpen(game, 'contract-demand', p.id)) {
      const wage = roundMoney(Math.max(p.wage * 1.1, fairWage(p) * 1.1));
      addMessage(game, 'offer', `${fullName(p)} wants a new contract`, `${fullName(p)} asks for ${formatMoney(wage)} a week on a 4-year deal (now ${formatMoney(p.wage)}, ${p.contractYears} yr left).`, {
        type: 'contract-demand',
        playerId: p.id,
        wage,
        years: 4,
        patience: 1,
        weeksLeft: 3,
        choices: [ACCEPT, { ...COUNTER, label: 'Offer less' }, DECLINE],
      });
    }
  }
}

function pressConference(game: Game, rng: Rng) {
  if (hasOpen(game, 'media')) return;
  const topics = ['your recent form', 'the transfer window', 'the title race', 'a rival manager\'s comments'];
  addMessage(game, 'media', 'Press conference', `Reporters want your view on ${rng.pick(topics)}.`, {
    type: 'media',
    weeksLeft: 1,
    choices: [
      { id: 'praise', label: 'Praise the players' },
      { id: 'demand', label: 'Demand more' },
      { id: 'decline', label: 'Keep it short' },
    ],
  });
}

// --- Responding --------------------------------------------------------------

export function respond(game: Game, messageId: string, choiceId: string, amount?: number): string {
  const msg = game.inbox.find((m) => m.id === messageId);
  const a = msg?.action;
  if (!msg || !a || a.resolved) return 'That is no longer open.';
  msg.read = true;
  const done = (state: string, text: string) => {
    a.resolved = state;
    return text;
  };
  if (choiceId === 'decline') return declineEffects(game, msg) ?? done('declined', 'Declined.');
  switch (a.type) {
    case 'club-offer':
    case 'renewal':
      if (choiceId === 'counter') return haggle(game, msg, amount ?? 0, 'wage');
      {
        // signCareerContract marks an out-of-date offer expired itself.
        const text = signCareerContract(game, msg);
        return a.resolved ? text : done('accepted', text);
      }
    case 'sponsor':
      if (choiceId === 'counter') return haggle(game, msg, amount ?? 0, 'weekly');
      game.career!.sponsors.push({ name: a.brand ?? 'Sponsor', weekly: a.weekly ?? 0, weeksLeft: 30 });
      return done('accepted', `Signed with ${a.brand}.`);
    case 'loan-offer': {
      const p = careerPlayer(game);
      if (!p.clubId) return done('expired', 'You have no club to be loaned from.');
      adjustRelation(game, a.clubId!, 10);
      loanPlayer(game.world, p, a.clubId!, 1);
      return done('accepted', `You join ${game.world.clubs[a.clubId!].name} on loan.`);
    }
    case 'media':
      return done(choiceId, mediaEffects(game, choiceId));
    case 'callup': {
      const p = careerPlayer(game);
      const rng = new Rng(game.world.rngState + msg.week);
      const games = rng.int(1, 2);
      let goals = 0;
      for (let i = 0; i < games; i++) if (rng.chance((p.attrs.shooting / 99) * (p.position === 'FWD' ? 0.45 : p.position === 'MID' ? 0.2 : 0.06))) goals++;
      p.caps += games;
      p.intlGoals += goals;
      p.fitness = clamp(p.fitness - 8, 0, 100);
      game.career!.fame = clamp(game.career!.fame + 3 + goals * 2, 0, 100);
      const lvl = addXp(game, 20 + goals * 15);
      const name = nationById(game.world, a.nationId!)?.name;
      return done('accepted', `You play ${games} game${games > 1 ? 's' : ''} for ${name}${goals ? ` and score ${goals}` : ''}. Caps: ${p.caps}.${lvl ? ` ${lvl}` : ''}`);
    }
    case 'nation-switch': {
      const p = careerPlayer(game);
      p.nationId = a.nationId!;
      return done('accepted', `You will play for ${nationById(game.world, a.nationId!)?.name}.`);
    }
    case 'sale-bid':
      if (choiceId === 'counter') return haggle(game, msg, amount ?? 0, 'fee');
      return done('accepted', completeSale(game, msg));
    case 'loan-request': {
      const p = game.world.players[a.playerId!];
      const club = managerClub(game);
      if (!club || p.clubId !== club.id || club.playerIds.length <= MIN_SQUAD) return done('expired', 'Cannot loan him out now.');
      loanPlayer(game.world, p, a.clubId!, a.wageShare ?? 1);
      return done('accepted', `${fullName(p)} goes on loan to ${game.world.clubs[a.clubId!].name}.`);
    }
    case 'contract-demand': {
      const p = game.world.players[a.playerId!];
      if (choiceId === 'counter') return haggle(game, msg, amount ?? 0, 'wage');
      p.wage = a.wage!;
      p.contractYears = a.years!;
      p.morale = clamp(p.morale + 15, 0, 100);
      return done('accepted', `${fullName(p)} signs a new deal.`);
    }
    case 'transfer-request': {
      const p = game.world.players[a.playerId!];
      p.listed = 'transfer';
      return done('accepted', `${fullName(p)} is on the transfer list.`);
    }
    case 'job': {
      const m = game.manager!;
      for (const x of game.inbox) if (x.action?.type === 'job' && !x.action.resolved && x !== msg) x.action.resolved = 'expired';
      m.clubId = a.clubId!;
      m.boardConfidence = 55;
      game.world.clubs[a.clubId!].lineup = null;
      return done('accepted', `You are the new manager of ${game.world.clubs[a.clubId!].name}.`);
    }
    case 'nation-job': {
      const m = game.manager!;
      const nation = nationById(game.world, a.nationId!)!;
      m.nationalTeamId = nation.teamId;
      m.nationConfidence = 60;
      game.world.nationalTeams[nation.teamId].playerIds = pickNationalSquad(game.world, nation.id);
      return done('accepted', `You are the new ${nation.name} manager.`);
    }
  }
  return done('accepted', 'Done.');
}

function declineEffects(game: Game, msg: Message): string | null {
  const a = msg.action!;
  // Turning a club down cools the relationship.
  if (a.type === 'club-offer' && a.clubId) adjustRelation(game, a.clubId, -10);
  if (a.type === 'callup') {
    const p = careerPlayer(game);
    game.career!.fame = clamp(game.career!.fame - 2, 0, 100);
    p.fitness = clamp(p.fitness + 15, 0, 100);
    a.resolved = 'declined';
    return 'You withdraw to rest. The fans are not impressed.';
  }
  if (a.type === 'contract-demand' || a.type === 'transfer-request') {
    const p = game.world.players[a.playerId!];
    p.morale = clamp(p.morale - 15, 0, 100);
    a.resolved = 'declined';
    return `${fullName(p)} is unhappy.`;
  }
  if (a.type === 'media') {
    a.resolved = 'declined';
    return 'You keep your head down.';
  }
  return null;
}

// One round of haggling. The other side either meets the number or holds.
function haggle(game: Game, msg: Message, amount: number, field: 'wage' | 'fee' | 'weekly'): string {
  const a = msg.action!;
  const current = a[field] ?? 0;
  if (!(amount > 0)) return 'Enter an amount.';
  const selling = field === 'fee';
  const lowering = a.type === 'contract-demand';
  if ((a.patience ?? 0) <= 0) {
    a.resolved = 'rejected';
    return 'They have heard enough and walk away.';
  }
  a.patience = (a.patience ?? 1) - 1;
  const rng = new Rng(game.world.rngState + msg.week * 31 + amount);
  // How far you push, compared with their offer.
  const ratio = lowering ? current / amount : amount / current;
  const limit = selling ? 1.35 : lowering ? 1.2 : 1.25;
  const accepts = ratio <= 1 || (ratio <= limit && rng.chance(1 - (ratio - 1) / (limit - 1)));
  if (accepts) {
    a[field] = amount;
    msg.body = `${msg.body.split(' Revised:')[0]} Revised: ${formatMoney(amount)}${field === 'fee' ? '' : ' a week'}. Accept to confirm.`;
    a.choices = a.choices.filter((c) => c.id !== 'counter');
    return 'They agree to your number. Accept to confirm.';
  }
  if (ratio > limit * 1.15) {
    a.resolved = 'rejected';
    return 'They find that insulting and pull out.';
  }
  return a.patience > 0 ? 'They hold firm. You can try once more.' : 'They hold firm. Take it or leave it.';
}

function signCareerContract(game: Game, msg: Message): string {
  const a = msg.action!;
  const p = careerPlayer(game);
  const club = game.world.clubs[a.clubId!];
  const c = game.career!;
  if (c.retired) {
    a.resolved = 'expired';
    return 'You have retired.';
  }
  // A renewal is from the club that holds your contract, even while you are
  // out on loan. If you have left since, it is out of date.
  if (a.type === 'renewal') {
    if (p.clubId !== club.id && p.loan?.fromClubId !== club.id) {
      a.resolved = 'expired';
      return `You have left ${club.name} since they made this offer.`;
    }
    p.wage = a.wage ?? p.wage;
    p.contractYears = a.years ?? p.contractYears;
    return `New contract signed with ${club.name}.`;
  }
  if (p.clubId === club.id) {
    p.wage = a.wage ?? p.wage;
    p.contractYears = a.years ?? p.contractYears;
    return `New contract signed with ${club.name}.`;
  }
  movePlayer(game.world, p, club.id, a.wage, a.years);
  c.wantsMove = false;
  // Any other open offer, including renewals from the old club, is now void.
  for (const m of game.inbox) if (m.action && !m.action.resolved && (m.action.type === 'club-offer' || m.action.type === 'loan-offer' || m.action.type === 'renewal') && m !== msg) m.action.resolved = 'expired';
  addMessage(game, 'news', `Welcome to ${club.name}`, `${fullName(p)} signs for ${club.name}.`);
  return `You joined ${club.name}!`;
}

function completeSale(game: Game, msg: Message): string {
  const a = msg.action!;
  const world = game.world;
  const p = world.players[a.playerId!];
  const club = managerClub(game);
  const buyer = world.clubs[a.clubId!];
  if (!club || p.clubId !== club.id) return 'He is no longer at your club.';
  if (club.playerIds.length <= MIN_SQUAD) return `You need at least ${MIN_SQUAD} players.`;
  club.budget += a.fee!;
  buyer.budget -= a.fee!;
  movePlayer(world, p, buyer.id);
  return `${fullName(p)} sold to ${buyer.name} for ${formatMoney(a.fee!)}.`;
}

function mediaEffects(game: Game, choiceId: string): string {
  if (game.career) {
    const c = game.career;
    const p = careerPlayer(game);
    if (choiceId === 'humble') {
      p.morale = clamp(p.morale + 4, 0, 100);
      c.fame = clamp(c.fame + 1, 0, 100);
      return 'Fans like the humble answers. Morale and fame up a little.';
    }
    c.fame = clamp(c.fame + 3, 0, 100);
    p.morale = clamp(p.morale - 3, 0, 100);
    return 'The headlines are loud. Fame up, but team-mates roll their eyes.';
  }
  const club = managerClub(game);
  const m = game.manager!;
  if (club && choiceId === 'praise') {
    for (const p of squad(game.world, club)) p.morale = clamp(p.morale + 3, 0, 100);
    return 'The squad appreciates it. Morale up.';
  }
  if (club && choiceId === 'demand') {
    for (const p of squad(game.world, club)) p.morale = clamp(p.morale - 2, 0, 100);
    m.boardConfidence = clamp(m.boardConfidence + 3, 0, 100);
    return 'The board like the ambition. The players feel the pressure.';
  }
  return 'Done.';
}

export function playerById(game: Game, id: string): Player | undefined {
  return game.world.players[id];
}
