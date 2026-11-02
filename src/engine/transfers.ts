import { Club, Game, Negotiation, Player, Position, World } from './types';
import { Rng, clamp } from './rng';
import { fairWage, formatMoney, fullName, marketValue, noteClubChange, overall, roundMoney } from './player';
import { autoLineup, POSITIONS, squad } from './lineup';
import { targetOverall } from './generator';
import { addMessage } from './inbox';

export const MIN_SQUAD = 18;
export const MAX_SQUAD = 30;

export function inTransferWindow(week: number): boolean {
  return week <= 5 || (week >= 19 && week <= 22);
}

export function movePlayer(world: World, p: Player, toClubId: string | null, wage?: number, years?: number): void {
  if (toClubId !== p.clubId) noteClubChange(p);
  if (p.clubId && world.clubs[p.clubId]) {
    const from = world.clubs[p.clubId];
    from.playerIds = from.playerIds.filter((id) => id !== p.id);
    if (from.lineup?.includes(p.id)) from.lineup = null;
  } else {
    world.freeAgents = world.freeAgents.filter((id) => id !== p.id);
  }
  p.clubId = toClubId;
  p.loan = undefined;
  p.listed = undefined;
  if (toClubId) {
    world.clubs[toClubId].playerIds.push(p.id);
    p.wage = wage ?? fairWage(p);
    p.contractYears = years ?? 3;
    p.morale = clamp(p.morale + 10, 0, 100);
    if (p.releaseClause && world.clubs[toClubId].nationId !== 'ESP') p.releaseClause = undefined;
  } else {
    world.freeAgents.push(p.id);
  }
}

// Loans keep the contract with the parent club; the player returns at the
// end of the season.
export function loanPlayer(world: World, p: Player, toClubId: string, wageShare: number): void {
  const fromClubId = p.clubId!;
  noteClubChange(p);
  const from = world.clubs[fromClubId];
  from.playerIds = from.playerIds.filter((id) => id !== p.id);
  if (from.lineup?.includes(p.id)) from.lineup = null;
  world.clubs[toClubId].playerIds.push(p.id);
  p.clubId = toClubId;
  p.loan = { fromClubId, untilSeason: world.season, wageShare };
  p.listed = undefined;
}

function detach(world: World, p: Player) {
  const club = p.clubId ? world.clubs[p.clubId] : undefined;
  if (!club) return;
  club.playerIds = club.playerIds.filter((id) => id !== p.id);
  if (club.lineup?.includes(p.id)) club.lineup = null;
}

export function endLoan(world: World, p: Player): void {
  if (!p.loan) return;
  const parent = world.clubs[p.loan.fromClubId];
  noteClubChange(p);
  detach(world, p);
  p.clubId = parent.id;
  parent.playerIds.push(p.id);
  p.loan = undefined;
}

export function returnLoans(world: World): string[] {
  const back: string[] = [];
  for (const p of Object.values(world.players)) {
    if (!p.loan || p.loan.untilSeason > world.season) continue;
    endLoan(world, p);
    back.push(p.id);
  }
  return back;
}

// Wage the club pays this week (loanees cost only their share).
export function wageCost(p: Player): number {
  return p.loan ? Math.round(p.wage * p.loan.wageShare) : p.wage;
}

function protectedIds(game: Game): Set<string> {
  const ids = new Set<string>();
  if (game.career) ids.add(game.career.playerId);
  return ids;
}

export function userClubIdOf(game: Game): string | undefined {
  return game.manager?.clubId ?? undefined;
}

export function weakestPosition(world: World, club: Club): { position: Position; worst: number } {
  const xi = autoLineup(world, club).map((id) => world.players[id]);
  let best = { position: 'MID' as Position, worst: 999 };
  for (const pos of POSITIONS) {
    const ps = xi.filter((p) => p.position === pos);
    const worst = ps.length ? Math.min(...ps.map(overall)) : 0;
    if (worst < best.worst) best = { position: pos, worst };
  }
  return best;
}

// --- Prices and demands ------------------------------------------------------

export function askingPrice(world: World, p: Player): number {
  if (!p.clubId || p.loan) return 0;
  const seller = world.clubs[p.clubId];
  const xi = autoLineup(world, seller);
  const ranked = squad(world, seller).sort((a, b) => overall(b) - overall(a));
  const star = ranked.slice(0, 3).some((x) => x.id === p.id);
  let factor = xi.includes(p.id) ? 1.2 : 1.05;
  if (star && seller.reputation >= 80) factor *= 1.2;
  if (p.listed === 'transfer') factor *= 0.85;
  if (!seller.leagueId) factor *= 0.9;
  factor *= 1 + Math.min(p.contractYears, 5) * 0.04;
  const ask = roundMoney(marketValue(p) * factor);
  return p.releaseClause ? Math.min(ask, p.releaseClause) : ask;
}

export type Interest = 'keen' | 'open' | 'reluctant';

// Anyone can be signed, but stars want much more to join a smaller club.
// The level of player a club can attract. Elite clubs pull above their
// squad level.
function pull(club: Club): number {
  return targetOverall(club.reputation) + Math.max(0, club.reputation - 70) * 0.3;
}

export function interestIn(world: World, p: Player, club: Club): Interest {
  const gap = overall(p) - pull(club);
  if (gap <= 0) return 'keen';
  if (gap <= 6) return 'open';
  return 'reluctant';
}

export function wageDemand(world: World, p: Player, club: Club): number {
  const gap = Math.max(0, overall(p) - pull(club));
  const step = p.clubId ? 1.1 : 1;
  return roundMoney(Math.max(p.wage, fairWage(p)) * step * (1 + gap * 0.06));
}

// --- Market search ------------------------------------------------------------

export interface MarketFilter {
  text?: string;
  position?: Position;
  nationId?: string;
  leagueId?: string;
  minAge?: number;
  maxAge?: number;
  minOvr?: number;
  maxPrice?: number;
  listedOnly?: boolean;
  freeOnly?: boolean;
  sort?: 'ovr' | 'value' | 'age' | 'potential';
}

export interface MarketRow {
  p: Player;
  ask: number;
}

export function searchMarket(world: World, excludeClubId: string | null, f: MarketFilter, page = 0, pageSize = 30): { rows: MarketRow[]; total: number } {
  const text = f.text?.trim().toLowerCase();
  const list = Object.values(world.players).filter((p) => {
    if (p.retired || (excludeClubId && p.clubId === excludeClubId)) return false;
    if (f.position && p.position !== f.position) return false;
    if (f.nationId && p.nationId !== f.nationId) return false;
    if (f.freeOnly && p.clubId) return false;
    if (f.leagueId) {
      const club = p.clubId ? world.clubs[p.clubId] : null;
      if (f.leagueId === 'other' ? !club || !!club.leagueId : club?.leagueId !== f.leagueId) return false;
    }
    if (f.minAge && p.age < f.minAge) return false;
    if (f.maxAge && p.age > f.maxAge) return false;
    if (f.minOvr && overall(p) < f.minOvr) return false;
    if (f.listedOnly && !p.listed) return false;
    if (text && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(text)) return false;
    return true;
  });
  // Cheap sort first, then price only the page being shown.
  const key = f.sort ?? 'ovr';
  if (f.maxPrice === undefined && key !== 'value') {
    list.sort((a, b) => (key === 'age' ? a.age - b.age : key === 'potential' ? b.potential - a.potential : overall(b) - overall(a)));
    return { rows: list.slice(page * pageSize, page * pageSize + pageSize).map((p) => ({ p, ask: askingPrice(world, p) })), total: list.length };
  }
  const rows = list.map((p) => ({ p, ask: askingPrice(world, p) })).filter((r) => f.maxPrice === undefined || r.ask <= f.maxPrice);
  rows.sort((a, b) =>
    key === 'value' ? b.ask - a.ask : key === 'age' ? a.p.age - b.p.age : key === 'potential' ? b.p.potential - a.p.potential : overall(b.p) - overall(a.p),
  );
  return { rows: rows.slice(page * pageSize, page * pageSize + pageSize), total: rows.length };
}

// --- Negotiation (manager mode) -------------------------------------------

export type NegotiationResult = { status: 'accepted' | 'counter' | 'rejected' | 'walked' | 'done'; message: string; amount?: number };

function myClub(game: Game): Club {
  return game.world.clubs[game.manager!.clubId!];
}

export function startNegotiation(game: Game, playerId: string, kind: 'buy' | 'loan'): Negotiation | string {
  const world = game.world;
  const club = myClub(game);
  const p = world.players[playerId];
  if (!p || p.retired) return 'Player not found.';
  if (p.clubId === club.id) return 'He already plays for you.';
  if (p.loan) return 'He is out on loan and cannot move until the summer.';
  if (club.playerIds.length >= MAX_SQUAD) return `Your squad is full (${MAX_SQUAD}).`;
  if (p.clubId && !inTransferWindow(world.week)) return 'The transfer window is closed. You can still sign free agents.';
  if (kind === 'loan' && !p.clubId) return 'Free agents cannot be loaned. Sign him instead.';
  const n: Negotiation = {
    playerId,
    kind,
    fee: 0,
    stage: p.clubId ? 'fee' : 'contract',
    clubPatience: 3,
    playerPatience: 3,
    askWage: wageDemand(world, p, club),
    askYears: p.age >= 31 ? 2 : p.age >= 27 ? 3 : 4,
    fromClubId: p.clubId,
  };
  game.negotiations[playerId] = n;
  return n;
}

// Swap value: a player only counts toward the fee if the seller would use him.
export function swapValue(world: World, sellerId: string, swap: Player): number {
  const seller = world.clubs[sellerId];
  const { worst } = weakestPosition(world, seller);
  return overall(swap) >= worst - 3 ? roundMoney(marketValue(swap) * 0.8) : 0;
}

// Talks can outlive the situation they started in: the AI may sign the
// player, he may retire or be released from the game, or the money may be
// gone. Returns why the talks are off, after ending them.
function staleTalks(game: Game, n: Negotiation | undefined): string | null {
  if (!n) return null;
  const p = game.world.players[n.playerId];
  let why: string | null = null;
  if (!p || p.retired) why = 'He is no longer available.';
  else if (n.fromClubId !== undefined && p.clubId !== n.fromClubId) why = `${fullName(p)} has moved on${p.clubId ? ` to ${game.world.clubs[p.clubId]?.name ?? 'another club'}` : ''}. The talks are off.`;
  else if (p.loan) why = `${fullName(p)} has gone out on loan. The talks are off.`;
  else if (n.fee > myClub(game).budget) why = `You can no longer afford the ${formatMoney(n.fee)} fee. The talks are off.`;
  if (why) delete game.negotiations[n.playerId];
  return why;
}

export function bidFee(game: Game, playerId: string, fee: number, swapPlayerId?: string): NegotiationResult {
  const world = game.world;
  const n = game.negotiations[playerId];
  const stale = staleTalks(game, n);
  if (stale) return { status: 'walked', message: stale };
  const p = world.players[playerId];
  const club = myClub(game);
  if (!n || n.stage !== 'fee' || !p.clubId) return { status: 'rejected', message: 'No fee to agree here.' };
  if (fee > club.budget) return { status: 'rejected', message: `You only have ${formatMoney(club.budget)} to spend.` };
  const seller = world.clubs[p.clubId];
  const swap = swapPlayerId ? world.players[swapPlayerId] : undefined;
  const swapWorth = swap && swap.clubId === club.id ? swapValue(world, seller.id, swap) : 0;
  if (swap && !swapWorth) return { status: 'rejected', message: `${seller.name} have no use for ${fullName(swap)}.` };
  const offer = fee + swapWorth;

  if (p.releaseClause && fee >= p.releaseClause) {
    n.fee = fee;
    n.stage = 'contract';
    return { status: 'accepted', message: `You trigger the ${formatMoney(p.releaseClause)} release clause. ${seller.name} cannot refuse. Now agree terms with ${fullName(p)}.` };
  }
  const ask = askingPrice(world, p);
  if (offer >= ask) {
    n.fee = fee;
    n.swapPlayerId = swapWorth ? swapPlayerId : undefined;
    n.stage = 'contract';
    return { status: 'accepted', message: `${seller.name} accept. Now agree terms with ${fullName(p)}.` };
  }
  n.clubPatience--;
  if (n.clubPatience <= 0) {
    delete game.negotiations[playerId];
    return { status: 'walked', message: `${seller.name} are tired of low offers and end talks.` };
  }
  if (offer >= ask * 0.75) {
    const counter = roundMoney(Math.max(0, ask - swapWorth));
    return { status: 'counter', amount: counter, message: `${seller.name} want ${formatMoney(counter)}${swapWorth ? ' plus the swap' : ''}.` };
  }
  return { status: 'rejected', message: `${seller.name} reject the bid outright.` };
}

export function offerContract(game: Game, playerId: string, wage: number, years: number): NegotiationResult {
  const world = game.world;
  const n = game.negotiations[playerId];
  const stale = staleTalks(game, n);
  if (stale) return { status: 'walked', message: stale };
  const p = world.players[playerId];
  const club = myClub(game);
  if (!n || n.stage !== 'contract') return { status: 'rejected', message: 'Agree a fee first.' };
  // Players want a little more for a contract length they did not ask for.
  const demand = roundMoney(n.askWage * (1 + Math.abs(years - n.askYears) * 0.04));
  if (wage >= demand) {
    completeTransfer(game, p, n, wage, years);
    return { status: 'done', message: `${fullName(p)} signs for ${club.name}!` };
  }
  n.playerPatience--;
  if (n.playerPatience <= 0) {
    delete game.negotiations[playerId];
    return { status: 'walked', message: `${fullName(p)} walks away from talks.` };
  }
  if (wage >= demand * 0.85) {
    n.askWage = roundMoney(Math.max(wage, demand * 0.97));
    return { status: 'counter', amount: n.askWage, message: `${fullName(p)} would sign for ${formatMoney(n.askWage)} a week.` };
  }
  return { status: 'rejected', message: `${fullName(p)} says that wage is not serious.` };
}

function completeTransfer(game: Game, p: Player, n: Negotiation, wage: number, years: number) {
  const world = game.world;
  const club = myClub(game);
  const sellerId = p.clubId;
  if (sellerId) {
    world.clubs[sellerId].budget += n.fee;
    club.budget -= n.fee;
    if (n.swapPlayerId) {
      const swap = world.players[n.swapPlayerId];
      if (swap?.clubId === club.id) movePlayer(world, swap, sellerId);
    }
  }
  movePlayer(world, p, club.id, wage, years);
  delete game.negotiations[p.id];
  const from = sellerId ? ` from ${world.clubs[sellerId].name}` : '';
  addMessage(game, 'news', `${fullName(p)} signs`, `${fullName(p)} joins ${club.name}${from}${n.fee ? ` for ${formatMoney(n.fee)}` : ' on a free'}. ${formatMoney(wage)} a week for ${years} years.`);
}

export function loanBid(game: Game, playerId: string, wageShare: number): NegotiationResult {
  const world = game.world;
  const club = myClub(game);
  const p = world.players[playerId];
  if (!p || p.retired) return { status: 'rejected', message: 'Player not found.' };
  if (!p.clubId) return { status: 'rejected', message: 'Free agents cannot be loaned.' };
  if (p.clubId === club.id) return { status: 'rejected', message: 'He already plays for you.' };
  // Loaning on a loanee would overwrite where he came from; his real club
  // would lose him.
  if (p.loan) return { status: 'rejected', message: 'He is already out on loan.' };
  if (club.playerIds.length >= MAX_SQUAD) return { status: 'rejected', message: `Your squad is full (${MAX_SQUAD}).` };
  if (!inTransferWindow(world.week)) return { status: 'rejected', message: 'The transfer window is closed.' };
  const seller = world.clubs[p.clubId];
  const starter = autoLineup(world, seller).includes(p.id);
  if (starter && p.listed !== 'loan') return { status: 'rejected', message: `${seller.name} will not loan out a first-team regular.` };
  const needed = p.age <= 21 ? 0.4 : 0.6;
  if (wageShare < needed) return { status: 'counter', amount: needed, message: `${seller.name} want you to cover ${Math.round(needed * 100)}% of his wages.` };
  if (seller.reputation > club.reputation + 20 && overall(p) > targetOverall(club.reputation) + 8) {
    return { status: 'rejected', message: `${fullName(p)} does not fancy a loan at your level.` };
  }
  loanPlayer(world, p, club.id, wageShare);
  delete game.negotiations[playerId];
  addMessage(game, 'news', `${fullName(p)} arrives on loan`, `${fullName(p)} joins ${club.name} on loan from ${seller.name} until the end of the season.`);
  return { status: 'done', message: `${fullName(p)} joins on loan!` };
}

export function releaseCost(p: Player): number {
  return p.loan ? 0 : Math.round(p.wage * 30 * p.contractYears * 0.5);
}

// Releases a player (paying off half the contract) or sends a loanee back.
export function releasePlayer(game: Game, playerId: string): boolean {
  const world = game.world;
  const club = myClub(game);
  const p = world.players[playerId];
  if (p.clubId !== club.id || club.playerIds.length <= MIN_SQUAD) return false;
  if (p.loan) {
    endLoan(world, p);
    return true;
  }
  club.budget -= releaseCost(p);
  movePlayer(world, p, null);
  return true;
}

// --- AI market ------------------------------------------------------------------

export function runAiTransfers(game: Game, rng: Rng, deals: number): void {
  const world = game.world;
  const guarded = protectedIds(game);
  const userClub = userClubIdOf(game);
  const clubs = Object.values(world.clubs).filter((c) => c.id !== userClub && (c.leagueId || rng.chance(0.2)));
  const all = Object.values(world.players).filter((p) => !p.retired && !guarded.has(p.id) && !p.loan);
  for (let d = 0; d < deals; d++) {
    const buyer = rng.pick(clubs);
    if (buyer.playerIds.length >= MAX_SQUAD - 2) continue;
    const { position, worst } = weakestPosition(world, buyer);
    const sample: Player[] = [];
    for (let i = 0; i < 200; i++) sample.push(rng.pick(all));
    const candidates = sample.filter((p) => {
      if (p.position !== position || p.age > 31 || p.clubId === buyer.id || p.injuryWeeks || p.clubId === userClub) return false;
      if (overall(p) < worst + 2 || overall(p) > targetOverall(buyer.reputation) + 6) return false;
      if (p.clubId) {
        const seller = world.clubs[p.clubId];
        if (seller.playerIds.length <= MIN_SQUAD || seller.reputation > buyer.reputation + 5) return false;
      }
      return askingPrice(world, p) <= buyer.budget * 0.6;
    });
    if (!candidates.length) continue;
    const target = candidates.sort((a, b) => overall(b) - overall(a))[0];
    const fee = target.clubId ? roundMoney(askingPrice(world, target) * rng.range(1, 1.2)) : 0;
    const sellerId = target.clubId;
    buyer.budget -= fee;
    if (sellerId) world.clubs[sellerId].budget += fee;
    movePlayer(world, target, buyer.id, fairWage(target), rng.int(2, 5));
    if (overall(target) >= 82) {
      addMessage(game, 'news', `${fullName(target)} joins ${buyer.name}`, sellerId ? `${buyer.name} pay ${formatMoney(fee)} to sign ${fullName(target)} from ${world.clubs[sellerId].name}.` : `${buyer.name} sign free agent ${fullName(target)}.`);
    }
  }
}
