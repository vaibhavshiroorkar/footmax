import React, { useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame } from '../state/store';
import { Card, H2, Pill, Row, Screen, T, Tabs } from '../ui/kit';
import { colors } from '../ui/theme';
import { groupTable, tournamentsForSummer } from '../engine/international';
import { teamById } from '../engine/lineup';
import { userTeamId } from '../engine/game';

const SHORT: Record<string, string> = { wc: 'World Cup', euro: 'Euro', copa: 'Copa', afcon: 'AFCON', asian: 'Asian Cup', gold: 'Gold Cup', unl: 'Nations Lg' };

export default function Tournaments() {
  const game = useGame();
  const [index, setIndex] = useState('0');
  if (!game) return <Redirect href="/" />;
  const world = game.world;
  const mine = userTeamId(game);
  const myNation = game.career ? world.nations.find((n) => n.id === world.players[game.career!.playerId].nationId)?.teamId : game.manager?.nationalTeamId;
  const past = world.honours.filter((h) => /World Cup|European Championship|Copa America|Africa Cup|Asian Cup|Gold Cup|Nations League/.test(h.title));

  if (!world.tournaments.length) {
    const next = tournamentsForSummer(world.season + 1);
    return (
      <Screen title="Internationals" nav={game.mode === 'manager' && !game.manager?.clubId && game.manager?.nationalTeamId ? 'manager' : undefined}>
        <Card>
          <H2>Summer {world.season + 1}</H2>
          <T muted>Coming after the league season: {next.map((t) => t.name).join(', ')}.</T>
          <T muted style={{ fontSize: 13 }}>
            Teams qualify on form. International breaks fall in weeks 9, 20 and 30.
          </T>
        </Card>
        <Card>
          <H2>Past winners</H2>
          {past.length === 0 && <T muted>No tournaments played yet.</T>}
          {past.map((h, i) => (
            <T key={i} style={{ color: h.clubId === myNation ? colors.gold : colors.text }}>
              {h.title}: {h.winner}
            </T>
          ))}
        </Card>
      </Screen>
    );
  }

  const t = world.tournaments[Number(index)] ?? world.tournaments[0];
  const name = (id: string) => teamById(world, id).name;
  const stages = [...new Set(t.fixtures.filter((f) => f.stage !== 'Group').map((f) => f.stage!))];

  return (
    <Screen title="Internationals" nav={game.mode === 'manager' && !game.manager?.clubId && game.manager?.nationalTeamId ? 'manager' : undefined}>
      <Tabs tabs={world.tournaments.map((x, i) => ({ key: String(i), label: SHORT[x.id.replace(/\d+$/, '')] ?? x.name }))} value={index} onChange={setIndex} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>{t.name}</H2>
          {t.championId ? <Pill label={`Won by ${name(t.championId)}`} color={colors.gold} /> : <Pill label={`Day ${t.day}`} color={colors.accent} />}
        </Row>
        <T muted style={{ fontSize: 13 }}>
          {t.teamIds.length} teams{t.teamIds.includes(myNation ?? '') ? `, including ${name(myNation!)}` : ''}.
        </T>
      </Card>
      {stages.reverse().map((stage) => (
        <Card key={stage}>
          <H2>{stage}</H2>
          {t.fixtures
            .filter((f) => f.stage === stage)
            .map((f) => (
              <Row key={f.id} style={{ paddingVertical: 2 }}>
                <T style={{ flex: 1, textAlign: 'right', fontSize: 13 }} bold={f.homeId === mine}>
                  {name(f.homeId)}
                </T>
                <T bold style={{ width: 70, textAlign: 'center', fontSize: 13 }}>
                  {f.played ? `${f.homeGoals}-${f.awayGoals}${f.penaltyWinner ? ' p' : ''}` : 'vs'}
                </T>
                <T style={{ flex: 1, fontSize: 13 }} bold={f.awayId === mine}>
                  {name(f.awayId)}
                </T>
              </Row>
            ))}
        </Card>
      ))}
      {t.groups.map((g, gi) => (
        <Card key={gi}>
          <H2>Group {String.fromCharCode(65 + gi)}</H2>
          {groupTable(world, t, g).map((r, i) => (
            <Row key={r.clubId} style={{ paddingVertical: 2 }}>
              <T style={{ width: 20, fontSize: 13, color: i < 2 ? colors.accent : colors.text }}>{i + 1}</T>
              <T style={{ flex: 1, fontSize: 13 }} bold={r.clubId === mine || r.clubId === myNation}>
                {name(r.clubId)}
              </T>
              <T muted style={{ width: 60, fontSize: 12, textAlign: 'right' }}>
                {r.won}-{r.drawn}-{r.lost}
              </T>
              <T muted style={{ width: 36, fontSize: 12, textAlign: 'right' }}>
                {r.gd > 0 ? `+${r.gd}` : r.gd}
              </T>
              <T bold style={{ width: 30, fontSize: 13, textAlign: 'right' }}>
                {r.points}
              </T>
            </Row>
          ))}
        </Card>
      ))}
      <View style={{ height: 8 }} />
    </Screen>
  );
}
