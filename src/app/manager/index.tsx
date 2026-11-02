import React from 'react';
import { Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useGame } from '../../state/store';
import { Badge, Card, Icon, IconButton, Pill, RatingRing, Row, Screen, StatBar, StatTile, T } from '../../ui/kit';
import { FixtureCard, MatchdayButton, NavGrid, NavItem, inboxBadge } from '../../ui/shared';
import { TeamHero } from '../../ui/hero';
import { colors, fonts } from '../../ui/theme';
import { boardMood, expectedRank, managerClub, managerNation, ordinal, weeklyIncome, weeklyWages } from '../../engine/manager';
import { formatMoney } from '../../engine/player';
import { targetOverall } from '../../engine/generator';
import { teamRating } from '../../engine/international';

export default function ManagerHub() {
  const game = useGame();
  const router = useRouter();
  if (!game || game.mode !== 'manager' || !game.manager) return <Redirect href="/" />;
  const m = game.manager;
  const club = managerClub(game);
  const nation = managerNation(game);
  const menu = <IconButton icon="home" label="Menu" onPress={() => router.replace('/')} />;

  const nav: NavItem[] = [
    ...(club
      ? [
          { label: 'Squad', sub: `${club.playerIds.length} players`, href: '/manager/squad', icon: 'people' as const, color: colors.accent },
          { label: 'Tactics', sub: `${club.formation}, ${club.style}`, href: '/manager/tactics', icon: 'git-network' as const, color: colors.teal },
          { label: 'Transfers', sub: 'Search every player', href: '/manager/transfers', icon: 'swap-horizontal' as const, color: colors.gold },
        ]
      : []),
    ...(nation ? [{ label: nation.name, sub: 'National squad', href: '/manager/national', icon: 'flag' as const, color: colors.orange }] : []),
    { label: 'Inbox', sub: 'Bids, demands, jobs', href: '/inbox', badge: inboxBadge(game), icon: 'mail', color: colors.pink },
    { label: 'League', sub: 'Tables and results', href: '/league', icon: 'podium', color: colors.blue },
    { label: 'Internationals', sub: 'Tournaments', href: '/tournaments', icon: 'earth', color: colors.purple },
    { label: 'Awards', sub: "Ballon d'Or race", href: '/awards', icon: 'medal', color: colors.gold },
    { label: 'Honours', sub: 'Trophy history', href: '/honours', icon: 'trophy', color: colors.gold },
    { label: 'Leaderboards', sub: 'Best managers online', href: '/leaderboards', icon: 'stats-chart', color: colors.accent },
    { label: 'Settings', sub: 'Speed, motion, account', href: '/settings', icon: 'settings-outline', color: colors.muted },
  ];

  const income = club ? (weeklyIncome(game, club, true) + weeklyIncome(game, club, false)) / 2 : 0;
  const wages = club ? weeklyWages(game, club) : 0;

  return (
    <Screen title="Manager" back={false} right={menu} nav="manager">
      <TeamHero
        club={club ?? nation}
        kicker={`Manager  |  ${m.seasonsManaged} season${m.seasonsManaged === 1 ? '' : 's'}  |  ${m.trophies.length} troph${m.trophies.length === 1 ? 'y' : 'ies'}`}
        title={club?.name ?? nation?.name ?? 'Out of work'}
        subtitle={club ? `${m.name}  |  Rep ${club.reputation}, squad level ${targetOverall(club.reputation)}` : m.name}
        right={club ? <RatingRing value={m.boardConfidence} max={100} label="BOARD" light /> : undefined}
      >
        {club ? (
          <Row gap={8}>
            <StatTile light label="Budget" value={formatMoney(club.budget)} icon="wallet" color={club.budget < 0 ? colors.red : colors.green} />
            <StatTile light label="Wages/wk" value={formatMoney(wages)} icon="cash" color={colors.gold} />
            <StatTile light label="Income/wk" value={formatMoney(income)} icon="trending-up" color={colors.teal} />
          </Row>
        ) : (
          !nation && <T>Job offers arrive in your inbox. Keep moving through the weeks.</T>
        )}
      </TeamHero>

      {club && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={6}>
              <Icon name="business" size={15} color={colors.gold} />
              <Text style={{ fontFamily: fonts.semibold, color: colors.text }}>Board: {boardMood(m.boardConfidence)}</Text>
            </Row>
            <Pill label={`Target: ${ordinal(expectedRank(game, club))}`} icon="flag" color={colors.gold} />
          </Row>
          <StatBar label="Board confidence" value={m.boardConfidence} color={m.boardConfidence < 30 ? colors.red : colors.gold} />
        </Card>
      )}
      {nation && (
        <Card tint={nation.colors[0]}>
          <Row gap={12}>
            <Badge club={nation} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>{nation.name}</Text>
              <T muted style={{ fontSize: 12.5 }}>
                National team  |  Squad rating {Math.round(teamRating(game.world, nation))}
              </T>
            </View>
          </Row>
          <StatBar label="Federation confidence" icon="flag" value={m.nationConfidence} color={m.nationConfidence < 30 ? colors.red : colors.blue} />
        </Card>
      )}
      <FixtureCard game={game} clubId={club?.id ?? null} />
      <MatchdayButton game={game} />
      <NavGrid items={nav} />
    </Screen>
  );
}
