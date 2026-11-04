import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useGame } from '../state/store';
import { Card, H2, IconButton, Row, Screen, T } from '../ui/kit';
import { colors, fonts } from '../ui/theme';
import { resultFor } from '../engine/matchLog';
import { teamById } from '../engine/lineup';
import { Game, MatchRecord } from '../engine/types';

const RESULT_COLOR = { W: colors.green, D: colors.muted, L: colors.red };

function Line({ game, r }: { game: Game; r: MatchRecord }) {
  const home = r.homeId === r.teamId;
  const rival = teamById(game.world, home ? r.awayId : r.homeId);
  const result = resultFor(r);
  const score = `${home ? r.homeGoals : r.awayGoals}-${home ? r.awayGoals : r.homeGoals}`;
  const pens = r.pens ? ` (${home ? r.pens[0] : r.pens[1]}-${home ? r.pens[1] : r.pens[0]} pens)` : r.extraTime ? ' (aet)' : '';
  const mine = r.rating ? `Rated ${r.rating.toFixed(1)}${r.goals ? `, ${r.goals} goal${r.goals > 1 ? 's' : ''}` : ''}${r.assists ? `, ${r.assists} assist${r.assists > 1 ? 's' : ''}` : ''}` : '';
  return (
    <Row gap={10} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.bgElev }}>
      <Text style={{ width: 22, textAlign: 'center', fontFamily: fonts.display, fontSize: 20, color: RESULT_COLOR[result] }}>{result}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14 }} numberOfLines={1}>
          {score}{pens} {home ? 'v' : 'at'} {rival.name}
        </Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 12 }} numberOfLines={1}>
          {r.comp}{mine ? `. ${mine}` : ''}
        </Text>
      </View>
    </Row>
  );
}

// Every match the user's team has played, a season at a time.
export default function Matches() {
  const game = useGame();
  const log = useMemo(() => game?.matchLog ?? [], [game]);
  const seasons = useMemo(() => [...new Set(log.map((r) => r.season))].sort((a, b) => b - a), [log]);
  const [at, setAt] = useState(0);
  if (!game) return <Redirect href="/" />;
  const season = seasons[at];
  const rows = log.filter((r) => r.season === season).reverse();
  const count = (x: 'W' | 'D' | 'L') => rows.filter((r) => resultFor(r) === x).length;
  return (
    <Screen title="Match history" back>
      {!seasons.length ? (
        <Card>
          <T muted>No matches yet. They appear here once you have played one.</T>
        </Card>
      ) : (
        <Card style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <IconButton icon="chevron-back" label="Later season" color={at === 0 ? colors.bgElev : colors.text} onPress={() => setAt(Math.max(0, at - 1))} />
            <View style={{ alignItems: 'center' }}>
              <H2>{season}</H2>
              <T muted style={{ fontSize: 12 }}>
                Won {count('W')}, drawn {count('D')}, lost {count('L')}
              </T>
            </View>
            <IconButton icon="chevron-forward" label="Earlier season" color={at >= seasons.length - 1 ? colors.bgElev : colors.text} onPress={() => setAt(Math.min(seasons.length - 1, at + 1))} />
          </Row>
          {rows.map((r, i) => (
            <Line key={`${r.week}-${i}`} game={game} r={r} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
