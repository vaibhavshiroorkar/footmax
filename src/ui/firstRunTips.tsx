import React from 'react';
import { Text, View } from 'react-native';
import { useSettings } from '../state/settings';
import { Button, Card, H2, IconName, Row, Sticker } from './kit';
import { colors, fonts } from './theme';

const TIPS: { icon: IconName; color: string; title: string; text: string }[] = [
  { icon: 'football', color: colors.accent, title: 'Play', text: 'Your big moments are yours to play.' },
  { icon: 'barbell', color: colors.blue, title: 'Train', text: 'Two sessions a week. Play them well for bigger gains.' },
  { icon: 'sparkles', color: colors.purple, title: 'Level up', text: 'Spend points on abilities and skill moves.' },
];

// Shown once on the first visit to the career home screen.
export function FirstRunTips() {
  const seen = useSettings((s) => s.seenTips);
  if (seen) return null;
  return (
    <Card glow={colors.accent}>
      <H2>Your career</H2>
      {TIPS.map((t) => (
        <Row key={t.title} gap={12} style={{ alignItems: 'flex-start' }}>
          <Sticker icon={t.icon} color={t.color} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.text }}>{t.title}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 18 }}>{t.text}</Text>
          </View>
        </Row>
      ))}
      <Button label="Got it" small onPress={() => useSettings.getState().set({ seenTips: true })} />
    </Card>
  );
}
