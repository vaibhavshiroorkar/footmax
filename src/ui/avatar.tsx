import React, { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText, Ellipse } from 'react-native-svg';
import { Look } from '../engine/types';
import { fonts, shade } from './theme';

export const SKINS = ['#f6d7c3', '#eac09a', '#d39b6f', '#a8714a', '#7b4c2d', '#4e2f1c'];
export const HAIR_COLORS = ['#1b1612', '#4a2f1b', '#8a5a2b', '#d9b064', '#b4472a', '#cfcfcf'];
export const HAIR_STYLES = ['Short', 'Buzz', 'Curly', 'Long', 'Mohawk', 'Bald'];
export const BOOT_COLORS = ['#ff5f6d', '#2ee88a', '#19c3e6', '#ffcf4a', '#ffffff', '#a98bff'];


// Head-and-shoulders portrait in the club's shirt with the player's number.
export function Avatar({ look, number, kit, size = 64 }: { look: Look; number?: number; kit: [string, string]; size?: number }) {
  const id = `av${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const skin = SKINS[look.skin % SKINS.length];
  const hair = HAIR_COLORS[look.hairColor % HAIR_COLORS.length];
  const boots = BOOT_COLORS[look.boots % BOOT_COLORS.length];
  const shirt = kit[0];
  const trim = kit[1];
  const style = look.hair % HAIR_STYLES.length;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={shade(shirt === '#ffffff' ? trim : shirt, -0.45)} />
          <Stop offset="1" stopColor={shade(shirt === '#ffffff' ? trim : shirt, -0.75)} />
        </LinearGradient>
      </Defs>
      <Circle cx={50} cy={50} r={49} fill={`url(#${id}bg)`} />
      {/* Shirt */}
      <Path d="M14 100 C16 78 30 70 50 70 C70 70 84 78 86 100 Z" fill={shirt} />
      <Path d="M40 70 L50 80 L60 70" stroke={trim} strokeWidth={4} fill="none" />
      <Rect x={14} y={95} width={72} height={5} fill={boots} />
      <SvgText x={50} y={96} fontSize={15} fontFamily={fonts.display} fontWeight="bold" fill={trim} textAnchor="middle">
        {number ?? ''}
      </SvgText>
      {/* Neck and head */}
      <Rect x={43} y={58} width={14} height={14} rx={4} fill={shade(skin, -0.08)} />
      {style === 3 && <Path d="M28 40 C28 22 72 22 72 40 L74 66 L64 62 L64 44 L36 44 L36 62 L26 66 Z" fill={hair} />}
      <Ellipse cx={50} cy={42} rx={18} ry={21} fill={skin} />
      <Circle cx={43} cy={44} r={2} fill="#2b1d14" />
      <Circle cx={57} cy={44} r={2} fill="#2b1d14" />
      <Path d="M44 53 Q50 57 56 53" stroke="#6b3b2a" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      {style === 0 && <Path d="M31 38 C31 18 69 18 69 38 C64 30 56 28 50 28 C42 28 36 30 31 38 Z" fill={hair} />}
      {style === 1 && <Path d="M32 34 C34 20 66 20 68 34 C60 28 40 28 32 34 Z" fill={hair} opacity={0.85} />}
      {style === 2 && [32, 39, 46, 53, 60, 67].map((x, i) => <Circle key={i} cx={x} cy={26 + (i % 2) * 3} r={7} fill={hair} />)}
      {style === 3 && <Path d="M32 36 C32 20 68 20 68 36 C60 28 40 28 32 36 Z" fill={hair} />}
      {style === 4 && <Path d="M45 14 L55 14 L56 34 L44 34 Z" fill={hair} />}
    </Svg>
  );
}
