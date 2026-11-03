import React from 'react';
import { Text } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useGame } from '../../state/store';
import { Button, Card, IconButton, Screen } from '../../ui/kit';
import { colors, fonts } from '../../ui/theme';
import { CareerSummary } from '../../ui/careerSummary';
import { FirstRunTips } from '../../ui/firstRunTips';
import { NextMatchCard, PlayerStrip, Shortcuts } from '../../ui/playHub';

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
        {c.endReason && (
          <Card glow={colors.red}>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>{c.endReason}</Text>
          </Card>
        )}
        <CareerSummary game={game} />
        <Button label="Back to menu" icon="home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  // One job: play this week's match. Everything else is a tap away, and
  // nothing pops in here: rewards and the season review live on Me.
  return (
    <Screen title="FootMax" back={false} right={menu} nav="career">
      <PlayerStrip game={game} />
      {(p.suspendedWeeks ?? 0) > 0 && (
        <Card glow={colors.red}>
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.text }}>Banned: {p.suspendedWeeks} more week{p.suspendedWeeks === 1 ? '' : 's'}</Text>
        </Card>
      )}
      <FirstRunTips />
      {!p.clubId && (
        <Card glow={colors.gold}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text }}>No club right now</Text>
          <Button label="Find a club" icon="briefcase" small variant="secondary" onPress={() => router.navigate('/career/clubs')} />
        </Card>
      )}
      <NextMatchCard game={game} />
      <Shortcuts />
    </Screen>
  );
}
