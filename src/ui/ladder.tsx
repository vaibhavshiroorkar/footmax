import React from 'react';
import { Text, View } from 'react-native';
import { Game } from '../engine/types';
import { leagueStrength, nationById, targetOverall } from '../engine/generator';
import { overall } from '../engine/player';
import { Card, Icon, IconName, Row, T } from './kit';
import { alpha, colors, fonts } from './theme';

// The climb from the smallest leagues to the biggest, by how strong the
// player's current league is (average club reputation).
export const RUNGS: { label: string; min: number; icon: IconName; color: string }[] = [
  { label: 'Grassroots', min: 0, icon: 'leaf', color: '#8fa3b8' },
  { label: 'Semi-pro', min: 35, icon: 'football', color: colors.teal },
  { label: 'Professional', min: 50, icon: 'shield-checkmark', color: colors.blue },
  { label: 'Top flight', min: 63, icon: 'star', color: colors.purple },
  { label: 'Elite', min: 76, icon: 'trophy', color: colors.gold },
];

export function rungOf(strength: number): number {
  let i = 0;
  RUNGS.forEach((r, k) => {
    if (strength >= r.min) i = k;
  });
  return i;
}

export function LadderCard({ game }: { game: Game }) {
  const world = game.world;
  const p = world.players[game.career!.playerId];
  const club = p.clubId ? world.clubs[p.clubId] : null;
  const league = club?.leagueId ? world.leagues.find((l) => l.id === club.leagueId) : undefined;
  if (!club || !league) return null;
  const strength = leagueStrength(world, league);
  const at = rungOf(strength);
  const next = RUNGS[at + 1];
  // Clubs offer when the player is within a few points of their level.
  const needed = next ? targetOverall(next.min) - 5 : 0;
  const ovr = overall(p);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.muted, letterSpacing: 1.2 }}>CAREER LADDER</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }} numberOfLines={1}>
            {league.name}
          </Text>
          <T muted style={{ fontSize: 12 }}>
            {nationById(world, league.nationId)?.name ?? ''}  |  {RUNGS[at].label}
          </T>
        </View>
        <Icon name={RUNGS[at].icon} size={28} color={RUNGS[at].color} />
      </Row>
      <Row gap={4}>
        {RUNGS.map((r, i) => (
          <View key={r.label} style={{ flex: 1, gap: 4, alignItems: 'center' }}>
            <View style={{ alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: i <= at ? r.color : colors.bgElev, borderWidth: i === at ? 1.5 : 0, borderColor: '#ffffff' }} />
            <Text style={{ fontFamily: i === at ? fonts.bold : fonts.medium, fontSize: 10.5, color: i <= at ? colors.text : colors.faint }} numberOfLines={1}>
              {r.label}
            </Text>
          </View>
        ))}
      </Row>
      {next ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: alpha(next.color, 0.1) }}>
          <Icon name="trending-up" size={16} color={next.color} />
          <T style={{ flex: 1, fontSize: 12.5 }}>
            {ovr >= needed ? `${next.label} clubs can call now. Shine in the transfer window (weeks 1-5 and 19-22).` : `Reach about ${needed} overall (now ${ovr}) and ${next.label.toLowerCase()} clubs start calling.`}
          </T>
        </View>
      ) : (
        <T muted style={{ fontSize: 12.5 }}>
          You made it to the top. Now win everything.
        </T>
      )}
    </Card>
  );
}
