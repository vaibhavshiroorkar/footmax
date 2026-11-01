import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame } from '../state/store';
import { Card, Row, Screen, T, Tabs } from '../ui/kit';
import { colors, fonts } from '../ui/theme';
import { leagueOf, leagueTable } from '../engine/league';
import { userClubId } from '../engine/season';
import { squad } from '../engine/lineup';
import { shortName } from '../engine/player';

type Tab = 'table' | 'results' | 'scorers';

export default function LeagueScreen() {
  const game = useGame();
  const myClub = game ? userClubId(game) : null;
  const [leagueId, setLeagueId] = useState<string | null>(myClub && game ? leagueOf(game.world, myClub)?.id ?? null : null);
  const [tab, setTab] = useState<Tab>('table');
  if (!game) return <Redirect href="/" />;
  const world = game.world;
  const league = world.leagues.find((l) => l.id === leagueId) ?? world.leagues[0];
  const table = leagueTable(league, world);
  // Zones follow the real links between leagues.
  const up = league.parentId ? league.swap ?? 0 : 0;
  const down = world.leagues.find((l) => l.parentId === league.id)?.swap ?? 0;
  const lastWeek = Math.max(0, ...league.fixtures.filter((f) => f.played).map((f) => f.week));

  return (
    <Screen title={league.name} nav={game.mode === 'manager' ? 'manager' : undefined}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {world.leagues.map((l) => (
          <Pressable key={l.id} onPress={() => setLeagueId(l.id)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: l.id === league.id ? colors.accent : colors.card, borderWidth: 1, borderColor: l.id === league.id ? colors.accent : colors.border }}>
            <T bold style={{ fontSize: 12.5, color: l.id === league.id ? colors.ink : colors.muted }}>{l.name}</T>
          </Pressable>
        ))}
      </View>
      <Tabs<Tab>
        tabs={[
          { key: 'table', label: 'Table' },
          { key: 'results', label: 'Results' },
          { key: 'scorers', label: 'Scorers' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'table' && (
        <Card style={{ paddingHorizontal: 10 }}>
          <Row style={{ paddingVertical: 4 }}>
            <T muted style={{ width: 24, fontSize: 12 }}>#</T>
            <T muted style={{ flex: 1, fontSize: 12 }}>Club</T>
            {['P', 'W', 'D', 'L', 'GD', 'Pts'].map((h) => (
              <T key={h} muted style={{ width: h === 'Pts' ? 34 : 28, fontSize: 12, textAlign: 'right' }}>
                {h}
              </T>
            ))}
          </Row>
          {table.map((r, i) => {
            const c = world.clubs[r.clubId];
            const mine = r.clubId === myClub;
            const zone = i === 0 ? colors.gold : i >= table.length - down ? colors.red : i < up ? colors.accent : undefined;
            return (
              <Row key={r.clubId} style={{ paddingVertical: 5, backgroundColor: mine ? '#123322' : undefined, borderRadius: 6 }}>
                <T style={{ width: 24, fontSize: 13, color: zone ?? colors.text }}>{i + 1}</T>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.text, fontFamily: mine ? fonts.bold : fonts.body }}>{c.name}</Text>
                {[r.played, r.won, r.drawn, r.lost, r.gd].map((v, j) => (
                  <T key={j} style={{ width: 28, fontSize: 13, textAlign: 'right' }}>
                    {v}
                  </T>
                ))}
                <T bold style={{ width: 34, fontSize: 13, textAlign: 'right' }}>
                  {r.points}
                </T>
              </Row>
            );
          })}
          <T muted style={{ fontSize: 11, marginTop: 6 }}>
            {[up ? `Top ${up} promoted.` : '', down ? `Bottom ${down} relegated.` : ''].filter(Boolean).join(' ') || 'No promotion or relegation.'}
          </T>
        </Card>
      )}
      {tab === 'results' && (
        <Card>
          {lastWeek === 0 && <T muted>No games played yet.</T>}
          {Array.from({ length: Math.min(lastWeek, 5) }, (_, i) => lastWeek - i).map((w) => (
            <View key={w} style={{ marginBottom: 8 }}>
              <T muted bold style={{ fontSize: 12 }}>
                Week {w}
              </T>
              {league.fixtures
                .filter((f) => f.week === w)
                .map((f) => (
                  <Row key={f.id} style={{ paddingVertical: 2 }}>
                    <T style={{ flex: 1, fontSize: 13, textAlign: 'right' }} bold={f.homeId === myClub}>
                      {world.clubs[f.homeId].name}
                    </T>
                    <T bold style={{ width: 48, textAlign: 'center', fontSize: 13 }}>
                      {f.homeGoals}-{f.awayGoals}
                    </T>
                    <T style={{ flex: 1, fontSize: 13 }} bold={f.awayId === myClub}>
                      {world.clubs[f.awayId].name}
                    </T>
                  </Row>
                ))}
            </View>
          ))}
        </Card>
      )}
      {tab === 'scorers' && (
        <Card>
          {league.clubIds
            .flatMap((id) => squad(world, world.clubs[id]))
            .filter((p) => p.stats.goals > 0)
            .sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists)
            .slice(0, 15)
            .map((p, i) => (
              <Row key={p.id} style={{ paddingVertical: 3 }}>
                <T style={{ width: 24, fontSize: 13 }}>{i + 1}</T>
                <T style={{ flex: 1, fontSize: 13 }} bold={p.id === game.career?.playerId}>
                  {shortName(p)}
                </T>
                <T muted style={{ flex: 1, fontSize: 12 }}>
                  {world.clubs[p.clubId!].name}
                </T>
                <T bold style={{ width: 30, fontSize: 13, textAlign: 'right' }}>
                  {p.stats.goals}
                </T>
              </Row>
            ))}
        </Card>
      )}
    </Screen>
  );
}
