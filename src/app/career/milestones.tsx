import React from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame } from '../../state/store';
import { Card, FadeIn, Icon, IconName, Pill, Row, Screen, StatBar, Sticker, T } from '../../ui/kit';
import { alpha, colors, fonts } from '../../ui/theme';
import { MILESTONES, progressOf } from '../../engine/progress';

export default function Milestones() {
  const game = useGame();
  if (!game?.career) return <Redirect href="/" />;
  const pr = progressOf(game);
  const got = new Set(pr.milestones);
  return (
    <Screen title="Milestones">
      <Card>
        <Row gap={10}>
          <Sticker icon="ribbon" color={colors.pink} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.text }}>
              {got.size} of {MILESTONES.length} unlocked
            </Text>
            <T muted style={{ fontSize: 12.5 }}>Each one gives XP and fame.</T>
          </View>
        </Row>
        <StatBar label="" value={got.size} max={MILESTONES.length} color={colors.pink} right=" " />
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {MILESTONES.map((m, i) => {
          const on = got.has(m.id);
          return (
            <FadeIn key={m.id} index={i} style={{ width: '48%' }}>
              <View style={{ backgroundColor: on ? colors.card : 'rgba(255,255,255,0.02)', borderRadius: 18, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: on ? alpha(colors.gold, 0.4) : colors.border }}>
                {on ? <Sticker icon={m.icon as IconName} color={colors.gold} size={50} /> : <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.bgElev, alignItems: 'center', justifyContent: 'center' }}><Icon name="lock-closed" size={22} color={colors.faint} /></View>}
                <Text style={{ fontFamily: fonts.display, fontSize: 15, color: on ? colors.text : colors.muted, textAlign: 'center' }}>{m.label}</Text>
                <Pill label={`+${m.xp} XP`} color={on ? colors.accent : colors.faint} solid={on} />
              </View>
            </FadeIn>
          );
        })}
      </View>
    </Screen>
  );
}
