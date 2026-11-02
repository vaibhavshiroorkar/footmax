import React from 'react';
import { Text, View } from 'react-native';
import { Game } from '../engine/types';
import { MatchState, SideKey } from '../engine/match';
import { POSITIONS, formAverage, teamById } from '../engine/lineup';
import { overall, shortName } from '../engine/player';
import { Badge, Card, Icon, Pill, Row, T } from './kit';
import { alpha, colors, fonts, matchRatingColor, POSITION_COLORS, ratingColor } from './theme';

// Both teams' starting XIs, benches and substitutions. Before kick-off it
// shows overall ratings; during the match, live match ratings.
export function LineupsCard({ game, live, focusId }: { game: Game; live: MatchState; focusId?: string }) {
  const started = live.minute > 0;
  const P = game.world.players;
  const subs = live.events.filter((e) => e.type === 'sub');

  const column = (side: SideKey) => {
    const team = teamById(game.world, live[side].clubId);
    const ids = [...live[side].onPitch].sort((a, b) => POSITIONS.indexOf(P[a].position) - POSITIONS.indexOf(P[b].position));
    const row = (id: string, bench: boolean) => {
      const p = P[id];
      const me = id === focusId;
      const cameOn = live.cameOn[id] !== undefined;
      const value = started && !bench ? (live.ratings[id] ?? 6).toFixed(1) : String(overall(p));
      const valueColor = started && !bench ? matchRatingColor(live.ratings[id] ?? 6) : ratingColor(overall(p));
      return (
        <Row key={id} gap={6} style={[{ paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8 }, me && { backgroundColor: alpha(colors.gold, 0.14) }]}>
          <Text style={{ width: 22, textAlign: 'right', fontFamily: fonts.display, fontSize: 15, color: me ? colors.gold : colors.muted }}>{live.numbers?.[id] ?? ''}</Text>
          <Text style={{ width: 28, fontFamily: fonts.bold, fontSize: 11.5, color: POSITION_COLORS[p.position] }}>{p.role ?? p.position}</Text>
          <Text style={{ flex: 1, fontFamily: me ? fonts.bold : fonts.medium, fontSize: 12.5, color: bench ? colors.muted : colors.text }} numberOfLines={1}>
            {shortName(p)}
          </Text>
          {cameOn && <Icon name="arrow-up" size={11} color={colors.accent} />}
          {live.goals[id] ? <Icon name="football" size={11} color={colors.accent} /> : null}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: valueColor, minWidth: 26, textAlign: 'right' }}>{value}</Text>
        </Row>
      );
    };
    return (
      <View style={{ flex: 1, gap: 4 }}>
        <Row gap={8}>
          <Badge club={team} size={28} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: colors.text }} numberOfLines={1}>
              {team.name}
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted }}>
              {team.formation}  |  {live[side].style}
            </Text>
          </View>
        </Row>
        {ids.map((id) => row(id, false))}
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.muted, letterSpacing: 1.1, marginTop: 6 }}>BENCH</Text>
        {live[side].bench.map((id) => row(id, true))}
      </View>
    );
  };

  const me = focusId ? P[focusId] : undefined;
  const mySide: SideKey | null = focusId ? (live.home.onPitch.includes(focusId) || live.home.bench.includes(focusId) || live.home.usedIds.includes(focusId) ? 'home' : 'away') : null;
  const starting = mySide && focusId ? live[mySide].onPitch.includes(focusId) || live[mySide].usedIds.includes(focusId) : false;
  const form = me ? formAverage(me) : null;

  return (
    <Card>
      {me && !started && (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Pill label={starting ? 'You start' : live[mySide!].bench.includes(focusId!) ? 'On the bench' : 'Not in the squad'} icon={starting ? 'checkmark-circle' : 'time'} color={starting ? colors.accent : colors.gold} />
          {form !== null && <Pill label={`Form ${form.toFixed(1)}`} icon="pulse" color={form >= 7 ? colors.green : form < 6.2 ? colors.red : colors.gold} />}
        </Row>
      )}
      {me && !started && !starting && form !== null && form < 6.4 && <T muted style={{ fontSize: 12.5 }}>Poor recent form cost you your place. Play well when you come on.</T>}
      <Row style={{ alignItems: 'flex-start' }} gap={12}>
        {column('home')}
        {column('away')}
      </Row>
      {subs.length > 0 && (
        <View style={{ gap: 4, marginTop: 4 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.muted, letterSpacing: 1.1 }}>SUBSTITUTIONS</Text>
          {subs.map((e, i) => (
            <Row key={i} gap={8}>
              <Text style={{ width: 30, fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{`${e.minute}'`}</Text>
              <Icon name="swap-vertical" size={13} color={colors.teal} />
              <T style={{ flex: 1, fontSize: 12.5 }}>{e.text}</T>
            </Row>
          ))}
        </View>
      )}
    </Card>
  );
}
