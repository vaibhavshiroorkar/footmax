import React, { useMemo, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Game, Nation, World } from '../engine/types';
import { FinishResult, interruptedMatch, userFixture, startUserMatch, skipSummer, skipWeek } from '../engine/game';
import { leagueOf, tablePosition } from '../engine/league';
import { ordinal } from '../engine/manager';
import { inTransferWindow } from '../engine/transfers';
import { actionMessages } from '../engine/alerts';
import { teamById } from '../engine/lineup';
import { INTERNATIONAL_BREAKS } from '../engine/international';
import { useStore } from '../state/store';
import { Badge, Button, Card, ConfirmButton, Icon, IconName, Pill, Row, T, haptic, inputStyle } from './kit';
import { alpha, colors, fonts } from './theme';

export function FixtureCard({ game, clubId }: { game: Game; clubId: string | null }) {
  const world = game.world;
  const f = userFixture(game);
  const summer = world.phase === 'tournament';
  const live = world.tournaments.filter((t) => !t.done);
  const league = clubId ? leagueOf(world, clubId) : undefined;
  const progress = summer ? 1 : (world.week - 1) / world.seasonWeeks;
  const home = f ? teamById(world, f.homeId) : null;
  const away = f ? teamById(world, f.awayId) : null;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}>
          <Icon name={summer ? 'sunny' : 'calendar'} size={14} color={summer ? colors.gold : colors.muted} />
          <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>
            {summer ? `Summer ${world.season + 1}` : `Season ${world.season}/${String(world.season + 1).slice(2)}  |  Week ${world.week}/${world.seasonWeeks}`}
          </Text>
        </Row>
        <Row gap={4}>
          {!summer && inTransferWindow(world.week) && <Pill label="Window" icon="swap-horizontal" color={colors.gold} />}
          {!summer && INTERNATIONAL_BREAKS.includes(world.week) && <Pill label="Intl break" icon="flag" color={colors.blue} />}
        </Row>
      </Row>
      {!summer && (
        <View style={{ height: 8, backgroundColor: colors.bgElev, borderRadius: 4 }}>
          <View style={{ width: `${progress * 100}%`, height: 8, backgroundColor: colors.blue, borderRadius: 4 }} />
        </View>
      )}
      {summer ? (
        <T muted style={{ fontSize: 13 }}>
          {live.length ? live.map((t) => t.name).join('  |  ') : 'All tournaments finished.'}
        </T>
      ) : league ? (
        <Row gap={6}>
          <Icon name="trophy-outline" size={13} color={colors.muted} />
          <T muted style={{ fontSize: 13 }}>
            {league.name}
            {world.week > 1 && clubId ? `  |  ${ordinal(tablePosition(world, clubId))} place` : ''}
          </T>
        </Row>
      ) : null}
      {f && home && away ? (
        <View style={{ gap: 6, marginTop: 4 }}>
          {f.stage && (
            <View style={{ alignSelf: 'center' }}>
              <Pill label={f.stage} color={colors.gold} icon="trophy" />
            </View>
          )}
          <Row style={{ justifyContent: 'space-between' }}>
            <TeamLabel name={home.name} club={home} tag="HOME" />
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.bgElev, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.muted, letterSpacing: 1 }}>VS</Text></View>
            <TeamLabel name={away.name} club={away} tag="AWAY" />
          </Row>
        </View>
      ) : (
        <Row gap={8} style={{ justifyContent: 'center', paddingVertical: 8 }}>
          <Icon name="cafe-outline" size={16} color={colors.muted} />
          <T muted>{summer ? 'Your team has no game today.' : 'No match for you this week.'}</T>
        </Row>
      )}
    </Card>
  );
}

function TeamLabel({ name, club, tag }: { name: string; club: Parameters<typeof Badge>[0]['club']; tag: string }) {
  return (
    <View style={{ alignItems: 'center', width: 130, gap: 6 }}>
      <Badge club={club} size={58} />
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text, textAlign: 'center' }} numberOfLines={2}>
        {name}
      </Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.muted, letterSpacing: 1.2 }}>{tag}</Text>
    </View>
  );
}

// Season changes, level-ups and news no longer pop up: the hub shows them
// and the store raises a notice only when there is something to act on.
// Winning the Ballon d'Or is the one exception.
export function useResultFeedback() {
  const celebrate = useStore((s) => s.celebrate);
  return (r: FinishResult) => {
    const game = useStore.getState().game;
    const id = game?.career?.playerId;
    const won = r.summerStarted && id ? game!.world.awards?.[0] : undefined;
    if (won && won.ballonDor[0]?.playerId === id) celebrate({ title: "Ballon d'Or!", sub: 'You are the best player in the world this season.', icon: 'trophy', duration: 4000 });
  };
}

// Primary hub button: play this week's match, or move on.
export function MatchdayButton({ game }: { game: Game }) {
  const router = useRouter();
  const mutate = useStore((s) => s.mutate);
  const setLive = useStore((s) => s.setLive);
  const feedback = useResultFeedback();
  const f = userFixture(game);
  const live = useStore((s) => s.live);
  const summer = game.world.phase === 'tournament';
  const next = () => feedback(mutate((g) => skipWeek(g)));
  const resumable = !!live && !!f && live.fixtureId === f.id;

  if (!f) {
    return (
      <Row>
        <Button label={summer ? 'Next matchday' : 'Next week'} icon="play-forward" onPress={next} style={{ flex: 2 }} />
        {summer && <ConfirmButton label="Skip summer" confirmLabel="Sim all of it?" icon="play-skip-forward" variant="secondary" style={{ flex: 1 }} onPress={() => feedback(mutate((g) => skipSummer(g)))} />}
      </Row>
    );
  }
  if (resumable) {
    return <Button label="Resume match" icon="play" sub="Your match is still on" onPress={() => router.push('/match')} />;
  }
  if (interruptedMatch(game)) {
    return <Button label="Finish match" icon="play-forward" sub="It was interrupted, so the rest is simmed" onPress={next} />;
  }
  return (
    <Row>
      <Button
        label="Play match"
        icon="football"
        sub="Live, with key moments"
        style={{ flex: 2 }}
        onPress={() => {
          const s = mutate((g) => startUserMatch(g));
          if (!s) return;
          setLive(s);
          router.push('/match');
        }}
      />
      <Button label="Sim" icon="flash" sub="Instant result" variant="secondary" style={{ flex: 1 }} onPress={next} />
    </Row>
  );
}

export interface NavItem {
  label: string;
  sub?: string;
  href: string;
  badge?: number;
  icon?: IconName;
  color?: string;
}

export function NavGrid({ items }: { items: NavItem[] }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((it) => {
        const color = it.color ?? colors.accent;
        return (
          <Pressable
            key={it.href}
            onPress={() => {
              haptic();
              router.push(it.href as never);
            }}
            style={({ pressed }) => ({
              width: '48.3%',
              backgroundColor: pressed ? colors.cardAlt : colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 18,
              padding: 14,
              gap: 10,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: alpha(color, 0.15), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={it.icon ?? 'apps'} size={19} color={color} />
              </View>
              {it.badge ? (
                <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                  <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 11 }}>{it.badge > 99 ? '99+' : it.badge}</Text>
                </View>
              ) : null}
            </Row>
            <View>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.text, letterSpacing: 0.3 }}>{it.label}</Text>
              {it.sub ? (
                <T muted style={{ fontSize: 11.5, lineHeight: 15 }}>
                  {it.sub}
                </T>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// Messages waiting for an answer. Plain news does not count.
export function inboxBadge(game: Game): number {
  return actionMessages(game).length;
}

// A search field. The chosen nation sits on one row; typing lists the five
// best matches below it, and an empty field suggests the strongest nations.
// With allowAny, the clear button picks "Any nation" (onChange('')).
export function NationPicker({ world, value, onChange, includeMinor = false, allowAny = false }: { world: World; value: string | null; onChange: (id: string) => void; includeMinor?: boolean; allowAny?: boolean }) {
  const current = value ? world.nations.find((n) => n.id === value) : undefined;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const text = q.trim().toLowerCase();
    const pool = world.nations.filter((n) => (includeMinor || !n.minor) && n.id !== value);
    if (!text) return [...pool].sort((a, b) => b.strength - a.strength).slice(0, 5);
    const starts = (n: Nation) => (n.name.toLowerCase().startsWith(text) ? 0 : 1);
    return pool
      .filter((n) => n.name.toLowerCase().includes(text) || n.id.toLowerCase() === text)
      .sort((a, b) => starts(a) - starts(b) || b.strength - a.strength)
      .slice(0, 5);
  }, [world, q, value, includeMinor]);

  const pick = (id: string) => {
    haptic();
    onChange(id);
    setQ('');
    setOpen(false);
  };
  const flag = (n: Nation, size = 1) => <View style={{ width: 18 * size, height: 12 * size, borderRadius: 2, backgroundColor: n.colors[0], borderWidth: 1.5, borderColor: n.colors[1] }} />;
  const showList = open || q.trim().length > 0;
  return (
    <View style={{ gap: 8 }}>
      <Row gap={10} style={pickRow}>
        {current ? flag(current, 1.3) : <Icon name="globe-outline" size={20} color={colors.muted} />}
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 22, color: colors.text }} numberOfLines={1}>
          {current?.name ?? (allowAny ? 'Any nation' : 'Pick a nation')}
        </Text>
        {current && <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{current.minor ? 'Other' : current.conf}</Text>}
        {allowAny && current && (
          <Pressable onPress={() => pick('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Any nation">
            <Icon name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </Row>
      <View style={[inputStyle, { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 }]}>
        <Icon name="search" size={16} color={colors.faint} />
        <TextInput
          keyboardAppearance="dark"
          selectionColor={colors.accent}
          style={{ flex: 1, minWidth: 0, paddingVertical: 12, color: colors.text, fontFamily: fonts.medium, fontSize: 15, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : {}) }}
          placeholder={`Search ${world.nations.filter((n) => includeMinor || !n.minor).length} nations`}
          placeholderTextColor={colors.faint}
          value={q}
          onChangeText={setQ}
          onFocus={() => setOpen(true)}
          // A short delay so a tap on a suggestion lands before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
      </View>
      {showList && (
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElev, overflow: 'hidden' }}>
          {matches.map((n, i) => (
            <Pressable key={n.id} onPress={() => pick(n.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderColor: colors.border }, pressed && { backgroundColor: alpha(colors.accent, 0.12) }]}>
              {flag(n)}
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text }} numberOfLines={1}>
                {n.name}
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.faint }}>{n.minor ? 'Other' : n.conf}</Text>
            </Pressable>
          ))}
          {matches.length === 0 && <T muted style={{ padding: 12 }}>No nations match.</T>}
        </View>
      )}
    </View>
  );
}

const pickRow = { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: alpha(colors.accent, 0.5), backgroundColor: alpha(colors.accent, 0.08) };
