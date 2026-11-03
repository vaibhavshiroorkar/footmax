import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { Card, H2, Icon, Row, T, haptic } from './kit';
import { alpha, colors, fonts } from './theme';
import { SEASONS, seasonLabel } from '../data/seasons';
import { DataPack } from '../data/pack';
import { START_YEAR } from '../engine/generator';
import { useStore } from '../state/store';

// The season a new game starts in: today's by default, back to 2006/07.
// Seasons whose squads are not in yet show a lock.
export function SeasonPicker({ value, onChange }: { value: number; onChange: (year: number) => void }) {
  const showToast = useStore((s) => s.showToast);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>Season</H2>
        <T muted style={{ fontSize: 12.5 }}>
          {value === START_YEAR ? "Today's squads" : `Squads of ${seasonLabel(value)}`}
        </T>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {SEASONS.map((s) => {
          const active = s.year === value;
          return (
            <Pressable
              key={s.year}
              onPress={() => {
                haptic();
                if (!s.ready) return showToast(`Squads for ${s.label} are on the way.`);
                onChange(s.year);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: !s.ready }}
              accessibilityLabel={`Season ${s.label}${s.ready ? '' : ', locked'}`}
              style={{ minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1.5, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? alpha(colors.accent, 0.14) : colors.bgElev, opacity: s.ready ? 1 : 0.55 }}
            >
              {!s.ready && <Icon name="lock-closed" size={12} color={colors.faint} />}
              <Text style={{ fontFamily: fonts.display, fontSize: 18, color: active ? colors.accent : colors.text }}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Card>
  );
}

// Loads the pack for a season. null while loading.
export function useSeasonPack(year: number): DataPack | null {
  const [pack, setPack] = useState<{ year: number; pack: DataPack } | null>(null);
  useEffect(() => {
    let live = true;
    const opt = SEASONS.find((s) => s.year === year) ?? SEASONS[0];
    opt
      .load()
      .then((p) => live && setPack({ year, pack: p }))
      // A pack that fails to load falls back to today's squads.
      .catch(() => SEASONS[0].load().then((p) => live && setPack({ year, pack: p })));
    return () => {
      live = false;
    };
  }, [year]);
  return pack && pack.year === year ? pack.pack : null;
}
