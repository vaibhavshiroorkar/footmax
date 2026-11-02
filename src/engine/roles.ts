import { AttrKey, Formation, Position } from './types';

// Exact roles sit on top of the four broad positions. Lineups and team
// strength still use the broad position; roles shape ratings, starting
// attributes and which key moments a career player gets.

export const ROLE_LIST = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'] as const;
export type Role = (typeof ROLE_LIST)[number];

export interface RoleDef {
  label: string;
  broad: Position;
  weights: Partial<Record<AttrKey, number>>;
  // When the user's player is the shooter: chance the moment is a dribble.
  dribbleShare: number;
  // Chance an opponent chance becomes a defensive moment (tackle or save).
  defends: number;
  // Rough spot on a pitch diagram, 0..1 from own goal (y) and left (x).
  spot: { x: number; y: number };
}

export const ROLES: Record<Role, RoleDef> = {
  GK: { label: 'Goalkeeper', broad: 'GK', weights: { goalkeeping: 0.6, composure: 0.15, physical: 0.1, passing: 0.1, pace: 0.05 }, dribbleShare: 0, defends: 0.65, spot: { x: 0.5, y: 0.05 } },
  CB: { label: 'Centre-back', broad: 'DEF', weights: { defending: 0.45, physical: 0.25, composure: 0.1, passing: 0.1, pace: 0.1 }, dribbleShare: 0.1, defends: 0.5, spot: { x: 0.5, y: 0.2 } },
  LB: { label: 'Left-back', broad: 'DEF', weights: { defending: 0.3, pace: 0.25, passing: 0.15, physical: 0.15, dribbling: 0.1, vision: 0.05 }, dribbleShare: 0.4, defends: 0.35, spot: { x: 0.12, y: 0.25 } },
  RB: { label: 'Right-back', broad: 'DEF', weights: { defending: 0.3, pace: 0.25, passing: 0.15, physical: 0.15, dribbling: 0.1, vision: 0.05 }, dribbleShare: 0.4, defends: 0.35, spot: { x: 0.88, y: 0.25 } },
  LWB: { label: 'Left wing-back', broad: 'DEF', weights: { pace: 0.25, defending: 0.2, passing: 0.2, dribbling: 0.15, physical: 0.15, vision: 0.05 }, dribbleShare: 0.5, defends: 0.25, spot: { x: 0.08, y: 0.4 } },
  RWB: { label: 'Right wing-back', broad: 'DEF', weights: { pace: 0.25, defending: 0.2, passing: 0.2, dribbling: 0.15, physical: 0.15, vision: 0.05 }, dribbleShare: 0.5, defends: 0.25, spot: { x: 0.92, y: 0.4 } },
  CDM: { label: 'Defensive midfielder', broad: 'MID', weights: { defending: 0.35, passing: 0.2, physical: 0.2, vision: 0.1, composure: 0.15 }, dribbleShare: 0.2, defends: 0.35, spot: { x: 0.5, y: 0.38 } },
  CM: { label: 'Central midfielder', broad: 'MID', weights: { passing: 0.3, vision: 0.2, dribbling: 0.15, physical: 0.1, defending: 0.1, composure: 0.1, shooting: 0.05 }, dribbleShare: 0.3, defends: 0.15, spot: { x: 0.5, y: 0.5 } },
  CAM: { label: 'Attacking midfielder', broad: 'MID', weights: { vision: 0.3, passing: 0.25, dribbling: 0.2, shooting: 0.15, composure: 0.1 }, dribbleShare: 0.4, defends: 0, spot: { x: 0.5, y: 0.66 } },
  LM: { label: 'Left midfielder', broad: 'MID', weights: { pace: 0.2, passing: 0.25, dribbling: 0.25, vision: 0.1, shooting: 0.1, physical: 0.1 }, dribbleShare: 0.5, defends: 0.1, spot: { x: 0.12, y: 0.55 } },
  RM: { label: 'Right midfielder', broad: 'MID', weights: { pace: 0.2, passing: 0.25, dribbling: 0.25, vision: 0.1, shooting: 0.1, physical: 0.1 }, dribbleShare: 0.5, defends: 0.1, spot: { x: 0.88, y: 0.55 } },
  LW: { label: 'Left winger', broad: 'FWD', weights: { pace: 0.25, dribbling: 0.3, shooting: 0.2, passing: 0.1, composure: 0.1, vision: 0.05 }, dribbleShare: 0.55, defends: 0, spot: { x: 0.15, y: 0.78 } },
  RW: { label: 'Right winger', broad: 'FWD', weights: { pace: 0.25, dribbling: 0.3, shooting: 0.2, passing: 0.1, composure: 0.1, vision: 0.05 }, dribbleShare: 0.55, defends: 0, spot: { x: 0.85, y: 0.78 } },
  CF: { label: 'Centre-forward', broad: 'FWD', weights: { shooting: 0.25, dribbling: 0.2, vision: 0.15, passing: 0.15, composure: 0.15, pace: 0.1 }, dribbleShare: 0.4, defends: 0, spot: { x: 0.5, y: 0.8 } },
  ST: { label: 'Striker', broad: 'FWD', weights: { shooting: 0.35, composure: 0.2, pace: 0.15, physical: 0.15, dribbling: 0.15 }, dribbleShare: 0.25, defends: 0, spot: { x: 0.5, y: 0.9 } },
};

export const ROLE_NEIGHBOURS: Record<Role, Role[]> = {
  GK: [],
  CB: ['LB', 'RB', 'CDM'],
  LB: ['LWB', 'CB', 'LM'],
  RB: ['RWB', 'CB', 'RM'],
  LWB: ['LB', 'LM', 'LW'],
  RWB: ['RB', 'RM', 'RW'],
  CDM: ['CM', 'CB'],
  CM: ['CDM', 'CAM', 'LM', 'RM'],
  CAM: ['CM', 'CF', 'LW', 'RW'],
  LM: ['LW', 'CM', 'LWB'],
  RM: ['RW', 'CM', 'RWB'],
  LW: ['RW', 'LM', 'CF', 'ST'],
  RW: ['LW', 'RM', 'CF', 'ST'],
  CF: ['ST', 'CAM', 'LW', 'RW'],
  ST: ['CF', 'LW', 'RW'],
};

export function isRole(code: string): code is Role {
  return (ROLE_LIST as readonly string[]).includes(code);
}

export function rolesFor(broad: Position): Role[] {
  return ROLE_LIST.filter((r) => ROLES[r].broad === broad);
}

// Unlocked by career level.
export const SECONDARY_ROLE_LEVEL = 6;
export const SECONDARY_ROLE_COST = 2;

// The named positions in each formation, one row per line from the back,
// matching the formation string ("4-2-3-1" has four rows). Midfield wide
// slots are LM/RM so they stay midfielders, as the lineup picks by line.
export const FORMATION_SLOTS: Record<Formation, Role[][]> = {
  '4-4-2': [
    ['LB', 'CB', 'CB', 'RB'],
    ['LM', 'CM', 'CM', 'RM'],
    ['ST', 'ST'],
  ],
  '4-3-3': [
    ['LB', 'CB', 'CB', 'RB'],
    ['CM', 'CDM', 'CM'],
    ['LW', 'ST', 'RW'],
  ],
  '3-5-2': [
    ['CB', 'CB', 'CB'],
    ['LM', 'CM', 'CDM', 'CM', 'RM'],
    ['ST', 'ST'],
  ],
  '4-2-3-1': [
    ['LB', 'CB', 'CB', 'RB'],
    ['CDM', 'CDM'],
    ['LW', 'CAM', 'RW'],
    ['ST'],
  ],
};

// How common each role is among generated players of a broad position.
const ROLE_SHARE: Record<Position, [Role, number][]> = {
  GK: [['GK', 1]],
  DEF: [
    ['CB', 5],
    ['LB', 2],
    ['RB', 2],
    ['LWB', 0.5],
    ['RWB', 0.5],
  ],
  MID: [
    ['CM', 4],
    ['CDM', 2],
    ['CAM', 2],
    ['LM', 1],
    ['RM', 1],
  ],
  FWD: [
    ['ST', 4],
    ['LW', 2],
    ['RW', 2],
    ['CF', 1],
  ],
};

// A role for a generated player of this broad position. r is 0..1.
export function rollRole(position: Position, r: number): Role {
  const list = ROLE_SHARE[position];
  const total = list.reduce((s, [, w]) => s + w, 0);
  let x = r * total;
  for (const [role, w] of list) {
    if ((x -= w) < 0) return role;
  }
  return list[0][0];
}
