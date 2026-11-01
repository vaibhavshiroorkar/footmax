import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTicker } from './useTicker';
import { Button, Row, T } from '../kit';
import { colors } from '../theme';
import { PassOption } from '../../engine/match';

const BASE_LIMIT = 3.5;
const SPOTS = [
  { x: 60, y: 75 },
  { x: 150, y: 45 },
  { x: 240, y: 80 },
];

// Pick the open team-mate before the timer runs out. Markers crowd the
// team-mates who are covered.
export function PassGame({ options, names, playmaker = 0, onDone }: { options: PassOption[]; names: Record<string, string>; playmaker?: number; onDone: (q: number, text: string, playerId?: string) => void }) {
  // Playmaker gives more time on the ball.
  const LIMIT = BASE_LIMIT + 0.6 * playmaker;
  const [done, setDone] = useState<string | null>(null);
  const t = useTicker(!done);
  const finished = useRef(false);
  const markers = useMemo(
    () =>
      options.flatMap((o, i) => {
        const n = o.openness < 0.4 ? 2 : o.openness < 0.7 ? 1 : 0;
        return Array.from({ length: n }, (_, k) => ({ x: SPOTS[i].x + (k ? 16 : -14), y: SPOTS[i].y + (k ? -12 : 14) }));
      }),
    [options],
  );

  const choose = (o: PassOption | undefined, timedOut = false) => {
    if (finished.current) return;
    finished.current = true;
    const q = o ? clamp(o.openness * (1 - (0.35 * Math.min(t, LIMIT)) / LIMIT)) : 0.05;
    const text = timedOut ? 'Too slow! The chance is gone.' : q > 0.7 ? 'Great pass!' : q > 0.4 ? 'Risky ball...' : 'That one is well covered.';
    setDone(text);
    setTimeout(() => onDone(timedOut ? 0.05 : q, text, o?.playerId), 800);
  };

  useEffect(() => {
    if (t >= LIMIT && !done) choose([...options].sort((a, b) => a.openness - b.openness)[0], true);
  });

  const left = Math.max(0, 1 - t / LIMIT);
  return (
    <View>
      <Svg width="100%" height={210} viewBox="0 0 300 200">
        <Rect x={0} y={0} width={300} height={200} fill={colors.pitch} />
        <Rect x={90} y={0} width={120} height={36} stroke={colors.pitchLine} strokeWidth={2} fill="none" />
        <Line x1={0} y1={199} x2={300} y2={199} stroke={colors.pitchLine} strokeWidth={2} />
        {markers.map((m, i) => (
          <Circle key={`d${i}`} cx={m.x} cy={m.y} r={9} fill="#d94b4b" />
        ))}
        {options.map((o, i) => (
          <G key={o.playerId}>
            <Line x1={150} y1={175} x2={SPOTS[i].x} y2={SPOTS[i].y} stroke="#ffffff33" strokeWidth={2} strokeDasharray="5,5" />
            <Circle cx={SPOTS[i].x} cy={SPOTS[i].y} r={13} fill={colors.blue} stroke="#ffffff" strokeWidth={2} />
            <SvgText x={SPOTS[i].x} y={SPOTS[i].y + 30} fill="#ffffff" fontSize={11} fontWeight="bold" textAnchor="middle">
              {names[o.playerId]}
            </SvgText>
          </G>
        ))}
        <Circle cx={150} cy={175} r={12} fill={colors.gold} stroke="#ffffff" strokeWidth={2} />
      </Svg>
      <View style={{ height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden', marginVertical: 8 }}>
        <View style={{ width: `${left * 100}%`, height: 8, backgroundColor: left > 0.3 ? colors.accent : colors.red }} />
      </View>
      <T bold style={{ textAlign: 'center', marginBottom: 8 }}>
        {done ?? 'Who is open? Pick your pass.'}
      </T>
      <Row>
        {options.map((o) => (
          <Button key={o.playerId} label={names[o.playerId]} small variant="secondary" style={{ flex: 1 }} disabled={!!done} onPress={() => choose(o)} />
        ))}
      </Row>
    </View>
  );
}

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}
