import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTicker } from './useTicker';
import { T } from '../kit';
import { alpha, colors, fonts } from '../theme';
import { PassKind, PassOption } from '../../engine/match';

const BASE_LIMIT = 5;

export const PASS_LABEL: Record<PassKind, { name: string; hint: string; color: string }> = {
  through: { name: 'Through ball', hint: 'Behind the defence', color: '#ff5f6d' },
  cross: { name: 'Cross', hint: 'For a header', color: '#a98bff' },
  square: { name: 'Square it', hint: 'Across the box', color: '#ffcf4a' },
  safe: { name: 'One-two', hint: 'Lay it off, get it back', color: '#2ee88a' },
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

// The pass decision. The options also light up on the live pitch, where a
// tap on a team-mate picks him (see LivePitch targets). Every option trades
// safety against danger, and waiting lets the defence close the lanes.
// onShoot: forget the pass and have a go yourself.
export function PassPanel({ options, names, playmaker = 0, picked, onDone, onShoot }: { options: PassOption[]; names: Record<string, string>; playmaker?: number; picked?: string | null; onDone: (q: number, text: string, playerId?: string) => void; onShoot?: () => void }) {
  const LIMIT = BASE_LIMIT + 0.6 * playmaker;
  const [done, setDone] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const t = useTicker(!done);
  const finished = useRef(false);

  const choose = (o: PassOption | undefined, timedOut = false) => {
    if (finished.current) return;
    finished.current = true;
    const q = o ? clamp(o.openness * (1 - (0.4 * Math.min(t, LIMIT)) / LIMIT) + 0.1) : 0.05;
    const text = timedOut ? 'Too slow! Closed down.' : q > 0.7 ? 'Perfectly weighted!' : q > 0.45 ? 'It might get there...' : 'Brave ball...';
    setChosen(o?.playerId ?? null);
    setDone(text);
    setTimeout(() => onDone(timedOut ? 0.05 : q, text, o?.playerId), 600);
  };

  // A tap on the pitch arrives here as `picked`.
  useEffect(() => {
    if (picked && !done) choose(options.find((o) => o.playerId === picked));
  });
  useEffect(() => {
    if (t >= LIMIT && !done) choose([...options].sort((a, b) => a.openness - b.openness)[0], true);
  });

  const left = Math.max(0, 1 - t / LIMIT);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${left * 100}%`, height: 8, backgroundColor: left > 0.3 ? colors.green : colors.red }} />
      </View>
      <T bold style={{ textAlign: 'center' }}>
        {done ?? 'Tap a lit-up team-mate, or shoot yourself.'}
      </T>
      {onShoot && !done && (
        <Pressable
          onPress={() => {
            finished.current = true;
            onShoot();
          }}
          accessibilityRole="button"
          accessibilityLabel="Shoot instead"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 12, backgroundColor: pressed ? colors.accentDark : colors.accent, borderBottomWidth: 4, borderBottomColor: '#5a7a22' })}
        >
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink }}>SHOOT</Text>
        </Pressable>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => {
          const kind = o.kind ?? 'square';
          const look = PASS_LABEL[kind];
          return (
            <Pressable
              key={o.playerId}
              disabled={!!done}
              onPress={() => choose(o)}
              accessibilityRole="button"
              accessibilityLabel={`${look.name} to ${names[o.playerId]}`}
              style={({ pressed }) => ({
                flexBasis: '48%',
                flexGrow: 1,
                padding: 10,
                gap: 4,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: chosen === o.playerId ? colors.gold : alpha(look.color, 0.6),
                backgroundColor: pressed ? alpha(look.color, 0.16) : colors.bgElev,
                opacity: done && chosen !== o.playerId ? 0.5 : 1,
              })}
            >
              <Text style={{ fontFamily: fonts.display, fontSize: 16, color: look.color }} numberOfLines={1}>
                {look.name}
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted }} numberOfLines={1}>
                {names[o.playerId]}  |  {look.hint}
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
          );
        })}
      </View>
    </View>
  );
}

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}
