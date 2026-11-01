import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore, useGame } from '../state/store';
import { Badge, Button, Card, Choice, H2, Icon, IconName, Pill, Row, Screen, T, Tabs, haptic } from '../ui/kit';
import { alpha, colors, fonts, matchRatingColor, POSITION_COLORS, teamColor } from '../ui/theme';
import { KeyMoment, MatchEvent, MatchState, SideKey, makeSub, possessionPct, resolveMoment, resumeFromHalf, simToEnd, stepMinute } from '../engine/match';
import { finishUserMatch } from '../engine/game';
import { teamById } from '../engine/lineup';
import { skillLevel } from '../engine/skills';
import { useResultFeedback } from '../ui/shared';
import { fullName, shortName } from '../engine/player';
import { Club, Game, Style } from '../engine/types';
import { ShotGame } from '../ui/moments/ShotGame';
import { PassGame } from '../ui/moments/PassGame';
import { DribbleGame } from '../ui/moments/DribbleGame';
import { LivePitch } from '../ui/livePitch';
import { LineupsCard } from '../ui/lineups';
import { SaveGame } from '../ui/moments/SaveGame';

const NATIVE = Platform.OS !== 'web';
// 1x is slow enough to follow the ball on the live pitch.
const SPEEDS = [
  { key: '1', label: '1x', ms: 900 },
  { key: '2', label: '2x', ms: 380 },
  { key: '4', label: '4x', ms: 120 },
] as const;
type SpeedKey = (typeof SPEEDS)[number]['key'];

export default function MatchScreen() {
  const game = useGame();
  const router = useRouter();
  useStore((s) => s.liveRev);
  const live = useStore((s) => s.live);
  const mutateLive = useStore((s) => s.mutateLive);
  const mutate = useStore((s) => s.mutate);
  const setLive = useStore((s) => s.setLive);
  const celebrate = useStore((s) => s.celebrate);
  const feedback = useResultFeedback();
  const [speed, setSpeed] = useState<SpeedKey>('1');
  const [paused, setPaused] = useState(false);
  const [autoMoments, setAutoMoments] = useState(false);
  const [tab, setTab] = useState<'feed' | 'lineups' | 'stats'>('feed');
  const [showPitch, setShowPitch] = useState(true);
  const { width } = useWindowDimensions();
  const pitchWidth = Math.min(width, 600) - 32;
  // Before kick-off the lineups are shown and the clock waits.
  const [kicked, setKicked] = useState(() => !!useStore.getState().live && useStore.getState().live!.minute > 0);
  const seenGoals = useRef(0);
  const flash = useState(() => new Animated.Value(0))[0];

  const running = kicked && !!live && !live.finished && !live.pending && !live.pausedAtHalf && !paused;
  useEffect(() => {
    if (!running) return;
    const ms = SPEEDS.find((s) => s.key === speed)!.ms;
    const id = setInterval(() => mutateLive((m, g) => stepMinute(g.world, m)), ms);
    return () => clearInterval(id);
  }, [running, speed, mutateLive]);

  // With auto moments on, the sim resolves moments by itself.
  useEffect(() => {
    if (live?.pending && autoMoments) mutateLive((m, g) => resolveMoment(g.world, m, null));
  }, [live?.pending, autoMoments, mutateLive]);

  // Goals flash the scoreboard; the user's team's goals get confetti.
  const goalCount = live ? live.home.goals + live.away.goals : 0;
  useEffect(() => {
    if (!live || !game) return;
    if (goalCount > seenGoals.current) {
      const last = [...live.events].reverse().find((e) => e.type === 'goal');
      const focus = live.focus.playerId;
      // In career mode only your own goals and assists earn confetti.
      const involved = !focus || (last && (last.playerId === focus || last.text.includes(game.world.players[focus].lastName)));
      const mine = last?.side === userSide(game, live) && involved;
      flash.setValue(1);
      Animated.timing(flash, { toValue: 0, duration: 900, useNativeDriver: NATIVE }).start();
      if (mine && !live.finished && last) {
        haptic('success');
        celebrate({ title: 'GOAL!', sub: last.text, icon: 'football', duration: 1700 });
      }
    }
    seenGoals.current = goalCount;
    // Only goal count changes matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalCount]);

  if (!game) return <Redirect href="/" />;
  if (!live) return <Redirect href={game.mode === 'career' ? '/career' : '/manager'} />;

  const world = game.world;
  const home = teamById(world, live.home.clubId);
  const away = teamById(world, live.away.clubId);
  const mySide: SideKey = userSide(game, live);

  const finish = () => {
    const r = mutate((g) => finishUserMatch(g, live));
    setLive(null);
    feedback(r);
    router.back();
  };

  const myGoals = live[mySide].goals;
  const theirGoals = live[mySide === 'home' ? 'away' : 'home'].goals;
  const verdict = myGoals > theirGoals || live.penaltyWinner === live[mySide].clubId ? 'WIN' : myGoals < theirGoals || live.penaltyWinner ? 'LOSS' : 'DRAW';

  return (
    <Screen title="Match day" back={false} scroll>
      <Scoreboard game={game} live={live} home={home} away={away} flash={flash} />

      {!kicked && (
        <>
          <LineupsCard game={game} live={live} focusId={game.career?.playerId} />
          <Button label="Kick off" icon="football" onPress={() => setKicked(true)} />
        </>
      )}

      {kicked && showPitch && !live.pending && <LivePitch world={world} live={live} focusId={game.career?.playerId} tickMs={SPEEDS.find((x) => x.key === speed)!.ms} width={pitchWidth} />}

      {live.pending && !autoMoments && <MomentPanel key={momentKey(live)} game={game} moment={live.pending} />}

      {live.pausedAtHalf && <HalfTimePanel game={game} live={live} side={mySide} />}

      {kicked && !live.finished && !live.pending && !live.pausedAtHalf && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={6} style={styles.segment}>
              {SPEEDS.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => {
                    haptic();
                    setSpeed(s.key);
                  }}
                  style={[styles.segBtn, speed === s.key && { backgroundColor: colors.accent }]}
                >
                  <Text style={[styles.segText, speed === s.key && { color: colors.ink }]}>{s.label}</Text>
                </Pressable>
              ))}
            </Row>
            <Button label={paused ? 'Resume' : 'Pause'} icon={paused ? 'play' : 'pause'} small variant="secondary" onPress={() => setPaused(!paused)} />
          </Row>
          <Choice active={showPitch} label="Show live pitch" sub="Watch the ball move between the two teams." onPress={() => setShowPitch(!showPitch)} />
          <Choice active={autoMoments} label="Auto-play key moments" sub="Let the sim handle the big chances for the rest of this match." onPress={() => setAutoMoments(!autoMoments)} />
          <Button label="Skip to full time" icon="play-skip-forward" variant="secondary" small onPress={() => mutateLive((m, g) => simToEnd(g.world, m))} />
        </Card>
      )}

      {live.finished && (
        <Card glow={verdict === 'WIN' ? colors.accent : verdict === 'LOSS' ? colors.red : colors.gold}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Text style={[styles.verdict, { color: verdict === 'WIN' ? colors.accent : verdict === 'LOSS' ? colors.red : colors.gold }]}>{verdict}</Text>
              <T muted style={{ fontSize: 12.5 }}>
                Full time{live.penaltyWinner ? ', decided on penalties' : ''}
              </T>
            </View>
            <Icon name={verdict === 'WIN' ? 'trophy' : verdict === 'LOSS' ? 'sad-outline' : 'remove-circle-outline'} size={36} color={verdict === 'WIN' ? colors.gold : colors.muted} />
          </Row>
          <Button label="Continue" icon="arrow-forward" onPress={finish} />
        </Card>
      )}

      <Tabs
        tabs={[
          { key: 'feed', label: 'Commentary' },
          { key: 'lineups', label: 'Lineups' },
          { key: 'stats', label: 'Stats' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'feed' && <Feed game={game} live={live} />}
      {tab === 'lineups' && <LineupsCard game={game} live={live} focusId={game.career?.playerId} />}
      {tab === 'stats' && <Stats game={game} live={live} side={mySide} />}
    </Screen>
  );
}

function Scoreboard({ game, live, home, away, flash }: { game: Game; live: MatchState; home: Club; away: Club; flash: Animated.Value }) {
  const pulse = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: NATIVE }), Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: NATIVE })]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const [hp] = possessionPct(live);
  const clock = live.finished ? 'FULL TIME' : live.pausedAtHalf ? 'HALF TIME' : `${Math.min(live.minute, 90)}'${live.minute > 90 ? `+${live.minute - 90}` : ''}`;
  const scorers = (side: SideKey) =>
    live.scorers
      .filter((s) => s.clubId === live[side].clubId)
      .map((s) => `${game.world.players[s.playerId].lastName} ${s.minute}'`)
      .join(', ');
  return (
    <View style={styles.board}>
      <LinearGradient colors={[alpha(teamColor(home.colors), 0.42), colors.card, colors.card, alpha(teamColor(away.colors), 0.42)]} locations={[0, 0.4, 0.6, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: 3, backgroundColor: teamColor(home.colors) }} />
      <View style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: 3, backgroundColor: teamColor(away.colors) }} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent, opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }) }]} />
      <View style={{ padding: 16, gap: 12 }}>
        <Row style={{ justifyContent: 'center' }} gap={8}>
          {!live.finished && !live.pausedAtHalf && <Animated.View style={[styles.liveDot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]} />}
          <Text style={styles.clock}>{clock}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={styles.team}>
            <Badge club={home} size={56} />
            <Text style={styles.teamName} numberOfLines={2}>
              {home.name}
            </Text>
            <Text style={styles.scorers}>{scorers('home')}</Text>
          </View>
          <Text style={styles.score} numberOfLines={1}>
            {live.home.goals}
            <Text style={{ color: colors.faint }}> : </Text>
            {live.away.goals}
          </Text>
          <View style={styles.team}>
            <Badge club={away} size={56} />
            <Text style={styles.teamName} numberOfLines={2}>
              {away.name}
            </Text>
            <Text style={styles.scorers}>{scorers('away')}</Text>
          </View>
        </Row>
        <View>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.possLabel}>{hp}%</Text>
            <Text style={[styles.possLabel, { color: colors.muted }]}>POSSESSION</Text>
            <Text style={styles.possLabel}>{100 - hp}%</Text>
          </Row>
          <View style={styles.possTrack}>
            <View style={{ flex: hp, backgroundColor: teamColor(home.colors) }} />
            <View style={{ flex: 100 - hp, backgroundColor: teamColor(away.colors) }} />
          </View>
        </View>
      </View>
    </View>
  );
}

function momentKey(s: MatchState) {
  const m = s.pending!;
  return `${s.minute}-${m.kind}-${m.actorId}-${s.events.length}`;
}

function userSide(game: Game, s: MatchState): SideKey {
  if (s.focus.clubId) return s.home.clubId === s.focus.clubId ? 'home' : 'away';
  const id = s.focus.playerId ?? game.career?.playerId;
  if (id && [...s.away.onPitch, ...s.away.bench, ...s.away.usedIds].includes(id)) return 'away';
  return 'home';
}

const MOMENT_TITLES: Record<KeyMoment['kind'], { title: string; icon: IconName }> = {
  shot: { title: 'Chance to shoot!', icon: 'football' },
  dribble: { title: 'One on one', icon: 'flash' },
  pass: { title: 'Pick the pass', icon: 'git-branch' },
  penalty: { title: 'Penalty!', icon: 'locate' },
  freekick: { title: 'Free kick', icon: 'navigate' },
  save: { title: 'Shot incoming!', icon: 'hand-left' },
  tackle: { title: 'Stop him!', icon: 'shield' },
};

function MomentPanel({ game, moment }: { game: Game; moment: KeyMoment }) {
  const mutateLive = useStore((s) => s.mutateLive);
  const actor = game.world.players[moment.actorId];
  const resolve = (q: number | null, chosen?: string) => mutateLive((m, g) => resolveMoment(g.world, m, q, chosen));
  const names: Record<string, string> = {};
  for (const o of moment.options ?? []) names[o.playerId] = game.world.players[o.playerId].lastName;
  const head = MOMENT_TITLES[moment.kind];
  useEffect(() => haptic('medium'), []);

  return (
    <Card glow={colors.gold}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={8}>
          <View style={styles.momentIcon}>
            <Icon name={head.icon} size={18} color="#1a1200" />
          </View>
          <Text style={styles.momentTitle}>{head.title}</Text>
        </Row>
        <Pill label={`${moment.minute}'`} icon="time" color={colors.gold} />
      </Row>
      <T muted>
        {moment.attackerId
          ? `${fullName(game.world.players[moment.attackerId])} is through on ${moment.kind === 'save' ? 'goal' : 'you'}.`
          : `${fullName(actor)} has the ball${moment.bonus > 0 ? ' and a clear sight of goal' : ''}.`}
      </T>
      {moment.weakFoot && <Pill label="On your weaker foot" icon="footsteps" color={colors.orange} />}
      {(moment.kind === 'shot' || moment.kind === 'penalty' || moment.kind === 'freekick') && (
        <ShotGame kind={moment.kind} composure={actor.attrs.composure} finesse={skillLevel(actor, 'finesse')} onDone={(q) => resolve(q)} />
      )}
      {moment.kind === 'pass' && <PassGame options={moment.options ?? []} names={names} playmaker={skillLevel(actor, 'playmaker')} onDone={(q, _t, id) => resolve(q, id)} />}
      {moment.kind === 'dribble' && <DribbleGame speed={skillLevel(actor, 'speedster')} onDone={(q) => resolve(q)} />}
      {moment.kind === 'tackle' && <DribbleGame mode="tackle" speed={skillLevel(actor, 'wall')} onDone={(q) => resolve(q)} />}
      {moment.kind === 'save' && <SaveGame reflex={skillLevel(actor, 'shotstopper')} onDone={(q) => resolve(q)} />}
      <Button label="Skip: let the sim decide" icon="play-skip-forward-outline" small variant="ghost" onPress={() => resolve(null)} />
    </Card>
  );
}

const STYLES: { key: Style; label: string; hint: string }[] = [
  { key: 'balanced', label: 'Balanced', hint: 'No big risks either way.' },
  { key: 'possession', label: 'Possession', hint: 'Keep the ball, concede fewer chances.' },
  { key: 'counter', label: 'Counter', hint: 'Give up the ball, finish better on the break.' },
  { key: 'press', label: 'High press', hint: 'More chances both ways. Tiring.' },
];

function HalfTimePanel({ game, live, side }: { game: Game; live: MatchState; side: SideKey }) {
  const mutateLive = useStore((s) => s.mutateLive);
  const [outId, setOutId] = useState<string | null>(null);
  const [inId, setInId] = useState<string | null>(null);
  const me = live[side];
  const P = game.world.players;
  const row = (id: string, active: boolean, color: string, onPress: () => void, extra?: string) => (
    <Pressable key={id} onPress={onPress} style={[styles.subRow, active && { borderColor: color, backgroundColor: alpha(color, 0.12) }]}>
      <Text style={[styles.pos, { color: POSITION_COLORS[P[id].position] }]}>{P[id].position}</Text>
      <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 13 }} numberOfLines={1}>
        {shortName(P[id])}
      </Text>
      {extra && <Text style={{ color: matchRatingColor(Number(extra)), fontFamily: fonts.semibold, fontSize: 12 }}>{extra}</Text>}
    </Pressable>
  );

  return (
    <Card glow={colors.blue}>
      <Row gap={8}>
        <Icon name="chatbubbles" size={20} color={colors.blue} />
        <H2>Half time team talk</H2>
      </Row>
      <T muted>Change your approach or make substitutions ({5 - me.subsUsed} left).</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {STYLES.map((s) => (
          <Choice key={s.key} half active={me.style === s.key} label={s.label} sub={s.hint} onPress={() => mutateLive((m) => (m[side].style = s.key))} />
        ))}
      </View>
      <Row style={{ alignItems: 'flex-start', marginTop: 8 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.colHead}>TAKE OFF</Text>
          {me.onPitch.map((id) => row(id, outId === id, colors.red, () => setOutId(id), (live.ratings[id] ?? 6).toFixed(1)))}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.colHead}>BRING ON</Text>
          {me.bench.map((id) => row(id, inId === id, colors.accent, () => setInId(id)))}
        </View>
      </Row>
      <Button
        label="Make substitution"
        icon="swap-vertical"
        small
        variant="secondary"
        disabled={!outId || !inId || me.subsUsed >= 5}
        onPress={() => {
          mutateLive((m, g) => makeSub(g.world, m, side, outId!, inId!));
          setOutId(null);
          setInId(null);
        }}
      />
      <Button label="Start second half" icon="play" onPress={() => mutateLive((m) => resumeFromHalf(m))} />
    </Card>
  );
}

function eventIcon(e: MatchEvent): { icon: IconName; color: string } {
  switch (e.type) {
    case 'goal':
      return { icon: 'football', color: colors.accent };
    case 'save':
      return { icon: 'hand-left', color: colors.blue };
    case 'miss':
      return { icon: 'close-circle-outline', color: colors.muted };
    case 'card':
      return { icon: 'square', color: colors.gold };
    case 'red':
      return { icon: 'square', color: colors.red };
    case 'injury':
      return { icon: 'medkit', color: colors.red };
    case 'sub':
      return { icon: 'swap-vertical', color: colors.teal };
    case 'half':
    case 'full':
    case 'kickoff':
      return { icon: 'time', color: colors.gold };
    default:
      return { icon: 'chatbubble-ellipses-outline', color: colors.faint };
  }
}

function Feed({ game, live }: { game: Game; live: MatchState }) {
  const events = [...live.events].reverse();
  return (
    <Card>
      {events.map((e, i) => {
        const big = e.type === 'goal';
        const { icon, color } = eventIcon(e);
        const team = e.side ? teamById(game.world, live[e.side].clubId) : null;
        return (
          <Row key={i} style={[styles.event, big && { backgroundColor: alpha(colors.accent, 0.1), borderColor: alpha(colors.accent, 0.35) }]} gap={10}>
            <Text style={styles.minute}>{`${e.minute}'`}</Text>
            <View style={[styles.evIcon, { backgroundColor: alpha(color, 0.16) }]}>
              <Icon name={icon} size={13} color={color} />
            </View>
            <Text style={[styles.evText, big && { fontFamily: fonts.bold, color: colors.text }, e.played && !big && { color: colors.blue }]}>
              {team ? <Text style={{ color: colors.muted, fontFamily: fonts.semibold }}>{team.short}  </Text> : null}
              {e.text}
            </Text>
          </Row>
        );
      })}
    </Card>
  );
}

function StatLine({ label, h, a, hv, av }: { label: string; h: string; a: string; hv: number; av: number }) {
  const total = hv + av || 1;
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={styles.statNum}>{h}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statNum, { textAlign: 'right' }]}>{a}</Text>
      </Row>
      <Row gap={4}>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <View style={{ width: `${(hv / total) * 100}%`, height: 5, borderRadius: 3, backgroundColor: hv >= av ? colors.accent : colors.borderStrong }} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ width: `${(av / total) * 100}%`, height: 5, borderRadius: 3, backgroundColor: av >= hv ? colors.accent : colors.borderStrong }} />
        </View>
      </Row>
    </View>
  );
}

function Stats({ game, live, side }: { game: Game; live: MatchState; side: SideKey }) {
  const [hp, ap] = possessionPct(live);
  const me = live[side];
  const P = game.world.players;
  const focusId = game.career?.playerId;
  return (
    <>
      <Card>
        <StatLine label="Possession" h={`${hp}%`} a={`${ap}%`} hv={hp} av={ap} />
        <StatLine label="Shots" h={String(live.home.shots)} a={String(live.away.shots)} hv={live.home.shots} av={live.away.shots} />
        <StatLine label="On target" h={String(live.home.onTarget)} a={String(live.away.onTarget)} hv={live.home.onTarget} av={live.away.onTarget} />
      </Card>
      <Card>
        <H2>Your team ratings</H2>
        {me.usedIds.map((id) => {
          const r = live.ratings[id] ?? 6;
          const you = id === focusId;
          return (
            <Row key={id} style={[styles.ratingRow, you && { backgroundColor: alpha(colors.purple, 0.12), borderColor: alpha(colors.purple, 0.4) }]}>
              <Text style={[styles.pos, { color: POSITION_COLORS[P[id].position] }]}>{P[id].position}</Text>
              <Text style={{ flex: 1, color: colors.text, fontFamily: you ? fonts.bold : fonts.medium, fontSize: 14 }} numberOfLines={1}>
                {shortName(P[id])}
                {you ? '  (you)' : ''}
              </Text>
              {live.goals[id] ? <Pill label={`${live.goals[id]}`} icon="football" color={colors.accent} /> : null}
              {live.assists[id] ? <Pill label={`${live.assists[id]}`} icon="git-branch" color={colors.teal} /> : null}
              <View style={[styles.ratingChip, { backgroundColor: alpha(matchRatingColor(r), 0.18) }]}>
                <Text style={{ color: matchRatingColor(r), fontFamily: fonts.bold, fontSize: 13 }}>{r.toFixed(1)}</Text>
              </View>
            </Row>
          );
        })}
        {focusId && !me.usedIds.includes(focusId) && <T muted>You did not get on the pitch.</T>}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  board: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  clock: { fontFamily: fonts.display, fontSize: 18, color: '#ffffff', letterSpacing: 1.5 },
  team: { alignItems: 'center', flex: 1, gap: 6 },
  teamName: { fontFamily: fonts.display, fontSize: 17, color: '#ffffff', textAlign: 'center', letterSpacing: 0.4, textTransform: 'uppercase' },
  scorers: { fontFamily: fonts.body, fontSize: 10.5, color: colors.muted, textAlign: 'center' },
  score: { fontFamily: fonts.display, fontSize: 60, color: '#ffffff', lineHeight: 64, letterSpacing: 1, marginTop: 4, minWidth: 110, textAlign: 'center' },
  possLabel: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.text, letterSpacing: 1 },
  possTrack: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4, gap: 2 },
  segment: { backgroundColor: colors.bgElev, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.border },
  segBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  segText: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  verdict: { fontFamily: fonts.display, fontSize: 40, letterSpacing: 2 },
  momentIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  momentTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.accent, letterSpacing: 0.6, textTransform: 'uppercase' },
  colHead: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.muted, letterSpacing: 1.2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  pos: { fontFamily: fonts.bold, fontSize: 11, width: 30 },
  event: { alignItems: 'flex-start', paddingVertical: 6, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  minute: { width: 30, fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 3 },
  evIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  evText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.text, lineHeight: 19 },
  statNum: { fontFamily: fonts.display, fontSize: 20, color: colors.text, width: 60 },
  statLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, letterSpacing: 0.5 },
  ratingRow: { gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  ratingChip: { minWidth: 42, paddingVertical: 3, borderRadius: 8, alignItems: 'center' },
});
