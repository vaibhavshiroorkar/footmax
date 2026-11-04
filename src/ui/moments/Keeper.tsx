import React, { memo } from 'react';
import { RigFigure } from '../rig/Figure';
import { dive as divePose, jump as jumpPose, ready, spread } from '../rig/poses';
import { Pt } from '../rig/skeleton';

// A goalkeeper standing on `ground` at `x`, about `h` units tall.
// dive -1..1 throws him toward that side at that share of full stretch. 0 is
// the set position. reach, in figure units from his feet, is where his gloves
// go when the ball sets it.
export const KeeperFigure = memo(function KeeperFigure({ x, ground, h = 60, dive = 0, kit = '#22c55e', skin = '#d9a77c', reach }: { x: number; ground: number; h?: number; dive?: number; kit?: string; skin?: string; reach?: Pt }) {
  const pose = dive === 0 ? ready() : divePose(Math.sign(dive), Math.abs(dive), reach);
  return <RigFigure x={x} ground={ground} h={h} pose={pose} kit={kit} skin={skin} gloves />;
});

// An outfield player seen from the front, standing on `ground` at `x`, `h`
// units tall. span: how wide his body and arms reach, in the same units as
// x, so a defender making himself big shows exactly the goal he hides.
export const OutfieldFigure = memo(function OutfieldFigure({ x, ground, h = 60, span, kit = '#c8102e', shorts = '#111827', skin = '#d9a77c', hair = '#2a1d14', jump = 0 }: { x: number; ground: number; h?: number; span?: number; kit?: string; shorts?: string; skin?: string; hair?: string; jump?: number }) {
  const s = h / 60;
  const pose = jump > 0 ? jumpPose(jump) : spread((span ?? 28 * s) / 2 / s);
  return <RigFigure x={x} ground={ground} h={h} pose={pose} lift={jump * 10} kit={kit} shorts={shorts} skin={skin} hair={hair} />;
});

// Keeper shirts: bright colours that clash with neither outfield kit.
const KEEPER_KITS = ['#22c55e', '#facc15', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export function colourGap(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

// What each side wears in a match: when the shirts are too alike the away
// side wears its second colour, and each keeper wears a colour that clashes
// with neither. The pitch and the moment games both use this.
export function matchKits(home: [string, string], away: [string, string]) {
  const awayShirt = colourGap(home[0], away[0]) < 140 && away[1] && colourGap(home[0], away[1]) > colourGap(home[0], away[0]) ? away[1] : away[0];
  const homeKeeper = keeperKit([home[0], awayShirt]);
  const awayKeeper = keeperKit([home[0], awayShirt, homeKeeper], homeKeeper);
  return { homeShirt: home[0], awayShirt, homeKeeper, awayKeeper };
}

// The keeper colour that stands out most from both teams' shirts.
export function keeperKit(avoid: string[], skip?: string): string {
  return [...KEEPER_KITS]
    .filter((k) => k !== skip)
    .sort((p, q) => Math.min(...avoid.map((c) => colourGap(q, c))) - Math.min(...avoid.map((c) => colourGap(p, c))))[0];
}
