// Which rules are in force. A career can start back in 2006/07, so the game
// plays by that season's laws, not today's.

export const MIN_PLAYERS = 7;

export interface Laws {
  var: boolean;
  maxSubs: number;
}

// First season each league used VAR. Everywhere else follows the last of them.
const VAR_FROM: Record<string, number> = { ITA: 2017, GER: 2017, ESP: 2018, FRA: 2018 };
const VAR_DEFAULT = 2019;

export function lawsFor(season: number, nationId?: string): Laws {
  return { var: season >= (VAR_FROM[nationId ?? ''] ?? VAR_DEFAULT), maxSubs: season >= 2022 ? 5 : 3 };
}

// Rates per match minute and per chance, tuned to real league numbers: about
// 4.2 yellows, 0.14 reds and 0.3 penalties a match.
export const CARD_PER_MINUTE = 0.047;
export const STRAIGHT_RED = 0.02;
export const PENALTY_PER_CHANCE = 0.018;
// Fouling to stop a sure goal without trying for the ball is a red.
export const PENALTY_RED = 0.14;

// Games a red card costs: one for two yellows, three for a straight red.
export const banFor = (straight: boolean) => (straight ? 3 : 1);

// How a goal can be taken away before it counts.
export const FLAG_CALL = 0.022;
export const FOUL_CALL = 0.016;
