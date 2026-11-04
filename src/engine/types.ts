import type { CareerProgress } from './progress';
import type { Europe } from './europe';

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Build = 'lean' | 'athletic' | 'stocky';

export const ATTR_KEYS = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
  'vision',
  'composure',
  'goalkeeping',
] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];
export type Attributes = Record<AttrKey, number>;

export interface SeasonStats {
  apps: number;
  goals: number;
  assists: number;
  ratingSum: number;
}

export interface CareerSeason extends SeasonStats {
  season: number;
  clubId: string;
}

export interface Loan {
  fromClubId: string;
  untilSeason: number;
  // Share of the wage the borrowing club pays, 0..1.
  wageShare: number;
}

export interface Player {
  id: string;
  // Empty for players known by one name (for example "Rodri").
  firstName: string;
  lastName: string;
  nationId: string;
  age: number;
  position: Position;
  // Stored as floats so small weekly training gains add up; shown rounded.
  attrs: Attributes;
  potential: number;
  clubId: string | null;
  wage: number;
  contractYears: number;
  morale: number;
  fitness: number;
  injuryWeeks: number;
  // Weeks out banned (a red card, an arrest, a corruption case).
  suspendedWeeks?: number;
  retired: boolean;
  stats: SeasonStats;
  // This season's numbers at clubs the player has already left (transfer or
  // loan). stats stays the season total, which the awards need.
  seasonSplits?: (SeasonStats & { clubId: string })[];
  history: CareerSeason[];
  caps: number;
  intlGoals: number;
  // Fee that forces a sale when met. Common in Spain.
  releaseClause?: number;
  loan?: Loan;
  listed?: 'transfer' | 'loan';
  // True for players from the built-in or imported database.
  real?: boolean;
  // Skill id -> level 1..3. See skills.ts.
  skills?: Record<string, number>;
  // Skill moves the career player has learned (see SKILL_MOVES).
  moves?: string[];
  // Exact role on top of the broad position (see roles.ts). Optional:
  // players without one are rated by their broad position.
  role?: string;
  secondaryRole?: string;
  // Positions learned on the ability tree.
  roles?: string[];
  // Stat nodes bought on the ability tree.
  tree?: string[];
  foot?: 'L' | 'R';
  // Weak foot rating, 1..5 stars.
  weakFoot?: number;
  heightCm?: number;
  build?: Build;
  // Playing style preset chosen at creation.
  style?: string;
  // Squad number at the current club, given out the first time he plays.
  shirt?: number;
  // Ratings from the last five league games; coaches pick on form.
  form?: number[];
}

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '4-1-4-1' | '4-4-1-1' | '3-4-3' | '3-4-2-1' | '5-3-2' | '5-4-1' | '4-3-1-2' | '4-1-2-1-2';
export type Style = 'balanced' | 'possession' | 'counter' | 'press';

export interface Club {
  id: string;
  name: string;
  short: string;
  nationId: string;
  // null for clubs outside the simulated leagues, and for national teams.
  leagueId: string | null;
  reputation: number;
  budget: number;
  colors: [string, string];
  playerIds: string[];
  formation: Formation;
  style: Style;
  // Manual lineup set by the user. Ignored when invalid.
  lineup: string[] | null;
  national?: boolean;
}

export type Confederation = 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';

export interface Nation {
  id: string;
  name: string;
  conf: Confederation;
  // Typical level of the nation's generated players, 30..85.
  strength: number;
  colors: [string, string];
  names: string;
  leagueIds: string[];
  teamId: string;
  // Real domestic clubs, used to build a league on demand.
  clubNames: string[];
  leagueLevel: number;
  // Only appears as a nationality: no league, no tournaments.
  minor?: boolean;
}

export interface Fixture {
  id: string;
  week: number;
  homeId: string;
  awayId: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
  scorers: { playerId: string; clubId: string; minute: number }[];
  // Knockout games level after 90 minutes go to penalties.
  penaltyWinner?: string;
  stage?: string;
  // The Champions League, which runs alongside the league.
  europe?: boolean;
  // A league-phase game or a first leg: level is a fine result.
  noShootout?: boolean;
  // The second leg of a tie, settled on aggregate.
  secondLeg?: boolean;
}

export interface League {
  id: string;
  nationId: string;
  tier: number;
  name: string;
  clubIds: string[];
  fixtures: Fixture[];
  // League above this one, and how many clubs swap each season.
  parentId?: string;
  swap?: number;
}

export interface Tournament {
  id: string;
  name: string;
  year: number;
  teamIds: string[];
  groups: string[][];
  fixtures: Fixture[];
  // Matchday counter: group days first, then knockout rounds.
  day: number;
  groupDays: number;
  koLabels: string[];
  // Best third-placed teams that also go through.
  bestThirds: number;
  bracket: string[];
  championId?: string;
  done: boolean;
}

export interface QualifyingGroup {
  conf: Confederation;
  teamIds: string[];
}

export interface Qualifying {
  // The World Cup it is for.
  year: number;
  groups: QualifyingGroup[];
  // week is the matchday, 1 to rounds.
  fixtures: Fixture[];
  round: number;
  rounds: number;
  // Set once the last matchday is played.
  qualified?: string[];
}

// Names are copied in so honours survive players retiring and being deleted.
export interface Honour {
  season: number;
  title: string;
  winner: string;
  playerId?: string;
  clubId?: string;
}

export interface World {
  season: number;
  week: number;
  seasonWeeks: number;
  phase: 'season' | 'tournament';
  rngState: number;
  // The user's match in progress. Its seed is fixed so leaving and coming
  // back cannot reroll the result; once kicked off, an interrupted match is
  // simmed to the end rather than replayed.
  pendingMatch?: { fixtureId: string; seed: number; kicked?: boolean };
  nextId: number;
  nations: Nation[];
  leagues: League[];
  clubs: Record<string, Club>;
  nationalTeams: Record<string, Club>;
  players: Record<string, Player>;
  freeAgents: string[];
  honours: Honour[];
  tournaments: Tournament[];
  // The Champions League this season (see europe.ts).
  europe?: Europe;
  // Each league's final order last season, for who gets in.
  lastFinish?: Record<string, string[]>;
  // Global end-of-season awards, newest first.
  awards?: SeasonAwards[];
  // World Cup qualifying, played at the international breaks of the season
  // before a World Cup.
  qualifying?: Qualifying;
}

export interface AwardEntry {
  playerId: string;
  name: string;
  clubName: string;
  score: number;
}

export interface SeasonAwards {
  season: number;
  ballonDor: AwardEntry[];
  goldenBoy: AwardEntry[];
  yashin: AwardEntry[];
  goldenBoot: AwardEntry[];
}

export type MessageKind = 'news' | 'offer' | 'season' | 'media' | 'national';

export type ActionType =
  | 'club-offer'
  | 'renewal'
  | 'loan-offer'
  | 'sponsor'
  | 'media'
  | 'callup'
  | 'nation-switch'
  | 'sale-bid'
  | 'loan-request'
  | 'contract-demand'
  | 'transfer-request'
  | 'job'
  | 'nation-job'
  | 'club-interest';

export interface Choice {
  id: string;
  label: string;
  // Counter offers ask the user for an amount.
  needsAmount?: boolean;
}

export interface MessageAction {
  type: ActionType;
  choices: Choice[];
  clubId?: string;
  playerId?: string;
  nationId?: string;
  fee?: number;
  wage?: number;
  years?: number;
  weekly?: number;
  brand?: string;
  wageShare?: number;
  // Media: which event this is (see mediaEvents.ts).
  event?: string;
  // Rounds of haggling left before the other side walks away.
  patience?: number;
  // Counts down each week; the action expires when it passes zero.
  weeksLeft?: number;
  resolved?: string;
}

export interface Message {
  id: string;
  season: number;
  week: number;
  kind: MessageKind;
  title: string;
  body: string;
  read: boolean;
  action?: MessageAction;
}

export interface CareerState {
  playerId: string;
  energy: number;
  money: number;
  fame: number;
  items: string[];
  sponsors: { name: string; weekly: number; weeksLeft: number }[];
  trainedThisWeek: number;
  retired: boolean;
  // Weeks until the player can ask the club for something again.
  requestCooldown: number;
  // Progressive skills: XP fills levels, each level gives a skill point.
  xp: number;
  level: number;
  skillPoints: number;
  // A skill move in training, and how long it has left.
  moveTraining?: { id: string; weeksLeft: number; weeks: number };
  // Set when the player asked to leave; clubs come calling more often.
  wantsMove: boolean;
  // Relationship with clubs, -100..100, from offers, rejections and form.
  relations?: Record<string, number>;
  // Weeks until the player can offer himself to another club.
  pitchCooldown?: number;
  // Weeks until the next form warning from the coach.
  formWarnCooldown?: number;
  // Identity chosen at creation. Optional so older saves still load.
  look?: Look;
  number?: number;
  nickname?: string;
  celebration?: string;
  // Objectives, milestones, growth snapshots (see progress.ts).
  progress?: CareerProgress;
  flags?: Record<string, boolean>;
  // What the last match earned, for the full-time screen.
  lastMatch?: MatchReward;
  // What life off the pitch has left behind: arrests, bribes taken (each
  // one can come out later), a partner.
  life?: { arrests: number; bribes: number; partner?: string };
  // Weeks of low morale in a row, and whether it has become depression.
  lowWeeks?: number;
  depressed?: boolean;
  // Why the career ended, when it did not end by choice.
  endReason?: string;
  // Equipment from cases, and which piece is on in each slot.
  equipment?: { id: string; slot: 'boots' | 'gloves' | 'shinpads' | 'top' | 'headband' | 'watch'; name: string; rarity: 'common' | 'rare' | 'epic' | 'legendary'; attr: AttrKey; bonus: number }[];
  equipped?: Partial<Record<'boots' | 'gloves' | 'shinpads' | 'top' | 'headband' | 'watch', string>>;
}

export interface MatchReward {
  fixtureId: string;
  played: boolean;
  result: 'W' | 'D' | 'L';
  rating: number;
  goals: number;
  assists: number;
  xp: number;
  fame: number;
  money: number;
  levels: number;
  // XP bar before the match, so full time can fill it from there.
  xpBefore?: number;
  levelBefore?: number;
  motm: boolean;
  // Milestones and objectives this match unlocked.
  unlocks?: string[];
}

export interface Look {
  skin: number;
  hair: number;
  hairColor: number;
  boots: number;
}

export interface ManagerState {
  name: string;
  clubId: string | null;
  nationalTeamId: string | null;
  boardConfidence: number;
  nationConfidence: number;
  seasonsManaged: number;
  trophies: string[];
}

// A transfer in progress: fee agreed with the club, contract next.
export interface Negotiation {
  playerId: string;
  kind: 'buy' | 'loan';
  fee: number;
  swapPlayerId?: string;
  wageShare?: number;
  stage: 'fee' | 'contract';
  clubPatience: number;
  playerPatience: number;
  askWage: number;
  askYears: number;
  // The player's club when talks began. If he moves first, the talks are off.
  fromClubId?: string | null;
}

export type GameMode = 'career' | 'manager';

// One finished match of the user's team. The last three are for the career
// player, when he took part.
export interface MatchRecord {
  // Which side was the user's.
  teamId: string;
  season: number;
  week: number;
  comp: string;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  penaltyWinner?: string;
  pens?: [number, number];
  extraTime?: boolean;
  rating?: number;
  goals?: number;
  assists?: number;
}

export interface Game {
  version: number;
  mode: GameMode;
  world: World;
  career: CareerState | null;
  manager: ManagerState | null;
  inbox: Message[];
  negotiations: Record<string, Negotiation>;
  matchLog?: MatchRecord[];
}
