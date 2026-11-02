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
import { actionMessages, upgradeCount } from '../engine/alerts';
import { drillsFor } from '../engine/career';
import { coachTrust } from '../engine/relations';
import { Avatar } from './avatar';
import { Badge, Button, Card, Icon, IconName, RatingRing, Row, haptic } from './kit';
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

// Who you are, in one line: face, name, club, rating, level and streak.
export function PlayerStrip({ game }: { game: Game }) {
  const router = useRouter();
  const c = game.career!;
  const p = game.world.players[c.playerId];
  const club = p.clubId ? game.world.clubs[p.clubId] : null;
  const streak = winStreak(game);
  const need = xpForLevel(c.level);
  return (
    <Pressable onPress={() => router.navigate('/career/profile')} accessibilityRole="button" accessibilityLabel={`${fullName(p)}, rated ${overall(p)}. Open your profile.`}>
      <Card style={{ borderLeftWidth: 4, borderLeftColor: club ? teamColor(club.colors) : colors.border }}>
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
          <RatingRing value={overall(p)} size={54} />
        </Row>
        {club && (
          <Row gap={12}>
            <Mood label="Coach" value={coachTrust(game)} icon="person" />
            <Mood label="Dressing room" value={dressingRoom(game)} icon="people" />
          </Row>
        )}
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
      </Card>
    </Pressable>
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

// A small happiness bar with a face that changes with the mood.
function Mood({ label, value, icon }: { label: string; value: number; icon: IconName }) {
  const color = value >= 66 ? colors.green : value >= 40 ? colors.gold : colors.red;
  const face: IconName = value >= 66 ? 'happy' : value >= 40 ? 'remove-circle' : 'sad';
  return (
    <View style={{ flex: 1, gap: 3 }} accessibilityLabel={`${label} ${value} out of 100`}>
      <Row gap={5}>
        <Icon name={icon} size={12} color={colors.muted} />
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted }} numberOfLines={1}>
          {label}
        </Text>
        <Icon name={face} size={14} color={color} />
      </Row>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.bgElev, overflow: 'hidden' }}>
        <View style={{ width: `${value}%`, height: 6, backgroundColor: color }} />
      </View>
    </View>
  );
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

// The week's to-dos as tappable chips; only the ones that apply show.
export function WeekChips({ game }: { game: Game }) {
  const router = useRouter();
  const c = game.career!;
  const p = game.world.players[c.playerId];
  const drill = drillsFor(p)[0]?.energy ?? 40;
  const sessions = Math.floor(c.energy / drill);
  const todo = actionMessages(game).length;
  const upgrades = upgradeCount(game);
  const chips: { icon: IconName; value: string; label: string; color: string; href: string }[] = [];
  if (sessions > 0 && p.injuryWeeks === 0) chips.push({ icon: 'barbell', value: String(sessions), label: sessions === 1 ? 'session left' : 'sessions left', color: colors.blue, href: '/career/train' });
  if (upgrades > 0) chips.push({ icon: 'sparkles', value: String(upgrades), label: upgrades === 1 ? 'upgrade' : 'upgrades', color: colors.gold, href: '/career/train?tab=abilities' });
  if (todo > 0) chips.push({ icon: 'mail', value: String(todo), label: 'to answer', color: colors.accent, href: '/inbox' });
  if (p.injuryWeeks > 0) chips.push({ icon: 'medkit', value: `${p.injuryWeeks}w`, label: 'injured', color: colors.red, href: '/career/life' });
  else if (p.fitness < 60) chips.push({ icon: 'pulse', value: `${Math.round(p.fitness)}`, label: 'fitness', color: colors.red, href: '/career/life' });
  if (!chips.length) return null;
  return (
    <Row gap={8}>
      {chips.slice(0, 3).map((ch) => (
        <Pressable
          key={ch.label}
          onPress={() => {
            haptic();
            router.navigate(ch.href as never);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${ch.value} ${ch.label}`}
          style={({ pressed }) => ({ flex: 1, padding: 10, gap: 2, borderRadius: 12, borderWidth: 1.5, borderColor: alpha(ch.color, 0.45), backgroundColor: pressed ? alpha(ch.color, 0.16) : alpha(ch.color, 0.08) })}
        >
          <Row gap={6}>
            <Icon name={ch.icon} size={16} color={ch.color} />
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.text }}>{ch.value}</Text>
          </Row>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted }} numberOfLines={1}>
            {ch.label}
          </Text>
        </Pressable>
      ))}
    </Row>
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
      if (res.levels > 0) celebrate({ title: 'Level up!', sub: `Level ${lv}. +${res.levels} skill point${res.levels > 1 ? 's' : ''} to spend.`, icon: 'star', action: { label: 'Spend it', href: '/career/train?tab=abilities' } });
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
