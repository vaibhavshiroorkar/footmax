import React from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame } from '../../state/store';
import { Card, Icon, Row, Screen, SectionLabel, T } from '../../ui/kit';
import { NavGrid } from '../../ui/shared';
import { colors, fonts } from '../../ui/theme';

// The store is locked until it has a payment setup and a decision on what
// buying a legend does. Players appear by name only, never by face.
const LEGENDS: { name: string; pos: string; nation: string }[] = [
  { name: 'Lamine Yamal', pos: 'RW', nation: 'ESP' },
  { name: 'Erling Haaland', pos: 'ST', nation: 'NOR' },
  { name: 'Kylian Mbappe', pos: 'ST', nation: 'FRA' },
  { name: 'Lionel Messi', pos: 'RW', nation: 'ARG' },
  { name: 'Cristiano Ronaldo', pos: 'ST', nation: 'POR' },
  { name: 'Neymar', pos: 'LW', nation: 'BRA' },
  { name: 'Diego Maradona', pos: 'CAM', nation: 'ARG' },
  { name: 'Eusebio', pos: 'ST', nation: 'POR' },
  { name: 'Pele', pos: 'ST', nation: 'BRA' },
];

// Everything that is not part of the weekly loop of train and play.
export default function More() {
  const game = useGame();
  if (!game?.career) return <Redirect href="/" />;
  return (
    <Screen title="More" nav="career">
      {/* Grouped by what you want to do; Life and Clubs are also on Play. */}
      <SectionLabel icon="person-outline">Your career</SectionLabel>
      <NavGrid
        items={[
          { label: 'Life', sub: 'Spend money: shop, sponsors', href: '/career/life', icon: 'wallet', color: colors.gold },
          { label: 'Clubs', sub: 'Fame: offer yourself', href: '/career/clubs', icon: 'briefcase', color: colors.teal },
        ]}
      />
      <SectionLabel icon="football-outline">Football</SectionLabel>
      <NavGrid
        items={[
          { label: 'League', sub: 'Tables and results', href: '/league', icon: 'podium', color: colors.blue },
          { label: 'Internationals', sub: 'Tournaments', href: '/tournaments', icon: 'earth', color: colors.orange },
          { label: 'Awards', sub: "Ballon d'Or race", href: '/awards', icon: 'medal', color: colors.gold },
          { label: 'Honours', sub: 'Trophy history', href: '/honours', icon: 'trophy', color: colors.purple },
        ]}
      />
      <SectionLabel icon="options-outline">Other</SectionLabel>
      <NavGrid
        items={[
          { label: 'Leaderboards', sub: 'Best careers online', href: '/leaderboards', icon: 'stats-chart', color: colors.accent },
          { label: 'Settings', sub: 'Speed, motion, account', href: '/settings', icon: 'settings-outline', color: colors.muted },
        ]}
      />

      <SectionLabel icon="storefront-outline">Store</SectionLabel>
      <Card>
        <Row gap={10}>
          <Icon name="lock-closed" size={20} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>Legends: coming soon</Text>
            <T muted style={{ fontSize: 12.5 }}>
              {`The store is locked for now. Coming: ${LEGENDS.map((l) => l.name).join(', ')}.`}
            </T>
          </View>
        </Row>
      </Card>
    </Screen>
  );
}
