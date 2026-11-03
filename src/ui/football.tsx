import React, { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, RadialGradient, Stop } from 'react-native-svg';

// A football: white with a black pentagon in the middle, five more cut off
// at the edge, and the seams between them. Drawn in a 20-unit box centred
// on 0, so it scales to any size.
const pent = (cx: number, cy: number, r: number, turn = 0) =>
  Array.from({ length: 5 }, (_, i) => {
    const a = turn + (-90 + i * 72) * (Math.PI / 180);
    return `${i ? 'L' : 'M'} ${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
  }).join(' ') + ' Z';

const CENTRE = pent(0, 0, 3.7);
const OUTER = Array.from({ length: 5 }, (_, i) => {
  const a = (-90 + 36 + i * 72) * (Math.PI / 180);
  return pent(Math.cos(a) * 9.6, Math.sin(a) * 9.6, 3.6, Math.PI / 5 + a + Math.PI / 2);
});
const SEAMS = Array.from({ length: 5 }, (_, i) => {
  const a = (-90 + i * 72) * (Math.PI / 180);
  return { x1: Math.cos(a) * 3.7, y1: Math.sin(a) * 3.7, x2: Math.cos(a) * 7.2, y2: Math.sin(a) * 7.2 };
});

function Panels({ id }: { id: string }) {
  return (
    <>
      <Defs>
        <ClipPath id={`${id}c`}>
          <Circle cx={0} cy={0} r={9.6} />
        </ClipPath>
        <RadialGradient id={`${id}g`} cx="35%" cy="30%" r="75%">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.7" stopColor="#eef1f5" />
          <Stop offset="1" stopColor="#b9c0cb" />
        </RadialGradient>
      </Defs>
      <Circle cx={0} cy={0} r={9.6} fill={`url(#${id}g)`} />
      <G clipPath={`url(#${id}c)`}>
        <Path d={CENTRE} fill="#16181d" />
        {OUTER.map((d, i) => (
          <Path key={i} d={d} fill="#16181d" />
        ))}
        {SEAMS.map((s, i) => (
          <Line key={i} {...s} stroke="#16181d" strokeWidth={0.8} />
        ))}
      </G>
      <Circle cx={0} cy={0} r={9.6} fill="none" stroke="#111111" strokeWidth={0.9} />
    </>
  );
}

// For inside an Svg: a ball of radius r at (cx, cy), turned by rot degrees.
export function Football({ cx, cy, r, rot = 0, opacity = 1 }: { cx: number; cy: number; r: number; rot?: number; opacity?: number }) {
  const id = `fb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <G transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${r / 10})`} opacity={opacity}>
      <Panels id={id} />
    </G>
  );
}

// On its own: a ball filling its box, for places drawn without an Svg.
export function FootballIcon({ size = '100%' }: { size?: number | string }) {
  const id = `fb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="-10 -10 20 20">
      <Panels id={id} />
    </Svg>
  );
}
