import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { T } from '../kit';
import { colors } from '../theme';

const W = 300;
const H = 160;
const HEAD_X = 0.64;

// A cross swings in from the wing. Tap to jump as it reaches your head:
// the closer the timing, the better the header. Height and strength give
// a bigger window.
export function HeaderGame({ air, from = 'cross', onDone }: { air: number; from?: 'cross' | 'corner'; onDone: (q: number, text: string) => void }) {
  const [jumpAt, setJumpAt] = useState<number | null>(null);
  const [setup] = useState(() => ({ dur: 1.5 + Math.random() * 0.5, curve: 0.8 + Math.random() * 0.4 }));
  const done = jumpAt !== null;
  const t = useTicker(!done);
  const k = done ? jumpAt! : Math.min(1.15, t / setup.dur);
  const window = 0.09 + (air / 99) * 0.07;
  // The ball follows the dotted curve and reaches your head at HEAD_X.
  const u = k / HEAD_X;
  // A cross comes in low from the wing; a corner swings in high from the flag.
  const P0 = from === 'corner' ? { x: 8, y: 14 } : { x: 10, y: H - 20 };
  const C = from === 'corner' ? { x: W * 0.3, y: -H * (0.15 + (setup.curve - 1) * 0.1) } : { x: W * 0.45, y: H * (0.02 + (setup.curve - 1) * 0.1) };
  const P2 = { x: W * HEAD_X, y: H * 0.62 };
  const bx = (1 - u) * (1 - u) * P0.x + 2 * (1 - u) * u * C.x + u * u * P2.x;
  const by = (1 - u) * (1 - u) * P0.y + 2 * (1 - u) * u * C.y + u * u * P2.y;

  // No jump at all: the cross goes by. The panel closes on onDone.
  const ended = useRef(false);
  useEffect(() => {
    if (!done && !ended.current && t / setup.dur > 1.12) {
      ended.current = true;
      onDone(0.05, 'Too late. The ball flies past.');
    }
  });

  const jump = () => {
    if (done || ended.current) return;
    ended.current = true;
    const miss = Math.abs(k - HEAD_X);
    const q = Math.max(0, 1 - miss / window) * 0.9 + (miss < window * 0.3 ? 0.1 : 0);
    setJumpAt(k);
    onDone(q, q > 0.75 ? 'Perfect timing!' : q > 0.4 ? 'Good contact.' : q > 0 ? 'Glancing touch.' : k < HEAD_X ? 'Jumped too early.' : 'Jumped too late.');
  };
  const leap = done ? 14 : 0;

  return (
    <View style={{ gap: 8 }}>
      <T muted style={{ fontSize: 12.5, textAlign: 'center' }}>
        {done ? ' ' : from === 'corner' ? 'Corner! Tap to jump as it drops onto your head.' : 'Tap to jump as the cross reaches your head.'}
      </T>
      <Pressable onPressIn={jump} accessibilityRole="button" accessibilityLabel="Jump for the header">
        <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.pitch }}>
          <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
            <Rect x={0} y={0} width={W} height={H} fill={colors.pitch} />
            <Rect x={W - 40} y={50} width={36} height={80} fill="none" stroke="#ffffff" strokeWidth={3} />
            {from === 'corner' && <Path d="M 6 6 L 6 30 M 6 6 L 18 10 L 6 14" stroke="#facc15" strokeWidth={2} fill="#facc15" />}
            <Line x1={W - 40} y1={130} x2={W - 4} y2={130} stroke="#ffffff55" strokeWidth={1} />
            <Path d={`M ${P0.x} ${P0.y} Q ${C.x} ${C.y} ${P2.x} ${P2.y}`} stroke="#ffffff33" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
            {/* The timing window around your head. */}
            <Rect x={W * (HEAD_X - window)} y={H * 0.3} width={W * window * 2} height={H * 0.5} fill={colors.gold} fillOpacity={0.15} rx={8} />
            <Ellipse cx={W * HEAD_X} cy={H - 14} rx={14} ry={4} fill="#00000044" />
            <Rect x={W * HEAD_X - 8} y={H * 0.62 + 10 - leap} width={16} height={34} rx={6} fill={colors.gold} />
            <Circle cx={W * HEAD_X} cy={H * 0.62 - leap} r={10} fill="#f0c8a0" stroke={colors.gold} strokeWidth={2} />
            <Circle cx={Math.min(W + 10, bx)} cy={Math.min(H - 6, by)} r={7} fill="#ffffff" stroke="#111111" strokeWidth={1.5} />
          </Svg>
        </View>
      </Pressable>
    </View>
  );
}
