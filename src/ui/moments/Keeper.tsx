import React from 'react';
import { Circle, G, Path, Rect } from 'react-native-svg';

// A goalkeeper drawn standing on `ground` at `x`, about `h` units tall.
// dive -1..1 throws him toward that side: he leaves the ground, the body
// stretches out flat, arms reach past his head for the ball and the legs
// trail. 0 is the set position: knees bent, weight forward, hands ready.
export function KeeperFigure({ x, ground, h = 60, dive = 0, kit = '#22c55e', skin = '#d9a77c' }: { x: number; ground: number; h?: number; dive?: number; kit?: string; skin?: string }) {
  const s = h / 60;
  const d = Math.abs(dive);
  const side = Math.sign(dive) || 1;
  const angle = dive * 78;
  // Up off the grass in an arc as he dives.
  const lift = Math.sin(Math.min(1, d) * Math.PI * 0.8) * 16 + d * 4;
  const trim = '#111827';
  // Arms: ready (low and wide) to full stretch (straight up past the head).
  const ax = 20 - d * 12;
  const ay = -40 - d * 28;
  const bend = 1 - d;
  return (
    <G transform={`translate(${x} ${ground - lift * s}) rotate(${angle}) scale(${s})`}>
      {/* Shadow stays on the grass. */}
      <Path d="M -16 0 Q 0 5 16 0 Q 0 -3 -16 0 Z" fill="#000000" opacity={0.28} transform={`rotate(${-angle}) translate(0 ${lift})`} />
      {/* Legs: knees bent in the set position, trailing straight in a dive. */}
      <Path d={`M -5 -24 Q ${-9 - bend * 4} -12 ${-8 - d * 2} 0`} stroke={trim} strokeWidth={6.5} strokeLinecap="round" fill="none" />
      <Path d={`M 5 -24 Q ${9 + bend * 4} -12 ${8 + d * 2} 0`} stroke={trim} strokeWidth={6.5} strokeLinecap="round" fill="none" />
      <Path d={`M -5 -9 L ${-8 - d * 2} -1`} stroke="#e5e7eb" strokeWidth={6} strokeLinecap="round" />
      <Path d={`M 5 -9 L ${8 + d * 2} -1`} stroke="#e5e7eb" strokeWidth={6} strokeLinecap="round" />
      <Rect x={-13 - d * 2} y={-2} width={9} height={4} rx={2} fill="#0f172a" />
      <Rect x={4 + d * 2} y={-2} width={9} height={4} rx={2} fill="#0f172a" />
      {/* Shorts, then a shirt with shoulders and a collar. */}
      <Path d="M -11 -31 L -12 -21 Q -6 -19 -1 -21 L 0 -24 L 1 -21 Q 6 -19 12 -21 L 11 -31 Z" fill={trim} />
      <Path d="M -11 -31 Q -13 -40 -14 -46 Q -8 -51 0 -51 Q 8 -51 14 -46 Q 13 -40 11 -31 Z" fill={kit} />
      <Path d="M -11 -31 Q 0 -29 11 -31" stroke="#000000" strokeOpacity={0.2} strokeWidth={2} fill="none" />
      <Path d="M -4 -50 L 0 -46 L 4 -50" stroke={trim} strokeWidth={1.6} fill="none" />
      {/* Arms with elbows, then big gloves. */}
      <Path d={`M -12 -46 Q ${-ax - 4 * bend} ${(ay - 46) / 2 + 6 * bend} ${-ax} ${ay}`} stroke={kit} strokeWidth={5.5} strokeLinecap="round" fill="none" />
      <Path d={`M 12 -46 Q ${ax + 4 * bend} ${(ay - 46) / 2 + 6 * bend} ${ax} ${ay}`} stroke={kit} strokeWidth={5.5} strokeLinecap="round" fill="none" />
      <Circle cx={-ax} cy={ay - 2} r={5} fill="#f8fafc" stroke={trim} strokeWidth={1} />
      <Circle cx={ax} cy={ay - 2} r={5} fill="#f8fafc" stroke={trim} strokeWidth={1} />
      {/* Neck, head and hair; the head turns toward the ball in a dive. */}
      <Rect x={-2.5} y={-55} width={5} height={6} fill={skin} />
      <G transform={`translate(${side * d * 2} 0)`}>
        <Circle cx={0} cy={-59} r={6.4} fill={skin} />
        <Path d="M -6.4 -60 Q -6.2 -67 0 -67 Q 6.2 -67 6.4 -60 Q 3 -63 0 -63 Q -3 -63 -6.4 -60 Z" fill="#2a1d14" />
        <Circle cx={-2.2} cy={-59} r={0.9} fill="#1f2937" />
        <Circle cx={2.2} cy={-59} r={0.9} fill="#1f2937" />
      </G>
    </G>
  );
}

// An outfield player seen from the front, standing on `ground` at `x`, `h`
// units tall. span: how wide his body and arms reach, in the same units as
// x, so a defender making himself big shows exactly the goal he hides.
export function OutfieldFigure({ x, ground, h = 60, span, kit = '#c8102e', shorts = '#111827', skin = '#d9a77c', hair = '#2a1d14', jump = 0 }: { x: number; ground: number; h?: number; span?: number; kit?: string; shorts?: string; skin?: string; hair?: string; jump?: number }) {
  const s = h / 60;
  // Half the reach of the arms in body units; at least the shoulders.
  const reach = Math.max(14, (span ?? 28 * s) / 2 / s);
  const hand = Math.min(reach, 30);
  const handY = -40 + Math.max(0, reach - 16) * 0.35;
  return (
    <G transform={`translate(${x} ${ground - jump * 10 * s}) scale(${s})`}>
      <Path d="M -14 0 Q 0 4 14 0 Q 0 -3 -14 0 Z" fill="#000000" opacity={0.25} transform={`translate(0 ${jump * 10})`} />
      {/* Legs: socks, shins, boots. */}
      <Path d="M -5 -24 L -6.5 -2" stroke={skin} strokeWidth={6} strokeLinecap="round" />
      <Path d="M 5 -24 L 6.5 -2" stroke={skin} strokeWidth={6} strokeLinecap="round" />
      <Path d="M -6 -12 L -6.5 -2" stroke={kit} strokeWidth={6.4} strokeLinecap="round" />
      <Path d="M 6 -12 L 6.5 -2" stroke={kit} strokeWidth={6.4} strokeLinecap="round" />
      <Rect x={-11} y={-2} width={8} height={4} rx={2} fill="#0f172a" />
      <Rect x={3} y={-2} width={8} height={4} rx={2} fill="#0f172a" />
      <Path d="M -10.5 -32 L -11 -21 Q -6 -19 -1 -21 L 0 -24 L 1 -21 Q 6 -19 11 -21 L 10.5 -32 Z" fill={shorts} />
      {/* Arms out to the side, as far as span says. */}
      <Path d={`M -11 -46 Q ${-hand * 0.7} ${handY - 4} ${-hand} ${handY}`} stroke={kit} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d={`M 11 -46 Q ${hand * 0.7} ${handY - 4} ${hand} ${handY}`} stroke={kit} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Circle cx={-hand} cy={handY} r={2.8} fill={skin} />
      <Circle cx={hand} cy={handY} r={2.8} fill={skin} />
      <Path d="M -10.5 -32 Q -12.5 -40 -13 -46 Q -7 -50 0 -50 Q 7 -50 13 -46 Q 12.5 -40 10.5 -32 Z" fill={kit} />
      <Path d="M -4 -49.5 L 0 -46 L 4 -49.5" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={1.4} fill="none" />
      <Rect x={-2.5} y={-54} width={5} height={5} fill={skin} />
      <Circle cx={0} cy={-58} r={6.2} fill={skin} />
      <Path d="M -6.2 -59 Q -6 -65.5 0 -65.5 Q 6 -65.5 6.2 -59 Q 3 -62 0 -62 Q -3 -62 -6.2 -59 Z" fill={hair} />
      <Circle cx={-2.1} cy={-58} r={0.9} fill="#1f2937" />
      <Circle cx={2.1} cy={-58} r={0.9} fill="#1f2937" />
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
