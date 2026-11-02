import React from 'react';
import { Circle, G, Path, Rect } from 'react-native-svg';

// A goalkeeper drawn standing on `ground` at `x`, about `h` units tall.
// dive -1..1 tips him over toward that side, arms first, the way a keeper
// throws himself at a ball; 0 is the set position, arms out and ready.
export function KeeperFigure({ x, ground, h = 60, dive = 0, kit = '#22c55e', skin = '#d9a77c' }: { x: number; ground: number; h?: number; dive?: number; kit?: string; skin?: string }) {
  const s = h / 60;
  const angle = dive * 72;
  // Lift off the ground as he dives.
  const lift = Math.abs(dive) * 10;
  const trim = '#111827';
  return (
    <G transform={`translate(${x} ${ground - lift * s}) rotate(${angle}) scale(${s})`}>
      {/* Shadow stays on the grass. */}
      <Path d="M -14 0 Q 0 4 14 0 Q 0 -3 -14 0 Z" fill="#000000" opacity={0.25} transform={`rotate(${-angle}) translate(0 ${lift})`} />
      {/* Boots and legs, slightly apart. */}
      <Rect x={-10} y={-3} width={8} height={4} rx={2} fill="#f8fafc" />
      <Rect x={2} y={-3} width={8} height={4} rx={2} fill="#f8fafc" />
      <Rect x={-9} y={-22} width={6.5} height={20} rx={3} fill={trim} />
      <Rect x={2.5} y={-22} width={6.5} height={20} rx={3} fill={trim} />
      {/* Shorts and shirt. */}
      <Rect x={-10.5} y={-29} width={21} height={9} rx={3} fill={trim} />
      <Path d="M -11 -29 L -12.5 -46 Q 0 -51 12.5 -46 L 11 -29 Z" fill={kit} />
      <Path d="M -4 -48 L 0 -44 L 4 -48" stroke={trim} strokeWidth={1.6} fill="none" />
      {/* Arms out and up, gloves big and bright. */}
      <Path d="M -11 -44 Q -18 -48 -22 -56" stroke={kit} strokeWidth={5.5} strokeLinecap="round" fill="none" />
      <Path d="M 11 -44 Q 18 -48 22 -56" stroke={kit} strokeWidth={5.5} strokeLinecap="round" fill="none" />
      <Circle cx={-23} cy={-58} r={4.6} fill="#f8fafc" stroke={trim} strokeWidth={1} />
      <Circle cx={23} cy={-58} r={4.6} fill="#f8fafc" stroke={trim} strokeWidth={1} />
      {/* Head and hair. */}
      <Rect x={-2.5} y={-53} width={5} height={5} fill={skin} />
      <Circle cx={0} cy={-57} r={6.2} fill={skin} />
      <Path d="M -6.2 -58 Q -6 -64.5 0 -64.5 Q 6 -64.5 6.2 -58 Q 3 -61 0 -61 Q -3 -61 -6.2 -58 Z" fill="#2a1d14" />
    </G>
  );
}

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

// The keeper colour that stands out most from both teams' shirts.
export function keeperKit(avoid: string[], skip?: string): string {
  return [...KEEPER_KITS]
    .filter((k) => k !== skip)
    .sort((p, q) => Math.min(...avoid.map((c) => colourGap(q, c))) - Math.min(...avoid.map((c) => colourGap(p, c))))[0];
}
