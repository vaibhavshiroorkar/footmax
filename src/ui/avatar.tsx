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
      {/* Neck, then long hair that falls behind the head. */}
      <Rect x={43} y={56} width={14} height={16} rx={4} fill={shade(skin, -0.08)} />
      {style === 3 && <Path d="M30 42 C27 16 73 16 70 42 L73 70 L62 66 L62 48 L38 48 L38 66 L27 70 Z" fill={shade(hair, -0.12)} />}
      {/* Ears and head. The hair shapes below are drawn on this outline
          (top of the head at y 23), so they sit on the scalp. */}
      <Ellipse cx={33} cy={45} rx={3.2} ry={5} fill={shade(skin, -0.06)} />
      <Ellipse cx={67} cy={45} rx={3.2} ry={5} fill={shade(skin, -0.06)} />
      <Ellipse cx={50} cy={43} rx={17} ry={20} fill={skin} />
      <Path d="M41 39 Q43 37.5 46 39" stroke={shade(hair, 0.1)} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d="M54 39 Q57 37.5 59 39" stroke={shade(hair, 0.1)} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Circle cx={43.5} cy={44.5} r={2} fill="#2b1d14" />
      <Circle cx={56.5} cy={44.5} r={2} fill="#2b1d14" />
      <Path d="M50 46 L48.5 51 L51 51" stroke={shade(skin, -0.25)} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M44.5 55 Q50 58.5 55.5 55" stroke="#6b3b2a" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      {/* Hair */}
      {(style === 0 || style === 3) && (
        <Path d="M32 44 C30 29 37 17 50 17 C63 17 70 29 68 44 L66.5 44 C65.5 36 62.5 31.5 57 30 C52 33 44 33 38.5 31 C35.5 34 34 38 33.5 44 Z" fill={hair} />
      )}
      {style === 1 && <Path d="M33 41 C32 28 39 20.5 50 20.5 C61 20.5 68 28 67 41 C64.5 33.5 58 30 50 30 C42 30 35.5 33.5 33 41 Z" fill={hair} opacity={0.8} />}
      {style === 2 && (
        <>
          <Path d="M33 42 C31 28 38 19 50 19 C62 19 69 28 67 42 C64 34 58 31 50 31 C42 31 36 34 33 42 Z" fill={hair} />
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI + (i * Math.PI) / 8;
            return <Circle key={i} cx={50 + 17.5 * Math.cos(a)} cy={39 + 18 * Math.sin(a)} r={6.2} fill={hair} />;
          })}
        </>
      )}
      {style === 4 && (
        <>
          <Path d="M33 41 C32 28 39 20.5 50 20.5 C61 20.5 68 28 67 41 C64.5 33.5 58 30 50 30 C42 30 35.5 33.5 33 41 Z" fill={hair} opacity={0.35} />
          <Path d="M45 13 C47 11 53 11 55 13 L56.5 32 L43.5 32 Z" fill={hair} />
        </>
      )}
      {style === 5 && <Ellipse cx={44} cy={29} rx={5} ry={2.5} fill="#ffffff" opacity={0.25} />}
    </Svg>
  );
}
