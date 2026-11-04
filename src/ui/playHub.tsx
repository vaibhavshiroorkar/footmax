import React, { useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Game } from '../engine/types';
import { formatMoney, fullName, overall } from '../engine/player';
import { xpForLevel } from '../engine/skills';
import { userFixture } from '../engine/game';
import { leagueOf, tablePosition } from '../engine/league';
import { ordinal } from '../engine/manager';
import { teamById } from '../engine/lineup';
import { Avatar } from './avatar';
import { Badge, Button, Card, Icon, IconName, PLAYER_RING, RatingRing, Row, haptic } from './kit';
import { Claimable, claimReward, claimables } from '../engine/progress';
import { useStore } from '../state/store';
import { playSound } from './sound';
import { MatchdayButton } from './shared';
import { alpha, colors, fonts, teamColor } from './theme';

// The club's run of league wins, newest first: 0 when the last game was not a win.
export function winStreak(game: Game): number {
  const p = game.world.players[game.career?.playerId ?? ''];
  const clubId = p?.clubId;
  if (!clubId) return 0;
  const league = game.world.leagues.find((l) => l.id === game.world.clubs[clubId]?.leagueId);
  if (!league) return 0;
  const played = league.fixtures.filter((f) => f.played && (f.homeId === clubId || f.awayId === clubId)).sort((a, b) => b.week - a.week);
  let n = 0;
  for (const f of played) {
    const mine = f.homeId === clubId ? f.homeGoals : f.awayGoals;
    const theirs = f.homeId === clubId ? f.awayGoals : f.homeGoals;
    if (mine > theirs) n++;
    else break;
  }
  return n;
}

// Who you are: face, name, club and rating, then money and fame, then level
// and streak. One card, nothing else.
export function PlayerStrip({ game }: { game: Game }) {
  const router = useRouter();
  const c = game.career!;
  const p = game.world.players[c.playerId];
  const club = p.clubId ? game.world.clubs[p.clubId] : null;
  const streak = winStreak(game);
  const need = xpForLevel(c.level);
  return (
    <Card style={{ borderLeftWidth: 4, borderLeftColor: club ? teamColor(club.colors) : colors.border }}>
      <View style={{ gap: 16, paddingVertical: 4 }}>
      <Pressable onPress={() => router.navigate('/career/profile')} accessibilityRole="button" accessibilityLabel={`${fullName(p)}, rated ${overall(p)}. Open your profile.`}>
        <Row gap={12}>
          {c.look && <Avatar look={c.look} number={c.number} kit={club?.colors ?? ['#2f7bff', '#ffffff']} size={54} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text, letterSpacing: 0.3 }} numberOfLines={1}>
              {fullName(p)}
            </Text>
            <Row gap={6}>
              {club && <Badge club={club} size={16} />}
              <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, flexShrink: 1 }} numberOfLines={1}>
                {p.role ?? p.position}  |  {club ? club.name : 'Free agent'}
              </Text>
            </Row>
          </View>
          <RatingRing value={overall(p)} size={PLAYER_RING} />
        </Row>
      </Pressable>
      <Row gap={10}>
        <Chip icon="wallet" color={colors.gold} value={formatMoney(c.money)} label="Money" />
        <Chip icon="flame" color={colors.orange} value={String(Math.floor(c.fame))} label="Fame" />
      </Row>
      <Row gap={10}>
        <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.gold }}>LV {c.level}</Text>
        <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.bgElev, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, (100 * c.xp) / need)}%`, height: 8, backgroundColor: colors.gold }} />
        </View>
        {streak >= 2 && (
          <Row gap={3} accessibilityLabel={`${streak} wins in a row`}>
            <Icon name="flame" size={16} color={colors.orange} />
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.orange }}>{streak}W</Text>
          </Row>
        )}
      </Row>
      </View>
    </Card>
  );
}

// A value in the player card, for reading only.
function Chip({ icon, color, value, label }: { icon: IconName; color: string; value: string; label: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.bgElev }}>
      <Icon name={icon} size={16} color={color} />
      <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 20, color: colors.text }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.muted }}>{label.toUpperCase()}</Text>
    </View>
  );
}

// Everything around the career that is not this week's match: four square
// tiles, always the same, so the screen never changes shape.
export function Shortcuts() {
  const router = useRouter();
  const items: { label: string; icon: IconName; color: string; href: string }[] = [
    { label: 'Club', icon: 'shield', color: colors.teal, href: '/career/clubs' },
    { label: 'Tournaments', icon: 'earth', color: colors.orange, href: '/tournaments' },
    { label: 'Awards', icon: 'medal', color: colors.gold, href: '/awards' },
    { label: 'Leaderboard', icon: 'stats-chart', color: colors.blue, href: '/leaderboards' },
  ];
  return (
    <Row gap={8}>
      {items.map((it) => (
        <Pressable
          key={it.href}
          onPress={() => {
            haptic();
            router.navigate(it.href as never);
          }}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          style={({ pressed }) => ({ flex: 1, minWidth: 0, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.cardAlt : colors.card, transform: [{ scale: pressed ? 0.97 : 1 }] })}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(it.color, 0.15) }}>
            <Icon name={it.icon} size={19} color={it.color} />
          </View>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.text }} numberOfLines={1} adjustsFontSizeToFit>
            {it.label}
          </Text>
        </Pressable>
      ))}
    </Row>
  );
}

// How happy the squad is: their average morale, 0 to 100. Wins lift it,
// defeats sink it.
export function dressingRoom(game: Game): number {
  const p = game.world.players[game.career?.playerId ?? ''];
  const club = p?.clubId ? game.world.clubs[p.clubId] : null;
  if (!club) return 0;
  const mates = club.playerIds.filter((id) => id !== p.id).map((id) => game.world.players[id]).filter(Boolean);
  return mates.length ? Math.round(mates.reduce((s, m) => s + m.morale, 0) / mates.length) : 50;
}

// This week's match: the two crests and the button to play it.
export function NextMatchCard({ game }: { game: Game }) {
  const world = game.world;
  const p = world.players[game.career?.playerId ?? ''];
  const clubId = p?.clubId ?? null;
  const f = userFixture(game);
  const summer = world.phase === 'tournament';
  const league = clubId ? leagueOf(world, clubId) : undefined;
  const home = f ? teamById(world, f.homeId) : null;
  const away = f ? teamById(world, f.awayId) : null;
  const where = summer ? `Summer ${world.season + 1}${f?.stage ? `  |  ${f.stage}` : ''}` : `Week ${world.week}${league ? `  |  ${league.name}` : ''}${league && world.week > 1 && clubId ? `  |  ${ordinal(tablePosition(world, clubId))}` : ''}`;
  return (
    <Card glow={f ? colors.accent : undefined}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, textAlign: 'center' }} numberOfLines={1}>
        {where}
      </Text>
      {f && home && away ? (
        <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
          <Side club={home} />
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.faint }}>VS</Text>
          <Side club={away} />
        </Row>
      ) : (
        <Row gap={8} style={{ justifyContent: 'center', paddingVertical: 10 }}>
          <Icon name="cafe-outline" size={18} color={colors.muted} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.muted }}>No match this week</Text>
        </Row>
      )}
      <MatchdayButton game={game} />
    </Card>
  );
}

function Side({ club }: { club: Parameters<typeof Badge>[0]['club'] }) {
  return (
    <View style={{ alignItems: 'center', width: 120, gap: 6 }}>
      <Badge club={club} size={54} />
      <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.text, textAlign: 'center' }} numberOfLines={2}>
        {club.name}
      </Text>
    </View>
  );
}

// Rewards waiting to be collected. A tap pops the reward with a chime, then
// banks it; a level-up gets the full celebration.
export function ClaimCard({ game }: { game: Game }) {
  const list = claimables(game);
  if (!list.length) return null;
  return (
    <Card glow={colors.gold}>
      <Row gap={8}>
        <Icon name="gift" size={20} color={colors.gold} />
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.text, flex: 1 }}>Rewards</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.gold }}>{list.length}</Text>
      </Row>
      {list.slice(0, 4).map((r) => (
        <ClaimRow key={`${r.kind}-${r.id}`} r={r} />
      ))}
    </Card>
  );
}

function ClaimRow({ r }: { r: Claimable }) {
  const mutate = useStore((s) => s.mutate);
  const celebrate = useStore((s) => s.celebrate);
  const [popped, setPopped] = useState(false);
  const pop = useState(() => new Animated.Value(0))[0];
  const claim = () => {
    if (popped) return;
    setPopped(true);
    haptic('success');
    playSound('reward', 0.8);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: Platform.OS !== 'web' }).start();
    setTimeout(() => {
      const res = mutate((g) => claimReward(g, r.kind, r.id));
      const lv = useStore.getState().game?.career?.level;
      if (res.levels > 0) celebrate({ title: 'Level up!', sub: `Level ${lv}. +${res.levels} skill point${res.levels > 1 ? 's' : ''} to spend.`, icon: 'star', action: { label: 'Spend it', href: '/career/tree' } });
    }, 650);
  };
  const reward = [r.xp ? `+${r.xp} XP` : '', r.money ? `+${formatMoney(r.money)}` : '', r.fame ? `+${r.fame} fame` : ''].filter(Boolean).join('  ');
  return (
    <Row gap={10} style={{ paddingVertical: 4 }}>
      <View style={{ width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.gold, 0.14) }}>
        <Icon name={r.icon as IconName} size={17} color={colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.text }} numberOfLines={1}>
          {r.label}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.gold }}>{reward}</Text>
      </View>
      {popped ? (
        <Animated.Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.gold, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] }) }] }}>{r.xp ? `+${r.xp} XP` : 'Got it!'}</Animated.Text>
      ) : (
        <Button label="Claim" small variant="gold" onPress={claim} />
      )}
    </Row>
  );
}
