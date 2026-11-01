import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame, useStore } from '../../state/store';
import { Badge, Button, Card, H2, Icon, Pill, Row, Screen, StatBar, T } from '../../ui/kit';
import { colors, fonts } from '../../ui/theme';
import { canPitch, coachTrust, interestedClubs, offerSelf, relationMod, trustLabel } from '../../engine/relations';
import { formAverage } from '../../engine/lineup';
import { leagueOf } from '../../engine/league';
import { targetOverall } from '../../engine/generator';

function interestColor(v: number) {
  return v >= 70 ? colors.accent : v >= 45 ? colors.gold : colors.red;
}

export default function Clubs() {
  const game = useGame();
  const mutate = useStore((s) => s.mutate);
  const showToast = useStore((s) => s.showToast);
  const [showAll, setShowAll] = useState(false);
  if (!game?.career) return <Redirect href="/" />;
  const p = game.world.players[game.career.playerId];
  const club = p.clubId ? game.world.clubs[p.clubId] : null;
  const trust = coachTrust(game);
  const form = formAverage(p);
  const blocked = canPitch(game);
  const list = interestedClubs(game, showAll ? 60 : 15);

  return (
    <Screen title="Clubs">
      {club && (
        <Card tint={club.colors[0] === '#ffffff' ? club.colors[1] : club.colors[0]}>
          <Row gap={12}>
            <Badge club={club} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>{club.name}</Text>
              <T muted style={{ fontSize: 12.5 }}>
                Your club  |  Coach: {trustLabel(trust)}
              </T>
            </View>
          </Row>
          <StatBar label="Coach's trust" icon="person" value={trust} color={interestColor(trust)} />
          <T muted style={{ fontSize: 12.5 }}>
            {form === null ? 'Play some games so the coach can judge you.' : `Recent form: ${form.toFixed(1)} average over your last ${p.form?.length} games. Under 6.2 and you risk the bench; over 7.3 and the coach builds the team around you.`}
          </T>
        </Card>
      )}
      <Card>
        <Row gap={8}>
          <Icon name="briefcase" size={18} color={colors.gold} />
          <H2>Offer yourself</H2>
        </Row>
        <T muted style={{ fontSize: 13 }}>
          Your agent can pitch you to one club every 3 weeks, during transfer windows or while you are a free agent. Interest grows with your rating, fame and form. Turning clubs down hurts the relationship.
        </T>
        {blocked && <Pill label={blocked} icon="time" color={colors.gold} />}
        {list.length > 0 && list[0].interest < 30 && <T muted style={{ fontSize: 12.5 }}>Nobody is keen yet. Raise your rating and string together good games, and these numbers climb.</T>}
      </Card>
      {list.map(({ clubId, interest }) => {
        const c = game.world.clubs[clubId];
        const rel = relationMod(game, clubId);
        return (
          <Card key={clubId}>
            <Row gap={12}>
              <Badge club={c} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }} numberOfLines={1}>
                  {c.name}
                </Text>
                <T muted style={{ fontSize: 12 }}>
                  {leagueOf(game.world, clubId)?.name}  |  squad level {targetOverall(c.reputation)}
                  {rel ? `  |  history ${rel > 0 ? '+' : ''}${rel}` : ''}
                </T>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: interestColor(interest) }}>{interest}</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 9, color: colors.muted }}>INTEREST</Text>
              </View>
            </Row>
            <Button label="Offer yourself" icon="paper-plane" small variant="secondary" disabled={!!blocked} onPress={() => showToast(mutate((g) => offerSelf(g, clubId)))} />
          </Card>
        );
      })}
      {!showAll && <Button label="Show more clubs" variant="ghost" small onPress={() => setShowAll(true)} />}
      {list.length === 0 && <T muted>No clubs at your level right now.</T>}
      <T muted style={{ fontSize: 11.5, textAlign: 'center' }}>
        Interest runs 0 to 100. 70 or more means they are keen.
      </T>
    </Screen>
  );
}
