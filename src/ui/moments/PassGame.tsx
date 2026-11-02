import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTicker } from './useTicker';
import { T } from '../kit';
import { alpha, colors, fonts } from '../theme';
import { PassKind, PassOption } from '../../engine/match';

const BASE_LIMIT = 4.5;

// Where each kind of ball goes on the little pitch (the goal is at the top).
const PLACE: Record<PassKind, { x: number; y: number }[]> = {
  through: [{ x: 150, y: 46 }],
  cross: [{ x: 262, y: 58 }],
  square: [{ x: 70, y: 102 }, { x: 228, y: 104 }],
  safe: [{ x: 58, y: 160 }, { x: 242, y: 162 }],
};

const LABEL: Record<PassKind, { name: string; hint: string }> = {
  through: { name: 'Through ball', hint: 'Behind the defence' },
  cross: { name: 'Cross', hint: 'For a header' },
  square: { name: 'Square it', hint: 'Across the box' },
  safe: { name: 'One-two', hint: 'Lay it off, get it back' },
};

function Bars({ value, color }: { value: number; color: string }) {
  const n = Math.max(1, Math.round(value * 5));
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={{ width: 9, height: 6, borderRadius: 2, backgroundColor: i < n ? color : colors.bgElev }} />
      ))}
    </View>
  );
}

// Pick your pass. Every option trades safety against danger: the ball that
// is sure to arrive rarely leads to a goal, the killer ball often does not
// arrive. Decide fast; the longer you wait, the more the defence closes.
export function PassGame({ options, names, playmaker = 0, onDone }: { options: PassOption[]; names: Record<string, string>; playmaker?: number; onDone: (q: number, text: string, playerId?: string) => void }) {
  const LIMIT = BASE_LIMIT + 0.6 * playmaker;
  const [done, setDone] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const t = useTicker(!done);
  const finished = useRef(false);
  const placed = useMemo(() => {
    const used: Partial<Record<PassKind, number>> = {};
    return options.map((o) => {
      const kind = o.kind ?? 'square';
      const k = used[kind] ?? 0;
      used[kind] = k + 1;
      const spot = PLACE[kind][k % PLACE[kind].length];
      const markers = o.openness < 0.45 ? 2 : o.openness < 0.75 ? 1 : 0;
      return { o, kind, spot, markers };
    });
  }, [options]);

  const choose = (o: PassOption | undefined, timedOut = false) => {
    if (finished.current) return;
    finished.current = true;
    // Waiting lets defenders close the lanes.
    const q = o ? clamp(o.openness * (1 - (0.4 * Math.min(t, LIMIT)) / LIMIT) + 0.1) : 0.05;
    const text = timedOut ? 'Too slow! Closed down.' : q > 0.7 ? 'Perfectly weighted!' : q > 0.45 ? 'It might get there...' : 'Brave ball...';
    setPicked(o?.playerId ?? null);
    setDone(text);
    setTimeout(() => onDone(timedOut ? 0.05 : q, text, o?.playerId), 700);
  };

  useEffect(() => {
    if (t >= LIMIT && !done) choose([...options].sort((a, b) => a.openness - b.openness)[0], true);
  });

  const left = Math.max(0, 1 - t / LIMIT);
  return (
    <View style={{ gap: 8 }}>
      <Svg width="100%" height={200} viewBox="0 0 300 200">
        <Rect x={0} y={0} width={300} height={200} fill={colors.pitch} />
        <Rect x={70} y={0} width={160} height={52} stroke={colors.pitchLine} strokeWidth={2} fill="none" />
        <Rect x={120} y={0} width={60} height={18} stroke={colors.pitchLine} strokeWidth={2} fill="none" />
        <Path d="M 110 52 A 40 40 0 0 0 190 52" stroke={colors.pitchLine} strokeWidth={2} fill="none" />
        {/* A back line the through ball has to beat. */}
        <Line x1={20} y1={66} x2={280} y2={66} stroke="#ffffff22" strokeWidth={1} strokeDasharray="3,4" />
        {[60, 120, 180, 240].map((x) => (
          <Circle key={x} cx={x} cy={70} r={8} fill="#d94b4b" opacity={0.85} />
        ))}
        {placed.map(({ o, spot, markers }) => (
          <G key={o.playerId}>
            <Line x1={150} y1={182} x2={spot.x} y2={spot.y} stroke={picked === o.playerId ? colors.gold : '#ffffff40'} strokeWidth={picked === o.playerId ? 3 : 2} strokeDasharray="5,5" />
            {Array.from({ length: markers }, (_, k) => (
              <Circle key={k} cx={spot.x + (k ? 15 : -15)} cy={spot.y + (k ? -9 : 10)} r={8} fill="#d94b4b" />
            ))}
            <Circle cx={spot.x} cy={spot.y} r={13} fill={colors.blue} stroke={picked === o.playerId ? colors.gold : '#ffffff'} strokeWidth={2.5} />
            <SvgText x={spot.x} y={spot.y + 27} fill="#ffffff" fontSize={11} fontWeight="bold" fontFamily={fonts.bold} textAnchor="middle">
              {names[o.playerId]}
            </SvgText>
          </G>
        ))}
        <Circle cx={150} cy={182} r={12} fill={colors.gold} stroke="#ffffff" strokeWidth={2} />
      </Svg>
      <View style={{ height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${left * 100}%`, height: 8, backgroundColor: left > 0.3 ? colors.accent : colors.red }} />
      </View>
      <T bold style={{ textAlign: 'center' }}>
        {done ?? 'Safe or deadly? Pick your pass.'}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {placed.map(({ o, kind }) => (
          <Pressable
            key={o.playerId}
            disabled={!!done}
            onPress={() => choose(o)}
            accessibilityRole="button"
            accessibilityLabel={`${LABEL[kind].name} to ${names[o.playerId]}`}
            style={({ pressed }) => ({
              flexBasis: '48%',
              flexGrow: 1,
              padding: 10,
              gap: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: picked === o.playerId ? colors.gold : colors.border,
              backgroundColor: pressed ? alpha(colors.accent, 0.14) : colors.bgElev,
              opacity: done && picked !== o.playerId ? 0.5 : 1,
            })}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.text }} numberOfLines={1}>
              {LABEL[kind].name}
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted }} numberOfLines={1}>
              {names[o.playerId]}  |  {LABEL[kind].hint}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ width: 46, fontFamily: fonts.semibold, fontSize: 11, color: colors.muted }}>Safe</Text>
              <Bars value={o.openness} color={colors.accent} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ width: 46, fontFamily: fonts.semibold, fontSize: 11, color: colors.muted }}>Danger</Text>
              <Bars value={(o.threat ?? 0.12) / 0.32} color={colors.red} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}
