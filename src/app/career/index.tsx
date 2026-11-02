import React from 'react';
import { Text } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useGame } from '../../state/store';
import { Button, Card, IconButton, Screen } from '../../ui/kit';
import { colors, fonts } from '../../ui/theme';
import { CareerSummary } from '../../ui/careerSummary';
import { FirstRunTips } from '../../ui/firstRunTips';
import { ObjectivesCard, SeasonReview } from '../../ui/progressCards';
import { ClaimCard, NextMatchCard, PlayerStrip, WeekChips } from '../../ui/playHub';

export default function CareerHub() {
  const game = useGame();
  const router = useRouter();
  if (!game || game.mode !== 'career' || !game.career) return <Redirect href="/" />;
  const c = game.career;
  const world = game.world;
  const p = world.players[c.playerId];
  const menu = <IconButton icon="home" label="Menu" onPress={() => router.replace('/')} />;

  if (c.retired) {
    return (
      <Screen title="Career over" back={false} right={menu}>
        <CareerSummary game={game} />
        <Button label="Back to menu" icon="home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  // One job: play this week's match. Everything else is a tap away.
  return (
    <Screen title="FootMax" back={false} right={menu} nav="career">
      <PlayerStrip game={game} />
      <ClaimCard game={game} />
      <FirstRunTips />
      <SeasonReview game={game} />
      {!p.clubId && (
        <Card glow={colors.gold}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>No club right now</Text>
          <Button label="Find a club" icon="briefcase" small variant="secondary" onPress={() => router.navigate('/career/clubs')} />
        </Card>
      )}
      <NextMatchCard game={game} />
      <WeekChips game={game} />
      <ObjectivesCard game={game} compact />
    </Screen>
  );
}
