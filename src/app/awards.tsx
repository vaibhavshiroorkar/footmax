import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame } from '../state/store';
import { Card, H2, Icon, IconName, Row, Screen, T, Tabs } from '../ui/kit';
import { alpha, colors, fonts, gradients } from '../ui/theme';
import { AWARD_NAMES, computeAwards } from '../engine/awards';
import { AwardEntry, SeasonAwards } from '../engine/types';

type Key = keyof typeof AWARD_NAMES;
const ICONS: Record<Key, IconName> = { ballonDor: 'trophy', goldenBoy: 'star', yashin: 'hand-left', goldenBoot: 'football' };

export default function Awards() {
  const game = useGame();
  const [key, setKey] = useState<Key>('ballonDor');
  const [seasonIdx, setSeasonIdx] = useState(0);
  if (!game) return <Redirect href="/" />;
  const past = game.world.awards ?? [];
  // Before the first ceremony, show the live race for this season.
  const live = game.world.phase === 'season' && game.world.week > 1 ? computeAwards(game, Math.max(1, Math.min(10, Math.floor(game.world.week * 0.3)))) : null;
  const options: { label: string; a: SeasonAwards; live: boolean }[] = [
    ...(live ? [{ label: `${live.season} race`, a: live, live: true }] : []),
    ...past.map((a) => ({ label: `${a.season}/${String(a.season + 1).slice(2)}`, a, live: false })),
  ];
  const chosen = options[Math.min(seasonIdx, options.length - 1)];
  const me = game.career?.playerId;
  const list: AwardEntry[] = chosen?.a[key] ?? [];

  return (
    <Screen title="Awards">
      <Tabs<Key> tabs={(Object.keys(AWARD_NAMES) as Key[]).map((k) => ({ key: k, label: AWARD_NAMES[k].replace('European ', '').replace(' Trophy', '') }))} value={key} onChange={setKey} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o, i) => (
          <Text key={o.label} onPress={() => setSeasonIdx(i)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, overflow: 'hidden', borderColor: i === seasonIdx ? colors.gold : colors.border, color: i === seasonIdx ? colors.ink : colors.muted, backgroundColor: i === seasonIdx ? colors.gold : colors.card, fontFamily: fonts.semibold, fontSize: 12 }}>
            {o.label}
          </Text>
        ))}
      </View>
      {!chosen && <T muted>The race starts after the first week. Awards are handed out when the league season ends.</T>}
      {chosen && list[0] && (
        <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: alpha(colors.gold, 0.45) }}>
          <LinearGradient colors={[alpha(colors.gold, 0.28), alpha(colors.gold, 0.06), colors.card]} style={{ padding: 20, alignItems: 'center', gap: 8 }}>
            <LinearGradient colors={gradients.gold as unknown as [string, string]} style={{ width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={ICONS[key]} size={34} color="#1a1200" />
            </LinearGradient>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.gold, letterSpacing: 1.6 }}>{chosen.live ? 'CURRENT FAVOURITE' : 'WINNER'}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 38, color: colors.text, textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' }}>{list[0].name}</Text>
            <Text style={{ fontFamily: fonts.body, color: colors.muted }}>{list[0].clubName}</Text>
            {list[0].playerId === me && <Text style={{ fontFamily: fonts.semibold, color: colors.accent }}>{"That's you!"}</Text>}
          </LinearGradient>
        </View>
      )}
      {chosen && (
        <Card>
          <H2>{AWARD_NAMES[key]} {chosen.live ? 'race' : 'rankings'}</H2>
          {list.map((e, i) => {
            const mine = e.playerId === me;
            return (
              <Row key={e.playerId} gap={10} style={[{ paddingVertical: 6, paddingHorizontal: 6, borderRadius: 10 }, mine && { backgroundColor: alpha(colors.gold, 0.14) }]}>
                <Text style={{ width: 26, fontFamily: fonts.display, fontSize: 17, color: i < 3 ? colors.gold : colors.muted }}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: mine ? fonts.bold : fonts.semibold, fontSize: 14, color: colors.text }}>{e.name}</Text>
                  <T muted style={{ fontSize: 11.5 }}>
                    {e.clubName}
                  </T>
                </View>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{key === 'goldenBoot' ? `${Math.floor(e.score)} goals` : e.score}</Text>
              </Row>
            );
          })}
          {list.length === 0 && <T muted>No eligible players yet.</T>}
        </Card>
      )}
    </Screen>
  );
}
