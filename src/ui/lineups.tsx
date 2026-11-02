import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Game } from '../engine/types';
import { MatchState, SideKey } from '../engine/match';
import { formAverage, teamById } from '../engine/lineup';
import { assignSlots } from '../engine/play';
import { overall, shortName } from '../engine/player';
import { Badge, Card, Icon, Pill, Row, T } from './kit';
import { alpha, colors, fonts, matchRatingColor, POSITION_COLORS, ratingColor } from './theme';

// One team's XI, bench and substitutions at a time; tap a crest to switch.
// Every row shows the player's OVR, and once the match is on, his live
// match rating next to it.
export function LineupsCard({ game, live, focusId }: { game: Game; live: MatchState; focusId?: string }) {
  const started = live.minute > 0;
  const P = game.world.players;
  const subs = live.events.filter((e) => e.type === 'sub');
  const mine: SideKey | null = focusId ? (live.home.onPitch.includes(focusId) || live.home.bench.includes(focusId) || live.home.usedIds.includes(focusId) ? 'home' : live.away.onPitch.includes(focusId) || live.away.bench.includes(focusId) || live.away.usedIds.includes(focusId) ? 'away' : null) : null;
  const [shown, setShown] = useState<SideKey>(mine ?? 'home');

  const teamOvr = (side: SideKey) => {
    const ids = live[side].onPitch;
    return ids.length ? Math.round(ids.reduce((n, id) => n + overall(P[id]), 0) / ids.length) : 0;
  };

  const column = (side: SideKey) => {
    const team = teamById(game.world, live[side].clubId);
    // The XI in formation order: keeper, then each line from the back, left to right.
    const slots = assignSlots(game.world, team, live[side].onPitch);
    const ids = [...live[side].onPitch].sort((a, b) => (slots[a]?.depth ?? 0.5) - (slots[b]?.depth ?? 0.5) || (slots[a]?.lat ?? 0.5) - (slots[b]?.lat ?? 0.5));
    const row = (id: string, bench: boolean) => {
      const p = P[id];
      const me = id === focusId;
      const cameOn = live.cameOn[id] !== undefined;
      const ovr = overall(p);
      const rating = live.ratings[id];
      const rated = started && rating !== undefined && (!bench || cameOn);
      return (
        <Row key={id} gap={8} style={[{ paddingVertical: 5, paddingHorizontal: 6, borderRadius: 8 }, me && { backgroundColor: alpha(colors.gold, 0.14) }]}>
          <Text style={{ width: 22, textAlign: 'right', fontFamily: fonts.display, fontSize: 15, color: me ? colors.gold : colors.muted }}>{live.numbers?.[id] ?? ''}</Text>
          <Text style={{ width: 36, fontFamily: fonts.bold, fontSize: 12, color: POSITION_COLORS[p.position] }}>{(!bench && slots[id]?.role) || p.role || p.position}</Text>
          <Text style={{ flex: 1, fontFamily: me ? fonts.bold : fonts.medium, fontSize: 13.5, color: bench ? colors.muted : colors.text }} numberOfLines={1}>
            {shortName(p)}
          </Text>
          {cameOn && <Icon name="arrow-up" size={12} color={colors.accent} />}
          {live.goals[id] ? <Count icon="football" n={live.goals[id]} color={colors.accent} /> : null}
          {live.assists[id] ? <Count icon="git-branch" n={live.assists[id]} color={colors.teal} /> : null}
          <Text style={{ width: 28, textAlign: 'right', fontFamily: fonts.display, fontSize: 16, color: ratingColor(ovr) }}>{ovr}</Text>
          <Text style={{ width: 32, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 12.5, color: rated ? matchRatingColor(rating) : colors.faint }}>{rated ? rating.toFixed(1) : '-'}</Text>
        </Row>
      );
    };
    return (
      <View style={{ gap: 2 }}>
        <Row gap={8} style={{ paddingHorizontal: 6, marginBottom: 2 }}>
          <Text style={[headStyle, { flex: 1 }]}>
            {team.formation}  |  {live[side].style.toUpperCase()}
          </Text>
          <Text style={[headStyle, { width: 28, textAlign: 'right' }]}>OVR</Text>
          <Text style={[headStyle, { width: 32, textAlign: 'right' }]}>RAT</Text>
        </Row>
        {ids.map((id) => row(id, false))}
        <Text style={[headStyle, { marginTop: 8, paddingHorizontal: 6 }]}>BENCH</Text>
        {live[side].bench.map((id) => row(id, true))}
      </View>
    );
  };

  const pick = (side: SideKey) => {
    const team = teamById(game.world, live[side].clubId);
    const on = shown === side;
    return (
      <Pressable
        key={side}
        onPress={() => setShown(side)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? alpha(colors.accent, 0.1) : colors.bgElev }}
      >
        <Badge club={team} size={26} />
        <Text style={{ flex: 1, fontFamily: fonts.displayBold, fontSize: 15, color: on ? colors.text : colors.muted }} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 17, color: ratingColor(teamOvr(side)) }}>{teamOvr(side)}</Text>
      </Pressable>
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
      <Row gap={8}>
        {pick('home')}
        {pick('away')}
      </Row>
      {column(shown)}
      {subs.some((e) => e.side === shown) && (
        <View style={{ gap: 4, marginTop: 4 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.muted, letterSpacing: 1.1 }}>SUBSTITUTIONS</Text>
          {subs.filter((e) => e.side === shown).map((e, i) => (
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

const headStyle = { fontFamily: fonts.bold, fontSize: 10.5, color: colors.faint, letterSpacing: 1 } as const;

// A goal or assist icon with how many.
function Count({ icon, n, color }: { icon: 'football' | 'git-branch'; n: number; color: string }) {
  return (
    <Row gap={2}>
      <Icon name={icon} size={12} color={color} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color }}>{n}</Text>
    </Row>
  );
}
