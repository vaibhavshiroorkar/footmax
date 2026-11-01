import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Game, Nation, World } from '../engine/types';
import { FinishResult, userFixture, startUserMatch, skipSummer, skipWeek } from '../engine/game';
import { leagueOf, tablePosition } from '../engine/league';
import { ordinal } from '../engine/manager';
import { inTransferWindow } from '../engine/transfers';
import { actionMessages } from '../engine/alerts';
import { teamById } from '../engine/lineup';
import { INTERNATIONAL_BREAKS } from '../engine/international';
import { useStore } from '../state/store';
import { Badge, Button, Card, Icon, IconName, Pill, Row, T, haptic, inputStyle } from './kit';
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
      <Text style={{ fontFamily: fonts.semibold, fontSize: 9, color: colors.muted, letterSpacing: 1.2 }}>{tag}</Text>
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
  const summer = game.world.phase === 'tournament';
  const next = () => feedback(mutate((g) => skipWeek(g)));

  if (!f) {
    return (
      <Row>
        <Button label={summer ? 'Next matchday' : 'Next week'} icon="play-forward" onPress={next} style={{ flex: 2 }} />
        {summer && <Button label="Skip summer" icon="play-skip-forward" variant="secondary" style={{ flex: 1 }} onPress={() => feedback(mutate((g) => skipSummer(g)))} />}
      </Row>
    );
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

const CONFS = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'] as const;
type ConfKey = (typeof CONFS)[number] | 'Other';
const CONF_NAMES: Record<ConfKey, string> = {
  UEFA: 'Europe',
  CONMEBOL: 'South America',
  CONCACAF: 'North & Central America',
  CAF: 'Africa',
  AFC: 'Asia',
  OFC: 'Oceania',
  Other: 'Other nations',
};

// Two steps: pick a confederation, then a nation. Search is a shortcut.
// With allowAny, an "Any nation" option clears the choice (onChange('')).
export function NationPicker({ world, value, onChange, includeMinor = false, allowAny = false }: { world: World; value: string | null; onChange: (id: string) => void; includeMinor?: boolean; allowAny?: boolean }) {
  const current = value ? world.nations.find((n) => n.id === value) : undefined;
  const [conf, setConf] = useState<ConfKey>(current ? (current.minor ? 'Other' : (current.conf as ConfKey)) : 'UEFA');
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const confs: ConfKey[] = includeMinor ? [...CONFS, 'Other'] : [...CONFS];
  const inConf = (n: Nation) => (conf === 'Other' ? !!n.minor : !n.minor && n.conf === conf);
  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (searching && text) return world.nations.filter((n) => (includeMinor || !n.minor) && n.name.toLowerCase().includes(text));
    return world.nations.filter(inConf).sort((a, b) => a.name.localeCompare(b.name));
    // inConf only depends on conf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, conf, q, searching, includeMinor]);

  const pick = (id: string) => {
    haptic();
    onChange(id);
  };
  return (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 10.5, fontFamily: fonts.bold, color: colors.muted, letterSpacing: 1.2 }}>{searching ? 'SEARCH' : '1. CONFEDERATION'}</Text>
        <Pressable onPress={() => setSearching(!searching)} hitSlop={8}>
          <Row gap={4}>
            <Icon name={searching ? 'grid' : 'search'} size={14} color={colors.accent} />
            <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: 12 }}>{searching ? 'Browse' : 'Search'}</Text>
          </Row>
        </Pressable>
      </Row>
      {searching ? (
        <TextInput autoFocus style={inputStyle} placeholder="Type a nation" placeholderTextColor={colors.faint} value={q} onChangeText={setQ} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {confs.map((c) => {
            const active = conf === c;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  haptic();
                  setConf(c);
                }}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? alpha(colors.accent, 0.14) : colors.bgElev }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.accent : colors.text }}>{c}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 10, color: colors.muted }}>{CONF_NAMES[c]}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {!searching && <Text style={{ fontSize: 10.5, fontFamily: fonts.bold, color: colors.muted, letterSpacing: 1.2 }}>2. NATION</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {allowAny && (
          <Pressable onPress={() => pick('')} style={[nationTile, !value && nationTileActive]}>
            <Icon name="globe-outline" size={14} color={!value ? colors.accent : colors.muted} />
            <Text style={{ fontSize: 13, color: !value ? colors.accent : colors.text, fontFamily: fonts.medium }}>Any nation</Text>
          </Pressable>
        )}
        {list.map((n) => {
          const active = value === n.id;
          return (
            <Pressable key={n.id} onPress={() => pick(n.id)} style={[nationTile, active && nationTileActive]}>
              <View style={{ width: 14, height: 10, borderRadius: 2, backgroundColor: n.colors[0], borderWidth: 1, borderColor: n.colors[1] }} />
              <Text style={{ fontSize: 13, color: active ? colors.accent : colors.text, fontFamily: fonts.medium }} numberOfLines={1}>
                {n.name}
              </Text>
              {active && <Icon name="checkmark" size={14} color={colors.accent} />}
            </Pressable>
          );
        })}
        {list.length === 0 && <T muted>No nations match.</T>}
      </View>
    </View>
  );
}

const nationTile = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElev, minWidth: '47%' as const, flexGrow: 1 };
const nationTileActive = { borderColor: colors.accent, backgroundColor: alpha(colors.accent, 0.12) };
