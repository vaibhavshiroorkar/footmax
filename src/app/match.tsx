import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, usePreventRemove, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore, useGame } from '../state/store';
import { AnimatedNumber, Badge, Button, Card, Choice, ConfirmButton, H2, Icon, IconName, Pill, Row, Screen, StatBar, T, Tabs, haptic } from '../ui/kit';
import { alpha, colors, fonts, matchRatingColor, POSITION_COLORS, teamColor } from '../ui/theme';
import { KeyMoment, MatchEvent, MatchState, SideKey, makeSub, possessionPct, resolveMoment, resumeFromHalf, simToEnd, stepMinute } from '../engine/match';
import { FinishResult, finishUserMatch, markKickOff } from '../engine/game';
import { teamById } from '../engine/lineup';
import { useResultFeedback } from '../ui/shared';
import { formatMoney, fullName, shortName } from '../engine/player';
import { Club, Game, MatchReward, Style } from '../engine/types';
import { skillLevel, xpForLevel } from '../engine/skills';
import { ShotGame } from '../ui/moments/ShotGame';
import { PassGame } from '../ui/moments/PassGame';
import { DribbleGame } from '../ui/moments/DribbleGame';
import { LivePitch, playDuration } from '../ui/livePitch';
import { LineupsCard } from '../ui/lineups';
import { SaveGame } from '../ui/moments/SaveGame';
import { motionReduced, useSettings } from '../state/settings';

const NATIVE = Platform.OS !== 'web';
// ms: a minute without the live pitch. step: one pass or run on the pitch.
// 1x is slow enough to follow every pass.
const SPEEDS = [
  { key: '1', label: '1x', ms: 900, step: 340 },
  { key: '2', label: '2x', ms: 380, step: 170 },
  { key: '4', label: '4x', ms: 120, step: 70 },
] as const;
type SpeedKey = (typeof SPEEDS)[number]['key'];

export default function MatchScreen() {
  const game = useGame();
  const router = useRouter();
  const liveRev = useStore((s) => s.liveRev);
  const live = useStore((s) => s.live);
  const mutateLive = useStore((s) => s.mutateLive);
  const mutate = useStore((s) => s.mutate);
  const setLive = useStore((s) => s.setLive);
  const celebrate = useStore((s) => s.celebrate);
  const feedback = useResultFeedback();
  const [speed, setSpeed] = useState<SpeedKey>(() => useSettings.getState().matchSpeed);
  const [paused, setPaused] = useState(false);
  const [autoMoments, setAutoMoments] = useState(() => useSettings.getState().autoMoments);
  const [tab, setTab] = useState<'feed' | 'lineups' | 'stats'>('feed');
  const [showPitch, setShowPitch] = useState(true);
  const { width } = useWindowDimensions();
  const pitchWidth = Math.min(width, 600) - 32;
  const pace = SPEEDS.find((s) => s.key === speed)!;
  // Before kick-off the lineups are shown and the clock waits.
  const [kicked, setKicked] = useState(() => !!useStore.getState().live && useStore.getState().live!.minute > 0);
  // Set once the result is in the books, so leaving can never replay it.
  const [done, setDone] = useState<FinishResult | null>(null);
  const seenGoals = useRef(useStore.getState().live ? useStore.getState().live!.home.goals + useStore.getState().live!.away.goals : 0);
  // The navigation held back while the user decides whether to leave.
  const [leaving, setLeaving] = useState<{ repeat: () => void } | null>(null);
  // Back gestures and browser back would drop a live match. Ask first; a
  // match that has kicked off is simmed to the end rather than abandoned.
  const guarded = kicked && !!live && !live.finished;
  const allowLeave = usePreventRemove(guarded, ({ repeat }) => setLeaving({ repeat }));
  const flash = useState(() => new Animated.Value(0))[0];
  const flashBad = useState(() => new Animated.Value(0))[0];
  // While a goal move is still playing on the pitch, the scoreboard waits
  // until the pitch reports the ball in the net.
  const [shownGoal, setShownGoal] = useState<string | null>(null);
  // A key moment opens once the move that led to it has played out.
  const [readyMoment, setReadyMoment] = useState<string | null>(null);
  const pendingKey = live?.pending ? momentKey(live) : null;
  const watching = showPitch && kicked;

  // The result counts the moment the whistle goes, before any button.
  const commitIfDone = () => {
    const m = useStore.getState().live;
    if (!m?.finished || done) return;
    const r = mutate((g) => finishUserMatch(g, m));
    setDone(r);
    feedback(r);
    const g = useStore.getState().game;
    const reward = g?.career?.lastMatch;
    const won = reward ? reward.result === 'W' : !!g && verdictOf(g, m) === 'WIN';
    if (won) {
      haptic('success');
      celebrate({ title: 'Victory!', sub: reward?.played ? `Rated ${reward.rating.toFixed(1)}. +${reward.xp} XP${reward.money ? `, +${formatMoney(reward.money)} win bonus` : ''}.` : 'Three points.', icon: 'trophy', duration: 2200 });
    }
  };

  const running = kicked && !!live && !live.finished && !live.pending && !live.pausedAtHalf && !paused;
  useEffect(() => {
    if (!running) return;
    const delay = watching ? playDuration(useStore.getState().live?.play, pace.step) : pace.ms;
    const t = setTimeout(() => {
      mutateLive((m, g) => stepMinute(g.world, m));
      commitIfDone();
    }, delay);
    return () => clearTimeout(t);
    // liveRev: the match changes in place; each change schedules the next minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, liveRev, pace, watching]);

  useEffect(() => {
    if (!pendingKey) return;
    const steps = useStore.getState().live?.play?.length ?? 0;
    const t = setTimeout(() => setReadyMoment(pendingKey), watching ? steps * pace.step : 0);
    return () => clearTimeout(t);
  }, [pendingKey, watching, pace]);
  const momentOpen = !!pendingKey && readyMoment === pendingKey;

  // With auto moments on, the sim resolves moments by itself.
  useEffect(() => {
    if (momentOpen && autoMoments) mutateLive((m, g) => resolveMoment(g.world, m, null));
  }, [momentOpen, autoMoments, mutateLive]);

  // Goals: the pitch plays the move, then the scoreboard ticks over with a
  // flash. Your own goals get the big celebration.
  const announce = (m: MatchState) => {
    if (!game) return;
    const last = [...m.events].reverse().find((e) => e.type === 'goal');
    if (!last?.side) return;
    const ours = last.side === userSide(game, m);
    const focus = m.focus.playerId;
    const pulse = ours ? flash : flashBad;
    pulse.setValue(1);
    Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: NATIVE }).start();
    haptic(ours ? 'heavy' : 'warning');
    if (ours && focus && last.playerId === focus) {
      const season = game.world.players[focus].stats.goals + 1;
      celebrate({ title: 'GOAL!', sub: `${last.text}\n+15 XP  |  Goal ${season} this season`, icon: 'football', duration: 2400 });
    } else if (ours && !focus) celebrate({ title: 'GOAL!', sub: last.text, icon: 'football', duration: 1600 });
  };
  // On the live pitch, the pitch says when the ball hits the net.
  const playKey = live ? `${live.minute}-${live.events.length}` : '';
  const goalMove = live?.play?.[live.play.length - 1]?.act === 'goal' ? live.play[live.play.length - 1] : undefined;
  const held: SideKey | null = watching && goalMove && !live?.finished && shownGoal !== playKey ? goalMove.side : null;
  const onGoalShown = () => {
    if (!live || shownGoal === playKey) return;
    setShownGoal(playKey);
    announce(live);
  };
  // Without the pitch (or skipping to the end) goals land straight away.
  const goalCount = live ? live.home.goals + live.away.goals : 0;
  useEffect(() => {
    const m = useStore.getState().live;
    if (!m || goalCount <= seenGoals.current) {
      seenGoals.current = goalCount;
      return;
    }
    seenGoals.current = goalCount;
    if (!watching || m.finished) announce(m);
    // Only goal count changes matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalCount]);

  if (!game) return <Redirect href="/" />;
  if (!live) return <Redirect href={game.mode === 'career' ? '/career' : '/manager'} />;

  const world = game.world;
  const home = teamById(world, live.home.clubId);
  const away = teamById(world, live.away.clubId);
  const mySide: SideKey = userSide(game, live);

  const leave = () => {
    setLive(null);
    allowLeave();
    router.back();
  };

  const simAndLeave = () => {
    const repeat = leaving?.repeat;
    const r = mutate((g) => finishUserMatch(g, live));
    setLive(null);
    feedback(r);
    setLeaving(null);
    allowLeave();
    if (repeat) repeat();
    else router.back();
  };

  const verdict = verdictOf(game, live);
  const reward = done && game.career?.lastMatch?.fixtureId === live.fixtureId ? game.career.lastMatch : null;

  return (
    <Screen title="Match day" back={false} scroll>
      <Scoreboard game={game} live={live} home={home} away={away} flash={flash} flashBad={flashBad} held={held} />

      {leaving && (
        <Card glow={colors.gold}>
          <H2>Leave the match?</H2>
          <T muted>The rest of the match will be simmed and the result counts.</T>
          <Row>
            <Button label="Stay" variant="secondary" style={{ flex: 1 }} onPress={() => setLeaving(null)} />
            <Button label="Sim and leave" icon="play-forward" style={{ flex: 1 }} onPress={simAndLeave} />
          </Row>
        </Card>
      )}

      {(showPitch || !kicked) && <LivePitch world={world} live={live} focusId={game.career?.playerId} stepMs={pace.step} width={pitchWidth} onGoal={onGoalShown} />}

      {!kicked && (
        <>
          <Button
            label="Kick off"
            icon="football"
            onPress={() => {
              mutate((g) => markKickOff(g));
              setKicked(true);
            }}
          />
          <LineupsCard game={game} live={live} focusId={game.career?.playerId} />
        </>
      )}

      {momentOpen && !autoMoments && <MomentPanel key={pendingKey} game={game} moment={live.pending!} />}

      {live.pausedAtHalf && <HalfTimePanel game={game} live={live} side={mySide} />}

      {kicked && !live.finished && !momentOpen && !live.pausedAtHalf && (
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
                  accessibilityRole="button"
                  accessibilityLabel={`Speed ${s.label}`}
                  accessibilityState={{ selected: speed === s.key }}
                  style={[styles.segBtn, speed === s.key && { backgroundColor: colors.accent }]}
                >
                  <Text style={[styles.segText, speed === s.key && { color: colors.ink }]}>{s.label}</Text>
                </Pressable>
              ))}
            </Row>
            <Button label={paused ? 'Resume' : 'Pause'} icon={paused ? 'play' : 'pause'} small variant="secondary" onPress={() => setPaused(!paused)} />
          </Row>
          <Choice active={showPitch} label="Show live pitch" sub="Watch every pass, shot and goal." onPress={() => setShowPitch(!showPitch)} />
          <Choice active={autoMoments} label="Auto-play key moments" sub="Let the sim handle the big chances for the rest of this match." onPress={() => setAutoMoments(!autoMoments)} />
          <ConfirmButton
            label="Skip to full time"
            confirmLabel="Sim the rest? Tap again"
            icon="play-skip-forward"
            variant="secondary"
            small
            onPress={() => {
              mutateLive((m, g) => simToEnd(g.world, m));
              commitIfDone();
            }}
          />
        </Card>
      )}

      {live.finished && <FullTime game={game} live={live} verdict={verdict} reward={reward} onContinue={leave} />}

      {kicked && (
        <>
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
        </>
      )}
    </Screen>
  );
}

function verdictOf(game: Game, live: MatchState): 'WIN' | 'LOSS' | 'DRAW' {
  const side = userSide(game, live);
  const mine = live[side].goals;
  const theirs = live[side === 'home' ? 'away' : 'home'].goals;
  return mine > theirs || live.penaltyWinner === live[side].clubId ? 'WIN' : mine < theirs || live.penaltyWinner ? 'LOSS' : 'DRAW';
}

// Full time: the result, then what it earned, counted up in place.
function FullTime({ game, live, verdict, reward, onContinue }: { game: Game; live: MatchState; verdict: 'WIN' | 'LOSS' | 'DRAW'; reward: MatchReward | null; onContinue: () => void }) {
  const color = verdict === 'WIN' ? colors.accent : verdict === 'LOSS' ? colors.red : colors.gold;
  const pop = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (motionReduced()) pop.setValue(1);
    else Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: NATIVE }).start();
  }, [pop]);
  const c = game.career;
  const best = Object.entries(live.ratings).sort((a, b) => b[1] - a[1])[0];
  const motm = best ? game.world.players[best[0]] : undefined;
  return (
    <Card glow={color}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: pop }}>
          <Text style={[styles.verdict, { color }]}>{verdict === 'WIN' ? 'VICTORY' : verdict === 'LOSS' ? 'DEFEAT' : 'DRAW'}</Text>
          <T muted style={{ fontSize: 12.5 }}>
            Full time{live.penaltyWinner ? ', decided on penalties' : ''}
          </T>
        </Animated.View>
        <Icon name={verdict === 'WIN' ? 'trophy' : verdict === 'LOSS' ? 'sad-outline' : 'remove-circle-outline'} size={40} color={verdict === 'WIN' ? colors.gold : colors.muted} />
      </Row>
      {reward?.played && (
        <View style={{ gap: 10 }}>
          <Row gap={12}>
            <View style={[styles.rateBox, { borderColor: matchRatingColor(reward.rating) }]}>
              <AnimatedNumber value={reward.rating} format={(n) => n.toFixed(1)} duration={900} style={{ fontFamily: fonts.display, fontSize: 34, color: matchRatingColor(reward.rating) }} />
              <Text style={styles.rateLabel}>RATING</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              {reward.motm && <Pill label="Player of the match" icon="star" color={colors.gold} solid />}
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {reward.goals > 0 && <Pill label={`${reward.goals} goal${reward.goals > 1 ? 's' : ''}`} icon="football" color={colors.accent} />}
                {reward.assists > 0 && <Pill label={`${reward.assists} assist${reward.assists > 1 ? 's' : ''}`} icon="git-branch" color={colors.teal} />}
              </Row>
            </View>
          </Row>
          <Row gap={8}>
            <Gain label="XP" value={reward.xp} color={colors.gold} icon="sparkles" />
            <Gain label="Fame" value={reward.fame} color={colors.pink} icon="flame" decimals={1} />
            <Gain label="Bonus" value={reward.money} color={colors.accent} icon="cash" money />
          </Row>
          {c && <StatBar label={`Level ${c.level}`} icon="star" value={c.xp} max={xpForLevel(c.level)} color={colors.gold} right={`${c.xp}/${xpForLevel(c.level)}`} />}
          {reward.levels > 0 && c && (
            <View style={styles.banner}>
              <Icon name="star" size={20} color={colors.ink} />
              <Text style={styles.bannerText}>LEVEL UP! Level {c.level}</Text>
              <Text style={styles.bannerSub}>+{reward.levels} skill point{reward.levels > 1 ? 's' : ''}</Text>
            </View>
          )}
          {(reward.unlocks ?? []).slice(0, 3).map((u) => (
            <Row key={u} gap={8} style={styles.unlock}>
              <Icon name="ribbon" size={16} color={colors.gold} />
              <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.text }}>{u}</Text>
            </Row>
          ))}
        </View>
      )}
      {reward && !reward.played && <T muted>You did not get on the pitch this time. Train hard and earn your place.</T>}
      {!reward && motm && best && (
        <Row gap={8}>
          <Icon name="star" size={16} color={colors.gold} />
          <T style={{ flex: 1 }}>
            Player of the match: {fullName(motm)} ({best[1].toFixed(1)})
          </T>
        </Row>
      )}
      <Button label="Continue" icon="arrow-forward" onPress={onContinue} />
    </Card>
  );
}

function Gain({ label, value, color, icon, decimals = 0, money }: { label: string; value: number; color: string; icon: IconName; decimals?: number; money?: boolean }) {
  return (
    <View style={[styles.gain, { borderColor: alpha(color, 0.35), backgroundColor: alpha(color, 0.08) }]}>
      <Icon name={icon} size={16} color={color} />
      <AnimatedNumber value={value} duration={1100} format={(n) => (money ? `+${formatMoney(Math.round(n))}` : `+${n.toFixed(decimals)}`)} style={{ fontFamily: fonts.display, fontSize: 20, color }} />
      <Text style={styles.rateLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function Scoreboard({ game, live, home, away, flash, flashBad, held }: { game: Game; live: MatchState; home: Club; away: Club; flash: Animated.Value; flashBad: Animated.Value; held: SideKey | null }) {
  const pulse = useState(() => new Animated.Value(0))[0];
  // The live dot pulses only while the clock runs.
  const ticking = !live.finished && !live.pausedAtHalf;
  useEffect(() => {
    if (!ticking || motionReduced()) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: NATIVE }), Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: NATIVE })]));
    loop.start();
    return () => loop.stop();
  }, [pulse, ticking]);
  const [hp] = possessionPct(live);
  const clock = live.finished ? 'FULL TIME' : live.pausedAtHalf ? 'HALF TIME' : live.minute === 0 ? 'KICK OFF' : `${Math.min(live.minute, 90)}'${live.minute > 90 ? `+${live.minute - 90}` : ''}`;
  // A goal still being played out on the pitch is not on the board yet.
  const hg = live.home.goals - (held === 'home' ? 1 : 0);
  const ag = live.away.goals - (held === 'away' ? 1 : 0);
  const shown = held ? live.scorers.slice(0, -1) : live.scorers;
  const scorers = (side: SideKey) =>
    shown
      .filter((s) => s.clubId === live[side].clubId)
      .map((s) => `${game.world.players[s.playerId].lastName} ${s.minute}'`)
      .join(', ');
  return (
    <View style={styles.board}>
      <LinearGradient colors={[alpha(teamColor(home.colors), 0.42), colors.card, colors.card, alpha(teamColor(away.colors), 0.42)]} locations={[0, 0.4, 0.6, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: 3, backgroundColor: teamColor(home.colors) }} />
      <View style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: 3, backgroundColor: teamColor(away.colors) }} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent, opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.32] }) }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.red, opacity: flashBad.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }) }]} />
      <View style={{ padding: 16, gap: 12 }}>
        <Row style={{ justifyContent: 'center' }} gap={8}>
          {ticking && live.minute > 0 && <Animated.View style={[styles.liveDot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]} />}
          <Text style={styles.clock}>{clock}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={styles.team}>
            <Badge club={home} size={56} />
            <Text style={styles.teamName} numberOfLines={2}>
              {home.name}
            </Text>
            <Text style={styles.scorers} numberOfLines={2}>
              {scorers('home')}
            </Text>
          </View>
          <Row style={{ alignItems: 'center', marginTop: 4 }}>
            <Score value={hg} />
            <Text style={[styles.score, { color: colors.faint, minWidth: 0 }]}>:</Text>
            <Score value={ag} />
          </Row>
          <View style={styles.team}>
            <Badge club={away} size={56} />
            <Text style={styles.teamName} numberOfLines={2}>
              {away.name}
            </Text>
            <Text style={styles.scorers} numberOfLines={2}>
              {scorers('away')}
            </Text>
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

// One side's goals. When the number changes, it pops.
function Score({ value }: { value: number }) {
  const pop = useState(() => new Animated.Value(0))[0];
  const [last, setLast] = useState(value);
  if (last !== value) setLast(value);
  useEffect(() => {
    if (motionReduced()) return;
    pop.setValue(1);
    Animated.spring(pop, { toValue: 0, friction: 3, tension: 80, useNativeDriver: NATIVE }).start();
  }, [last, pop]);
  return <Animated.Text style={[styles.score, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }]}>{value}</Animated.Text>;
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

// The feed shows the newest events first. Keys count from the start of the
// match, so a new event adds one row instead of re-keying all of them, and
// only the latest FEED_ROWS render until the player asks for the rest.
const FEED_ROWS = 30;

const FeedRow = React.memo(function FeedRow({ e, team }: { e: MatchEvent; team: Club | null }) {
  const big = e.type === 'goal';
  const { icon, color } = eventIcon(e);
  return (
    <Row style={[styles.event, big && { backgroundColor: alpha(colors.accent, 0.1), borderColor: alpha(colors.accent, 0.35) }]} gap={10}>
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
});

function Feed({ game, live }: { game: Game; live: MatchState }) {
  const [all, setAll] = useState(false);
  const total = live.events.length;
  const start = all ? 0 : Math.max(0, total - FEED_ROWS);
  const rows: { e: MatchEvent; i: number }[] = [];
  for (let i = total - 1; i >= start; i--) rows.push({ e: live.events[i], i });
  return (
    <Card>
      {rows.map(({ e, i }) => (
        <FeedRow key={i} e={e} team={e.side ? teamById(game.world, live[e.side].clubId) : null} />
      ))}
      {start > 0 && <Button label={`Show ${start} earlier events`} small variant="ghost" onPress={() => setAll(true)} />}
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
  scorers: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, textAlign: 'center' },
  score: { fontFamily: fonts.display, fontSize: 60, color: '#ffffff', lineHeight: 64, letterSpacing: 1, minWidth: 44, textAlign: 'center' },
  possLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.text, letterSpacing: 1 },
  possTrack: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4, gap: 2 },
  segment: { backgroundColor: colors.bgElev, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.border },
  segBtn: { paddingHorizontal: 14, paddingVertical: 7, minHeight: 40, justifyContent: 'center', borderRadius: 10 },
  segText: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  verdict: { fontFamily: fonts.display, fontSize: 44, letterSpacing: 2 },
  rateBox: { width: 92, height: 80, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgElev },
  rateLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted, letterSpacing: 1.2 },
  gain: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.gold, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  bannerText: { flex: 1, fontFamily: fonts.display, fontSize: 20, color: colors.ink, letterSpacing: 0.8 },
  bannerSub: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  unlock: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: alpha(colors.gold, 0.1), borderWidth: 1, borderColor: alpha(colors.gold, 0.3) },
  momentIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  momentTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.accent, letterSpacing: 0.6, textTransform: 'uppercase' },
  colHead: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.muted, letterSpacing: 1.2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, minHeight: 44, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
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
