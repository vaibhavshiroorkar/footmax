import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, usePreventRemove, useRouter } from 'expo-router';
import { useStore, useGame } from '../state/store';
import { AnimatedNumber, Badge, Button, Card, Choice, H2, Icon, IconName, Pill, Row, Screen, T, Tabs, haptic } from '../ui/kit';
import { alpha, colors, fonts, matchRatingColor, POSITION_COLORS, teamColor } from '../ui/theme';
import { KeyMoment, MatchEvent, MatchState, MomentKind, ShoutKind, SideKey, Zone, chooseMoment, setZone, zoneOf, makeSub, shootInstead, takeAction, possessionPct, resolveMoment, resumeFromHalf, shout, simToEnd, simToHalf, stepMinute } from '../engine/match';
import { FinishResult, finishUserMatch, markKickOff } from '../engine/game';
import { teamById } from '../engine/lineup';
import { TableRow, leagueTable, tablePosition } from '../engine/league';
import { groupTable } from '../engine/international';
import { useResultFeedback } from '../ui/shared';
import { formatMoney, fullName, shortName } from '../engine/player';
import { Club, Game, MatchReward, Player, Style } from '../engine/types';
import { SKILL_MOVES, skillLevel, xpForLevel } from '../engine/skills';
import { ShotGame, ShotOutcome } from '../ui/moments/ShotGame';
import { PASS_LABEL, PassPanel } from '../ui/moments/PassGame';
import { DribbleGame } from '../ui/moments/DribbleGame';
import { ComboDribble, GapDribble, RaceDribble } from '../ui/moments/DribbleMore';
import { LivePitch, PitchTarget } from '../ui/livePitch';
import { PL, PW, PitchSim } from '../ui/pitchSim';
import { crowdAmbience, playSound } from '../ui/sound';
import { HeaderGame } from '../ui/moments/HeaderGame';
import { LineupsCard } from '../ui/lineups';
import { SaveGame } from '../ui/moments/SaveGame';
import { BlockGame, ClearGame, InterceptGame } from '../ui/moments/DefendGames';
import { motionReduced, useSettings } from '../state/settings';

const NATIVE = Platform.OS !== 'web';
const NEWLINE = String.fromCharCode(10);
// ms: a minute without the live pitch. mult: how fast the pitch plays.
// At 1x a pass takes about a second, close to real football.
const SPEEDS = [
  { key: '1', label: '1x', ms: 900, mult: 1 },
  { key: '2', label: '2x', ms: 380, mult: 2 },
  { key: '4', label: '4x', ms: 120, mult: 4 },
  { key: '8', label: '8x', ms: 50, mult: 8 },
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
  // Auto-play for moments is a setting now, not a switch on this screen.
  const autoMoments = useSettings((st) => st.autoMoments);
  const [tab, setTab] = useState<'feed' | 'teams'>('feed');
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
  // Goals the pitch has shown going in. The scoreboard counts only these,
  // so it never runs ahead of the ball and never takes a goal back.
  const [shownGoals, setShownGoals] = useState(() => useStore.getState().live?.scorers.length ?? 0);
  // A key moment opens once the move that led to it has played out.
  const [readyMoment, setReadyMoment] = useState<string | null>(null);
  const pendingKey = live?.pending ? momentKey(live) : null;
  const watching = kicked;

  // The result counts the moment the whistle goes, before any button.
  const commitIfDone = () => {
    const m = useStore.getState().live;
    if (!m?.finished || done) return;
    const r = mutate((g) => finishUserMatch(g, m));
    setDone(r);
    feedback(r);
    playSound('whistle-end', 0.9);
    const g = useStore.getState().game;
    const reward = g?.career?.lastMatch;
    const won = reward ? reward.result === 'W' : !!g && verdictOf(g, m) === 'WIN';
    if (won) {
      haptic('success');
      celebrate({ title: 'Victory!', sub: reward?.played ? `Rated ${reward.rating.toFixed(1)}. +${reward.xp} XP${reward.money ? `, +${formatMoney(reward.money)} win bonus` : ''}.` : 'Three points.', icon: 'trophy', duration: 2200 });
    }
  };

  // Manager mode: the touchline panel for changes holds the clock.
  const [changing, setChanging] = useState(false);
  const [skipArmed, setSkipArmed] = useState(false);
  // League place before the match, so full time can show the move.
  const [posBefore] = useState(() => {
    const m = useStore.getState().live;
    const g = useStore.getState().game;
    return m && g ? tablePosition(g.world, m[userSide(g, m)].clubId) : 0;
  });
  // On the ball in open play the buttons become shoot, pass and dribble.
  const [onBall, setOnBall] = useState(false);
  const simRef = useRef<PitchSim | null>(null);
  const act = (kind: 'shot' | 'pass' | 'dribble') => {
    const sim = simRef.current;
    const m = useStore.getState().live;
    const me = game?.career?.playerId;
    if (!sim || !m || !me) return;
    const ball = { x: sim.ball.x / PW, y: sim.ball.y / PL };
    let ok = false;
    mutateLive((mm, g) => {
      ok = takeAction(g.world, mm, kind, ball);
    });
    if (!ok) return;
    haptic('medium');
    sim.takeOver(me);
    setOnBall(false);
    const now = useStore.getState().live;
    if (now?.pending) setReadyMoment(momentKey(now));
  };
  const running = kicked && !!live && !live.finished && !live.pending && !live.pausedAtHalf && !paused && !changing;
  const tick = () => {
    // Anything the pitch did not get to show is on the board before play goes on.
    const total = useStore.getState().live?.scorers.length ?? 0;
    if (shownGoals < total) setShownGoals(total);
    mutateLive((m, g) => stepMinute(g.world, m));
    commitIfDone();
  };
  // With the pitch showing, the pitch asks for each minute once its move
  // has played out. Without it, a plain timer runs the clock.
  useEffect(() => {
    if (!running || watching) return;
    const t = setTimeout(tick, pace.ms);
    return () => clearTimeout(t);
    // liveRev: the match changes in place; each change schedules the next minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, liveRev, pace, watching]);

  // The crowd murmurs while the ball is in play.
  const inPlay = kicked && !!live && !live.finished;
  const soundOn = useSettings((st) => st.sound);
  useEffect(() => {
    crowdAmbience(inPlay && soundOn);
    return () => crowdAmbience(false);
  }, [inPlay, soundOn]);

  // A key moment opens when the move that led to it reaches the player.
  // Nothing opens before kick-off.
  const momentOpen = kicked && !!pendingKey && (!watching || readyMoment === pendingKey);
  const passing = momentOpen && !autoMoments && live?.pending?.kind === 'pass';
  const [passPick, setPassPick] = useState<string | null>(null);
  const onMomentReady = () => {
    const m = useStore.getState().live;
    if (m?.pending) setReadyMoment(momentKey(m));
  };

  // With auto moments on, the sim resolves moments by itself.
  useEffect(() => {
    if (momentOpen && autoMoments) mutateLive((m, g) => resolveMoment(g.world, m, null));
  }, [momentOpen, autoMoments, mutateLive]);

  // Goals: the pitch plays the move, then the scoreboard ticks over with a
  // flash. Your own goals get the big celebration.
  // n: which goal of the match (0 is the first); by default the latest.
  const announce = (m: MatchState, n?: number) => {
    if (!game) return;
    const goals = m.events.filter((e) => e.type === 'goal');
    const last = n === undefined ? goals[goals.length - 1] : goals[n];
    if (!last?.side) return;
    const ours = last.side === userSide(game, m);
    const pulse = ours ? flash : flashBad;
    pulse.setValue(1);
    Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: NATIVE }).start();
    // The pitch already shows GOAL with the crowd; no pop-up on top of it.
    haptic(ours ? 'heavy' : 'warning');
  };
  // On the live pitch, the pitch says when the ball hits the net.
  const totalGoals = live?.scorers.length ?? 0;
  const boardGoals = watching && live && !live.finished ? Math.min(shownGoals, totalGoals) : totalGoals;
  const onGoalShown = () => {
    if (!live || shownGoals >= live.scorers.length) return;
    announce(live, shownGoals);
    setShownGoals(shownGoals + 1);
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
      <Scoreboard
        game={game}
        live={live}
        home={home}
        away={away}
        flash={flash}
        flashBad={flashBad}
        shown={boardGoals}
        controls={
          kicked && !live.finished ? (
            <Row gap={6}>
              <Pressable
                onPress={() => {
                  haptic();
                  const i = SPEEDS.findIndex((x) => x.key === speed);
                  setSpeed(SPEEDS[(i + 1) % SPEEDS.length].key);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Speed ${pace.label}. Tap to change.`}
                style={styles.ctl}
              >
                <Text style={styles.ctlText}>{pace.label}</Text>
              </Pressable>
              <Pressable onPress={() => setPaused(!paused)} accessibilityRole="button" accessibilityLabel={paused ? 'Play' : 'Pause'} style={[styles.ctl, paused && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                <Icon name={paused ? 'play' : 'pause'} size={16} color={paused ? colors.ink : colors.text} />
              </Pressable>
              <Pressable onPress={() => useSettings.getState().set({ sound: !soundOn })} accessibilityRole="button" accessibilityLabel={soundOn ? 'Mute sound' : 'Turn sound on'} style={styles.ctl}>
                <Icon name={soundOn ? 'volume-high' : 'volume-mute'} size={16} color={soundOn ? colors.text : colors.faint} />
              </Pressable>
              <Pressable onPress={() => setSkipArmed(!skipArmed)} accessibilityRole="button" accessibilityLabel="Skip to full time" style={[styles.ctl, skipArmed && { borderColor: colors.gold }]}>
                <Icon name="play-skip-forward" size={16} color={skipArmed ? colors.gold : colors.text} />
              </Pressable>
            </Row>
          ) : null
        }
      />
      {skipArmed && kicked && !live.finished && (
        <Row gap={8}>
          <Button label="Keep watching" small variant="secondary" style={{ flex: 1 }} onPress={() => setSkipArmed(false)} />
          {live.half === 1 && (
            <Button
              label="To half time"
              icon="play-forward"
              small
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                setSkipArmed(false);
                mutateLive((m, g) => simToHalf(g.world, m));
                // The pitch did not show these goals; the board shows them now.
                setShownGoals(useStore.getState().live?.scorers.length ?? 0);
                commitIfDone();
              }}
            />
          )}
          <Button
            label="Sim to full time"
            icon="play-skip-forward"
            small
            variant="gold"
            style={{ flex: 1 }}
            onPress={() => {
              setSkipArmed(false);
              mutateLive((m, g) => simToEnd(g.world, m));
              commitIfDone();
            }}
          />
        </Row>
      )}

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

      {/* At full time the result takes the pitch's place, so it all fits on one screen. */}
      {!live.finished && (
      <LivePitch
        world={world}
        live={live}
        focusId={game.career?.playerId}
        speed={pace.mult}
        width={pitchWidth}
        running={running}
        paused={paused}
        onNeedMinute={tick}
        onGoal={onGoalShown}
        onMomentReady={onMomentReady}
        targets={passing ? passTargets(game, live.pending!) : undefined}
        onTarget={passing ? setPassPick : undefined}
        onBall={setOnBall}
        onSim={(sim) => (simRef.current = sim)}
        zone={game.mode === 'career' ? zoneOf(game.world, live) : undefined}
        shout={live.shout && live.minute <= live.shout.until ? live.shout.kind : null}
      />
      )}
      {/* Passing happens on the pitch: the options light up above, the cards sit here. */}
      {passing && live.pending && (
        <Card glow={colors.gold}>
          <Row gap={8}>
            <View style={styles.momentIcon}>
              <Icon name="git-branch" size={18} color="#1a1200" />
            </View>
            <Text style={styles.momentTitle}>Pick the pass</Text>
          </Row>
          <PassPanel
            key={pendingKey}
            options={live.pending.options ?? []}
            names={Object.fromEntries((live.pending.options ?? []).map((o) => [o.playerId, world.players[o.playerId].lastName]))}
            playmaker={skillLevel(world.players[live.pending.actorId], 'playmaker')}
            picked={passPick}
            onShoot={() => {
              setPassPick(null);
              mutateLive((m) => shootInstead(m));
            }}
            onDone={(q, _t, id) => {
              setPassPick(null);
              mutateLive((m, g) => resolveMoment(g.world, m, q, id));
            }}
          />
        </Card>
      )}

      {kicked && !live.finished && !live.pausedAtHalf && game.mode === 'career' && <ZoneSlider game={game} live={live} />}
      {kicked && !live.finished && !live.pausedAtHalf && game.mode === 'career' && (onBall && !live.pending ? <BallBar onAct={act} /> : <ShoutBar game={game} live={live} />)}
      {kicked && !live.finished && !live.pausedAtHalf && !changing && game.mode === 'manager' && (
        <Touchline live={live} side={mySide} onChanges={() => setChanging(true)} />
      )}

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

      {/* Key moments open over the match, with the pitch in slow motion behind. */}
      <Modal visible={momentOpen && !autoMoments && !passing} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.momentBackdrop}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 14 }}>
            <View style={{ maxWidth: 560, width: '100%', alignSelf: 'center' }}>{momentOpen && live.pending && <MomentPanel key={pendingKey} game={game} moment={live.pending} getSim={() => simRef.current} />}</View>
          </ScrollView>
        </View>
      </Modal>

      {live.pausedAtHalf && <HalfTimePanel game={game} live={live} side={mySide} />}
      {changing && !live.finished && <HalfTimePanel game={game} live={live} side={mySide} title="Touchline changes" doneLabel="Back to the game" onDone={() => setChanging(false)} />}

      {live.finished && <FullTime game={game} live={live} verdict={verdict} reward={reward} onContinue={leave} posBefore={posBefore} />}

      {kicked && (
        <>
          <Tabs
            tabs={[
              { key: 'feed', label: 'Feed' },
              { key: 'teams', label: 'Teams' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'feed' && <Feed game={game} live={live} />}
          {tab === 'teams' && <MatchStats live={live} />}
          {tab === 'teams' && <LineupsCard game={game} live={live} focusId={game.career?.playerId} />}
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
function FullTime({ game, live, verdict, reward, onContinue, posBefore }: { game: Game; live: MatchState; verdict: 'WIN' | 'LOSS' | 'DRAW'; reward: MatchReward | null; onContinue: () => void; posBefore: number }) {
  const color = verdict === 'WIN' ? colors.green : verdict === 'LOSS' ? colors.red : colors.gold;
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
            {reward.money > 0 && <Gain label="Bonus" value={reward.money} color={colors.accent} icon="cash" money />}
          </Row>
          {c && <XpFill from={reward.xpBefore ?? c.xp} fromLevel={reward.levelBefore ?? c.level} to={c.xp} level={c.level} />}
          {reward.levels > 0 && c && (
            <View style={styles.banner}>
              <Icon name="star" size={20} color={colors.ink} />
              <Text style={styles.bannerText}>LEVEL UP! Level {c.level}</Text>
              <Text style={styles.bannerSub}>+{reward.levels} skill point{reward.levels > 1 ? 's' : ''}</Text>
            </View>
          )}
          {(reward.unlocks ?? []).slice(0, 2).map((u) => (
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
      <MiniTable game={game} teamId={live[userSide(game, live)].clubId} before={posBefore} />
      <Button label="Continue" icon="arrow-forward" onPress={onContinue} />
    </Card>
  );
}

// The XP bar fills from where it was before the match. On a level-up it
// fills to the top, chimes, and starts again from zero.
function XpFill({ from, fromLevel, to, level }: { from: number; fromLevel: number; to: number; level: number }) {
  const fill = useState(() => new Animated.Value(from / xpForLevel(fromLevel)))[0];
  const [shownLevel, setShownLevel] = useState(fromLevel);
  useEffect(() => {
    const end = to / xpForLevel(level);
    if (motionReduced()) return fill.setValue(end);
    if (level > fromLevel) {
      Animated.timing(fill, { toValue: 1, duration: 900, delay: 400, useNativeDriver: false }).start(() => {
        playSound('fanfare', 0.7);
        setShownLevel(level);
        fill.setValue(0);
        Animated.timing(fill, { toValue: end, duration: 700, useNativeDriver: false }).start();
      });
    } else Animated.timing(fill, { toValue: end, duration: 1100, delay: 400, useNativeDriver: false }).start();
  }, [fill, to, level, fromLevel]);
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.gold }}>LV {shownLevel}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>
          {to}/{xpForLevel(level)} XP
        </Text>
      </Row>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.bgElev, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <Animated.View style={{ height: '100%', backgroundColor: colors.gold, width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
    </View>
  );
}

// The table after the match: the rows around the user's team in the league,
// or the group in a tournament. Five rows, one line each.
function MiniTable({ game, teamId, before }: { game: Game; teamId: string; before: number }) {
  const world = game.world;
  const club = world.clubs[teamId];
  const league = club?.leagueId ? world.leagues.find((l) => l.id === club.leagueId) : undefined;
  let rows: TableRow[] = [];
  let title = '';
  if (league) {
    rows = leagueTable(league, world);
    title = league.name;
  } else {
    for (const t of world.tournaments) {
      const group = t.groups.find((g) => g.includes(teamId));
      if (group) {
        rows = groupTable(world, t, group);
        title = t.name;
        break;
      }
    }
  }
  const at = rows.findIndex((r) => r.clubId === teamId);
  if (at < 0) return null;
  const start = Math.max(0, Math.min(rows.length - 5, at - 2));
  const shown = rows.slice(start, start + 5);
  const now = at + 1;
  // Everyone starts level, so a move only means something from game two.
  const moved = league && before && rows[at].played > 1 ? before - now : 0;
  return (
    <View style={{ gap: 4 }}>
      <Row gap={8}>
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 18, color: colors.text }} numberOfLines={1}>
          {title}
        </Text>
        {moved !== 0 && (
          <Row gap={2}>
            <Icon name={moved > 0 ? 'arrow-up' : 'arrow-down'} size={14} color={moved > 0 ? colors.green : colors.red} />
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: moved > 0 ? colors.green : colors.red }}>{Math.abs(moved)}</Text>
          </Row>
        )}
      </Row>
      <Row gap={8} style={{ paddingHorizontal: 8 }}>
        <Text style={[styles.tblHead, { width: 22 }]}>#</Text>
        <Text style={[styles.tblHead, { flex: 1 }]}>Team</Text>
        <Text style={[styles.tblHead, styles.tblNum]}>P</Text>
        <Text style={[styles.tblHead, styles.tblNum]}>GD</Text>
        <Text style={[styles.tblHead, styles.tblNum]}>Pts</Text>
      </Row>
      {shown.map((r, i) => {
        const me = r.clubId === teamId;
        const team = teamById(world, r.clubId);
        return (
          <Row key={r.clubId} gap={8} style={[styles.tblRow, me && { backgroundColor: alpha(colors.accent, 0.14), borderColor: alpha(colors.accent, 0.5) }]}>
            <Text style={[styles.tblCell, { width: 22, fontFamily: fonts.display, fontSize: 16 }]}>{start + i + 1}</Text>
            <Row gap={6} style={{ flex: 1 }}>
              <Badge club={team} size={18} />
              <Text style={[styles.tblCell, { flex: 1 }, me && { fontFamily: fonts.bold }]} numberOfLines={1}>
                {team.name}
              </Text>
            </Row>
            <Text style={[styles.tblCell, styles.tblNum]}>{r.played}</Text>
            <Text style={[styles.tblCell, styles.tblNum]}>{r.gd > 0 ? `+${r.gd}` : r.gd}</Text>
            <Text style={[styles.tblCell, styles.tblNum, { fontFamily: fonts.bold }]}>{r.points}</Text>
          </Row>
        );
      })}
    </View>
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

function Scoreboard({ game, live, home, away, flash, flashBad, shown, controls }: { game: Game; live: MatchState; home: Club; away: Club; flash: Animated.Value; flashBad: Animated.Value; shown: number; controls?: React.ReactNode }) {
  const pulse = useState(() => new Animated.Value(0))[0];
  // The live dot pulses only while the clock runs.
  const ticking = !live.finished && !live.pausedAtHalf;
  useEffect(() => {
    if (!ticking || motionReduced()) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: NATIVE }), Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: NATIVE })]));
    loop.start();
    return () => loop.stop();
  }, [pulse, ticking]);
  const clock = live.finished ? 'FT' : live.pausedAtHalf ? 'HT' : live.minute === 0 ? 'KO' : `${Math.min(live.minute, 90)}'${live.minute > 90 ? `+${live.minute - 90}` : ''}`;
  // Goals already seen on the pitch. Shoot-out kicks are not in scorers, so
  // a finished match shows the real totals.
  const seen = live.scorers.slice(0, shown);
  const all = shown >= live.scorers.length;
  const hg = all ? live.home.goals : seen.filter((g) => g.clubId === live.home.clubId).length;
  const ag = all ? live.away.goals : seen.filter((g) => g.clubId === live.away.clubId).length;
  // Scorers as on TV: one line per player with every minute he scored.
  const scorers = (clubId: string) => {
    const byPlayer = new Map<string, number[]>();
    for (const g of seen) if (g.clubId === clubId) byPlayer.set(g.playerId, [...(byPlayer.get(g.playerId) ?? []), g.minute]);
    return [...byPlayer].map(([id, mins]) => `${game.world.players[id]?.lastName ?? ''} ${mins.map((m) => `${m}'`).join(', ')}`).join(NEWLINE);
  };
  const team = (club: Club, right?: boolean) => (
    <Row gap={8} style={{ flex: 1, justifyContent: right ? 'flex-end' : 'flex-start' }}>
      {!right && <Badge club={club} size={34} />}
      <Text style={[styles.teamName, { textAlign: right ? 'right' : 'left' }]} numberOfLines={1}>
        {club.short}
      </Text>
      {right && <Badge club={club} size={34} />}
    </Row>
  );
  return (
    <View style={styles.board}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: 3, backgroundColor: teamColor(home.colors) }} />
      <View style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: 3, backgroundColor: teamColor(away.colors) }} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent, opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }) }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.red, opacity: flashBad.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] }) }]} />
      <View style={{ paddingHorizontal: 12, paddingVertical: 10, gap: 6 }}>
        <Row gap={6}>
          {team(home)}
          <Row style={{ alignItems: 'center' }}>
            <Score value={hg} />
            <Text style={[styles.score, { color: colors.faint, minWidth: 0 }]}>:</Text>
            <Score value={ag} />
          </Row>
          {team(away, true)}
        </Row>
        {seen.length > 0 && (
          <Row style={{ alignItems: 'flex-start' }} gap={12}>
            <Text style={[styles.scorerLine, { textAlign: 'left' }]}>{scorers(live.home.clubId)}</Text>
            <Icon name="football" size={11} color={colors.faint} />
            <Text style={[styles.scorerLine, { textAlign: 'right' }]}>{scorers(live.away.clubId)}</Text>
          </Row>
        )}
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6}>
            {ticking && live.minute > 0 && <Animated.View style={[styles.liveDot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]} />}
            <Text style={styles.clock}>{clock}</Text>
          </Row>
          {controls}
        </Row>
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

// The same moment keeps its key when a choice turns it into a shot or pass.
function momentKey(s: MatchState) {
  const m = s.pending!;
  return `${s.minute}-${m.actorId}-${s.events.length}`;
}

// Which dribble game you get. A picked move decides it: tricks are a combo,
// a nutmeg or ball roll is timing the gap, a drag back reads the defender.
// With no move, it varies from duel to duel.
function DribbleFor({ actor, move, seed, onDone }: { actor: Player; move: string | null; seed: number; onDone: (q: number) => void }) {
  const m = move ? SKILL_MOVES.find((x) => x.id === move) : undefined;
  const speed = skillLevel(actor, 'speedster');
  const control = skillLevel(actor, 'dribbler');
  if (m && ['stepover', 'elastico', 'roulette', 'heelflick', 'rainbow'].includes(m.id)) return <ComboDribble move={m.label} length={Math.min(6, m.stars + 1)} speed={control} onDone={onDone} />;
  if (m && (m.id === 'nutmeg' || m.id === 'ballroll')) return <GapDribble speed={control} onDone={onDone} />;
  if (m) return <DribbleGame speed={speed} onDone={onDone} />;
  const pick = seed % 3;
  if (pick === 1) return <RaceDribble pace={actor.attrs.pace} onDone={onDone} />;
  if (pick === 2) return <GapDribble speed={control} onDone={onDone} />;
  return <DribbleGame speed={speed} onDone={onDone} />;
}

// The skill moves the player has learned, to pick one before taking his man on.
function MovePicker({ actor, value, onChange }: { actor: Player; value: string | null; onChange: (id: string | null) => void }) {
  const moves = SKILL_MOVES.filter((m) => m.kind === 'dribble' && actor.moves?.includes(m.id));
  if (!moves.length) return <T muted style={{ fontSize: 12 }}>Learn skill moves on the Train tab to use them here.</T>;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.colHead}>PICK A MOVE</Text>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {moves.map((m) => {
          const on = value === m.id;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={m.label}
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptic();
                onChange(on ? null : m.id);
              }}
              style={[styles.moveChip, on && { borderColor: colors.accent, backgroundColor: alpha(colors.accent, 0.16) }]}
            >
              <Icon name={m.icon as IconName} size={15} color={on ? colors.accent : colors.text} />
              <Text style={[styles.shoutLabel, { fontSize: 12 }, on && { color: colors.accent }]}>{m.label}</Text>
              <Text style={styles.shoutHint}>{'*'.repeat(m.stars)}</Text>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}

// Pass options as rings on the live pitch, coloured by the kind of ball.
function passTargets(game: Game, m: KeyMoment): Record<string, PitchTarget> {
  const out: Record<string, PitchTarget> = {};
  for (const o of m.options ?? []) {
    const look = PASS_LABEL[o.kind ?? 'square'];
    out[o.playerId] = { label: `${look.name}: ${game.world.players[o.playerId].lastName}`, color: look.color };
  }
  return out;
}

// With the ball: the three things you can do with it, right now.
function BallBar({ onAct }: { onAct: (kind: 'shot' | 'pass' | 'dribble') => void }) {
  const items: { kind: 'shot' | 'pass' | 'dribble'; label: string; icon: IconName }[] = [
    { kind: 'shot', label: 'Shoot', icon: 'football' },
    { kind: 'pass', label: 'Pass', icon: 'git-branch' },
    { kind: 'dribble', label: 'Take him on', icon: 'flash' },
  ];
  return (
    <View style={styles.shoutBar}>
      {items.map((it) => (
        <Pressable
          key={it.kind}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          onPress={() => onAct(it.kind)}
          style={({ pressed }) => [styles.shoutBtn, { backgroundColor: pressed ? colors.accentDark : colors.accent, borderColor: colors.accent, borderBottomWidth: 4, borderBottomColor: '#5a7a22' }]}
        >
          <Row gap={6}>
            <Icon name={it.icon} size={16} color={colors.ink} />
            <Text style={[styles.shoutLabel, { color: colors.ink }]} numberOfLines={1}>
              {it.label}
            </Text>
          </Row>
        </Pressable>
      ))}
    </View>
  );
}

const SHOUTS: { kind: ShoutKind; label: string; hint: string; icon: IconName }[] = [
  { kind: 'call', label: 'Call for it', hint: 'More of the ball', icon: 'megaphone' },
  { kind: 'run', label: 'Make a run', hint: 'More shots', icon: 'flash' },
  { kind: 'track', label: 'Track back', hint: 'Help defend', icon: 'shield' },
];

// Career: calls the user makes from the pitch, each lasting ten minutes.
const ZONES: { key: Zone; label: string; icon: IconName }[] = [
  { key: 'defend', label: 'Defend', icon: 'shield' },
  { key: 'middle', label: 'Middle', icon: 'swap-horizontal' },
  { key: 'attack', label: 'Attack', icon: 'flash' },
];

// Where the user plays: back to front, left to right. It changes which
// moments come to him (see Zone in the engine).
function ZoneSlider({ game, live }: { game: Game; live: MatchState }) {
  const mutateLive = useStore((s) => s.mutateLive);
  const zone = zoneOf(game.world, live);
  const at = ZONES.findIndex((z) => z.key === zone);
  const [w, setW] = useState(0);
  const [x] = useState(() => new Animated.Value(at));
  useEffect(() => {
    Animated.spring(x, { toValue: at, useNativeDriver: false, speed: 22, bounciness: 6 }).start();
  }, [at, x]);
  const id = game.career?.playerId;
  const onPitch = !!id && (live.home.onPitch.includes(id) || live.away.onPitch.includes(id));
  if (!onPitch || game.world.players[id!]?.position === 'GK') return null;
  const seg = w / 3;
  return (
    <View style={styles.zoneTrack} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && <Animated.View style={[styles.zoneThumb, { width: seg - 6, transform: [{ translateX: x.interpolate({ inputRange: [0, 2], outputRange: [3, 3 + 2 * seg] }) }] }]} />}
      {ZONES.map((z) => {
        const on = z.key === zone;
        return (
          <Pressable
            key={z.key}
            accessibilityRole="button"
            accessibilityLabel={`Play ${z.label.toLowerCase()}`}
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              haptic();
              mutateLive((m) => setZone(m, z.key));
            }}
            style={styles.zoneStop}
          >
            <Icon name={z.icon} size={14} color={on ? colors.ink : colors.muted} />
            <Text style={[styles.zoneLabel, on && { color: colors.ink }]}>{z.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ShoutBar({ game, live }: { game: Game; live: MatchState }) {
  const mutateLive = useStore((s) => s.mutateLive);
  const id = game.career?.playerId;
  if (!id || !(live.home.onPitch.includes(id) || live.away.onPitch.includes(id))) {
    return (
      <View style={[styles.shoutBar, { justifyContent: 'center' }]}>
        <Icon name="time-outline" size={15} color={colors.muted} />
        <Text style={styles.shoutWait}>On the bench. Calls open when you come on.</Text>
      </View>
    );
  }
  const active = live.shout && live.minute <= live.shout.until ? live.shout.kind : null;
  return (
    <View style={styles.shoutBar}>
      {SHOUTS.map((sh) => {
        const on = active === sh.kind;
        const disabled = false;
        return (
          <Pressable
            key={sh.kind}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={sh.label}
            accessibilityState={{ disabled, selected: on }}
            onPress={() => {
              haptic('medium');
              mutateLive((m, g) => {
                shout(g.world, m, sh.kind);
              });
            }}
            style={[styles.shoutBtn, on && { borderColor: colors.accent, backgroundColor: alpha(colors.accent, 0.16) }, disabled && { opacity: 0.45 }]}
          >
            <Row gap={6}>
              <Icon name={sh.icon} size={16} color={on ? colors.accent : colors.text} />
              <Text style={[styles.shoutLabel, on && { color: colors.accent }]} numberOfLines={1}>
                {sh.label}
              </Text>
            </Row>
            {on && <Text style={styles.shoutHint}>{`${live.shout!.until - live.minute + 1}' left`}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

// Manager: change the approach at any time, or open the bench.
function Touchline({ live, side, onChanges }: { live: MatchState; side: SideKey; onChanges: () => void }) {
  const mutateLive = useStore((s) => s.mutateLive);
  const me = live[side];
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.shoutBar}>
        {STYLES.map((st) => {
          const on = me.style === st.key;
          return (
            <Pressable
              key={st.key}
              accessibilityRole="button"
              accessibilityLabel={st.label}
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptic('medium');
                mutateLive((m) => (m[side].style = st.key));
              }}
              style={[styles.shoutBtn, on && { borderColor: colors.accent, backgroundColor: alpha(colors.accent, 0.16) }]}
            >
              <Text style={[styles.shoutLabel, on && { color: colors.accent }]}>{st.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Button label={`Substitutions (${5 - me.subsUsed} left)`} icon="swap-vertical" small variant="secondary" onPress={onChanges} />
    </View>
  );
}

const CHOICES: Record<string, { label: string; hint: string; icon: IconName }> = {
  shot: { label: 'Shoot', hint: 'Go for goal now', icon: 'football' },
  dribble: { label: 'Take him on', hint: 'Beat your man, then shoot', icon: 'flash' },
  pass: { label: 'Pass', hint: 'Find a team-mate', icon: 'git-branch' },
  freekick: { label: 'Shoot it', hint: 'Over or round the wall', icon: 'football' },
};
// A free kick's pass is a ball into the box.
const SET_PIECE_PASS = { label: 'Cross it in', hint: 'Pick a man in the box', icon: 'arrow-redo' as IconName };

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
  header: { title: 'Cross coming in!', icon: 'arrow-up-circle' },
  choice: { title: 'Your call', icon: 'help-circle' },
  intercept: { title: 'Read the pass', icon: 'eye' },
  block: { title: 'Block it!', icon: 'hand-right' },
  clear: { title: 'Head it clear!', icon: 'arrow-up-circle' },
};

function MomentPanel({ game, moment, getSim }: { game: Game; moment: KeyMoment; getSim: () => PitchSim | null }) {
  const mutateLive = useStore((s) => s.mutateLive);
  const actor = game.world.players[moment.actorId];
  const [move, setMove] = useState<string | null>(null);
  const resolve = (q: number | null, chosen?: string, moveId?: string, forced?: ShotOutcome, aim?: number, blocker?: string) => mutateLive((m, g) => resolveMoment(g.world, m, q, chosen, moveId, forced, aim, blocker));
  // The defenders in the way on the pitch as the moment opens.
  const [lanes] = useState(() => (moment.kind === 'shot' ? getSim()?.laneDefenders(moment.actorId) : undefined));
  const names: Record<string, string> = {};
  for (const o of moment.options ?? []) names[o.playerId] = game.world.players[o.playerId].lastName;
  const base = MOMENT_TITLES[moment.kind];
  // The same kind of moment reads differently by where it is on the pitch.
  const head =
    moment.kind === 'shot' && moment.view === 'outside'
      ? { title: 'Shot from distance', icon: base.icon }
      : moment.kind === 'shot' && moment.view === 'oneonone'
        ? { title: 'One on one!', icon: base.icon }
        : moment.kind === 'header' && moment.view === 'corner'
          ? { title: 'Corner!', icon: 'flag' as IconName }
          : moment.setPiece && moment.kind === 'choice'
            ? { title: 'Free kick', icon: 'navigate' as IconName }
            : base;
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
          ? moment.kind === 'intercept'
            ? `${fullName(game.world.players[moment.attackerId])} is looking for a pass.`
            : moment.kind === 'block'
              ? `${fullName(game.world.players[moment.attackerId])} shapes to shoot.`
              : moment.kind === 'clear'
                ? `A cross is coming in for ${fullName(game.world.players[moment.attackerId])}.`
                : moment.quiet
                  ? `${fullName(game.world.players[moment.attackerId])} runs at you.`
                  : `${fullName(game.world.players[moment.attackerId])} is through on ${moment.kind === 'save' ? 'goal' : 'you'}.`
          : moment.kind === 'header'
            ? `The cross is coming to ${fullName(actor)}.`
            : `${fullName(actor)} has the ball${moment.bonus > 0 ? ' and a clear sight of goal' : ''}.`}
      </T>
      {moment.weakFoot && moment.kind !== 'choice' && <Pill label="On your weaker foot" icon="footsteps" color={colors.orange} />}
      {moment.kind === 'choice' && (
        <View style={{ gap: 8 }}>
          {(moment.choices ?? []).map((k: MomentKind) => {
            const c = moment.setPiece && k === 'pass' ? SET_PIECE_PASS : CHOICES[k];
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                onPress={() => {
                  haptic('medium');
                  mutateLive((m, g) => chooseMoment(g.world, m, k));
                }}
                style={({ pressed }) => [styles.choiceBtn, pressed && { backgroundColor: alpha(colors.accent, 0.16) }]}
              >
                <View style={styles.choiceIcon}>
                  <Icon name={c.icon} size={20} color={colors.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceLabel}>{c.label}</Text>
                  <Text style={[styles.shoutHint, { textAlign: 'left' }]}>{k === 'shot' && moment.weakFoot ? 'On your weaker foot' : c.hint}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
      )}
      {moment.kind === 'header' && <HeaderGame from={moment.view === 'corner' ? 'corner' : 'cross'} air={(actor.attrs.physical + actor.attrs.shooting) / 2 + ((actor.heightCm ?? 180) - 180) / 2} onDone={(q) => resolve(q)} />}
      {(moment.kind === 'shot' || moment.kind === 'penalty' || moment.kind === 'freekick') && (
        <ShotGame kind={moment.kind} composure={actor.attrs.composure} shooting={actor.attrs.shooting} weakFoot={!!moment.weakFoot} finesse={skillLevel(actor, 'finesse')} keeper={game.world.players[moment.keeperId]?.attrs.goalkeeping ?? 60} view={moment.view === 'outside' || moment.view === 'oneonone' ? moment.view : 'box'} range={moment.range ?? 0} chip={!!actor.moves?.includes('chip')} defenders={lanes} onDone={(q, _t, outcome, aim, blocker) => resolve(q, undefined, undefined, outcome, aim, blocker)} />
      )}
      {moment.kind === 'dribble' && <MovePicker actor={actor} value={move} onChange={setMove} />}
      {moment.kind === 'dribble' && <DribbleFor key={move ?? 'none'} actor={actor} move={move} seed={moment.minute + moment.actorId.length} onDone={(q) => resolve(q, undefined, move ?? undefined)} />}
      {moment.kind === 'tackle' && <DribbleGame mode="tackle" speed={skillLevel(actor, 'wall')} onDone={(q) => resolve(q)} />}
      {moment.kind === 'intercept' && <InterceptGame vision={actor.attrs.vision} onDone={(q) => resolve(q)} />}
      {moment.kind === 'block' && <BlockGame defending={actor.attrs.defending} onDone={(q) => resolve(q)} />}
      {moment.kind === 'clear' && <ClearGame air={(actor.attrs.physical + actor.attrs.defending) / 2 + ((actor.heightCm ?? 180) - 180) / 2} onDone={(q) => resolve(q)} />}
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

function HalfTimePanel({ game, live, side, title = 'Half time team talk', doneLabel = 'Start second half', onDone }: { game: Game; live: MatchState; side: SideKey; title?: string; doneLabel?: string; onDone?: () => void }) {
  const mutateLive = useStore((s) => s.mutateLive);
  const [outId, setOutId] = useState<string | null>(null);
  const [inId, setInId] = useState<string | null>(null);
  const me = live[side];
  const P = game.world.players;
  const row = (id: string, active: boolean, color: string, onPress: () => void, extra?: string) => (
    <Pressable key={id} onPress={onPress} style={[styles.subRow, active && { borderColor: color, backgroundColor: alpha(color, 0.12) }]}>
      <Text style={[styles.pos, { color: POSITION_COLORS[P[id].position] }]}>{P[id].role ?? P[id].position}</Text>
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
        <H2>{title}</H2>
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
      <Button label={doneLabel} icon="play" onPress={() => (onDone ? onDone() : mutateLive((m) => resumeFromHalf(m)))} />
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

// Possession and shots. Ratings live in the lineups below, so they are not
// repeated here.
function MatchStats({ live }: { live: MatchState }) {
  const [hp, ap] = possessionPct(live);
  return (
    <Card>
      <StatLine label="Possession" h={`${hp}%`} a={`${ap}%`} hv={hp} av={ap} />
      <StatLine label="Shots" h={String(live.home.shots)} a={String(live.away.shots)} hv={live.home.shots} av={live.away.shots} />
      <StatLine label="On target" h={String(live.home.onTarget)} a={String(live.away.onTarget)} hv={live.home.onTarget} av={live.away.onTarget} />
    </Card>
  );
}

const styles = StyleSheet.create({
  tblHead: { fontFamily: fonts.semibold, fontSize: 11, color: colors.faint, letterSpacing: 0.6 },
  tblRow: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  tblCell: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  tblNum: { width: 30, textAlign: 'right' },
  scorerLine: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.muted, lineHeight: 17 },
  ctl: { minWidth: 40, height: 34, paddingHorizontal: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgElev, borderWidth: 1.5, borderColor: colors.borderStrong },
  ctlText: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
  board: { borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  clock: { fontFamily: fonts.display, fontSize: 20, color: colors.text, letterSpacing: 1 },
  team: { alignItems: 'center', flex: 1, gap: 6 },
  teamName: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: 0.6, textTransform: 'uppercase', flexShrink: 1 },
  score: { fontFamily: fonts.display, fontSize: 46, color: colors.text, lineHeight: 50, minWidth: 30, textAlign: 'center' },
  momentBackdrop: { flex: 1, backgroundColor: 'rgba(4,6,12,0.55)' },
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
  moveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElev },
  shoutBar: { flexDirection: 'row', gap: 6, alignItems: 'stretch' },
  zoneTrack: { flexDirection: 'row', height: 36, borderRadius: 10, backgroundColor: colors.bgElev, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  zoneThumb: { position: 'absolute', top: 3, bottom: 3, left: 0, borderRadius: 8, backgroundColor: colors.accent },
  zoneStop: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  zoneLabel: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.muted, letterSpacing: 0.4 },
  shoutBtn: { flex: 1, alignItems: 'center', gap: 1, paddingVertical: 6, paddingHorizontal: 4, minHeight: 44, justifyContent: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  shoutLabel: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text, textAlign: 'center' },
  shoutHint: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, textAlign: 'center' },
  shoutWait: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, paddingVertical: 12 },
  choiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: alpha(colors.accent, 0.4), backgroundColor: colors.bgElev, minHeight: 56 },
  choiceIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  choiceLabel: { fontFamily: fonts.display, fontSize: 19, color: colors.text, letterSpacing: 0.4 },
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
