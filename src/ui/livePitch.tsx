import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { Club, World } from '../engine/types';
import { MatchState, SideKey } from '../engine/match';
import { teamById } from '../engine/lineup';
import { moveToShow } from '../engine/pace';
import { formationSpots } from '../engine/play';
import { shortName } from '../engine/player';
import { BodyInfo, Callout, PL, PW, PitchSim } from './pitchSim';
import { CaptionQueue } from './captions';
import { alpha, colors, fonts, luminance } from './theme';
import { motionReduced, useSettings } from '../state/settings';
import { matchKits } from './moments/Keeper';
import { FootballIcon } from './football';
import { RigFigure, useLooks } from './rig/Figure';
import { FightScene, GoalScene, RefScene } from './stage/Scene';
import { playSound } from './sound';

const NATIVE = Platform.OS !== 'web';
// The drawing area in metres: the pitch plus a strip for the goals.
const VX = -3;
const VW = PL + 6;
const VY = -1.5;
const VH = PW + 3;

const kitFill = (c: Club) => c.colors[0];
const kitRing = (c: Club) => (c.colors[1] && c.colors[1].toLowerCase() !== c.colors[0].toLowerCase() ? c.colors[1] : luminance(c.colors[0]) > 0.55 ? '#111111' : '#ffffff');

// What each drawn player needs every frame: where he is, and pop (his
// size: a celebration jump).
type BodyAnim = { pos: Animated.ValueXY; pop: Animated.Value };
type Registry = Map<string, BodyAnim>;

export interface PitchTarget {
  label: string;
  color: string;
}

// A team-mate the user can pass to: a coloured ring and a tag, tappable.
function TargetRing({ v, size, target, onPress }: { v: Animated.ValueXY; size: number; target: PitchTarget; onPress: () => void }) {
  const ring = size + 18;
  return (
    <Animated.View style={{ position: 'absolute', left: v.x, top: v.y, width: ring, height: ring, marginLeft: -ring / 2, marginTop: -ring / 2, zIndex: 5 }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={target.label} hitSlop={10} style={{ width: ring, height: ring, borderRadius: ring / 2, borderWidth: 3, borderColor: target.color, backgroundColor: alpha(target.color, 0.18) }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: ring, left: -30, right: -30, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: '#ffffff', backgroundColor: alpha('#000000', 0.55), paddingHorizontal: 5, borderRadius: 6, overflow: 'hidden' }} numberOfLines={1}>
          {target.label}
        </Text>
      </View>
    </Animated.View>
  );
}

function Dot({ id, registry, size, fill, ring, text, textColor, glow, keeper, target, onTarget, tag }: { id: string; registry: Registry; size: number; fill: string; ring: string; text: string; textColor: string; glow: boolean; keeper?: boolean; target?: PitchTarget; onTarget?: (id: string) => void; tag?: string }) {
  const a = useState<BodyAnim>(() => ({ pos: new Animated.ValueXY({ x: -100, y: -100 }), pop: new Animated.Value(1) }))[0];
  const v = a.pos;
  useEffect(() => {
    registry.set(id, a);
    return () => {
      registry.delete(id);
    };
  }, [id, registry, a]);
  return (
    <>
    {target && onTarget && <TargetRing v={v} size={size} target={target} onPress={() => onTarget(id)} />}
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: v.x,
        top: v.y,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        // Keepers: a squarer shape in their own colours, with gloves.
        borderRadius: keeper ? size * 0.32 : size / 2,
        backgroundColor: fill,
        borderWidth: glow ? 2.5 : 1.5,
        borderColor: ring,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: glow ? ring : '#000',
        shadowOpacity: glow ? 0.9 : 0.4,
        shadowRadius: glow ? 6 : 2,
        shadowOffset: { width: 0, height: 1 },
        transform: [{ scale: a.pop }],
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.48, color: textColor, lineHeight: size * 0.62 }}>{text}</Text>
      {/* A team-mate to pick stands up as a person. */}
      {target && (
        <Svg width={size * 2} height={size * 2.4} viewBox="-30 -72 60 76" style={{ position: 'absolute', bottom: size * 0.3, left: -size / 2 }}>
          <RigFigure x={0} ground={0} h={60} kit={fill} />
        </Svg>
      )}
      {tag && (
        <View style={{ position: 'absolute', bottom: size + 1, left: -16, right: -16, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.6, color: colors.ink, backgroundColor: colors.gold, borderRadius: 4, paddingHorizontal: 4, overflow: 'hidden' }}>{tag}</Text>
        </View>
      )}
      {keeper && (
        <>
          <View style={{ position: 'absolute', left: -size * 0.32, top: size * 0.12, width: size * 0.36, height: size * 0.36, borderRadius: size, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#111827' }} />
          <View style={{ position: 'absolute', right: -size * 0.32, top: size * 0.12, width: size * 0.36, height: size * 0.36, borderRadius: size, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#111827' }} />
        </>
      )}
    </Animated.View>
    </>
  );
}

// A burst of confetti in the scorer's colours, from where he celebrates.
function Confetti({ x, y, palette }: { x: number; y: number; palette: string[] }) {
  const k = useState(() => new Animated.Value(0))[0];
  const [bits] = useState(() =>
    Array.from({ length: 26 }, (_, i) => {
      const ang = Math.random() * Math.PI * 2;
      const far = 30 + Math.random() * 60;
      return { dx: Math.cos(ang) * far, dy: Math.sin(ang) * far - 20, spin: (Math.random() - 0.5) * 720, color: palette[i % palette.length], w: 3 + Math.random() * 3 };
    }),
  );
  useEffect(() => {
    Animated.timing(k, { toValue: 1, duration: 1700, useNativeDriver: NATIVE }).start();
  }, [k]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y }}>
      {bits.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: b.w,
            height: b.w * 1.6,
            borderRadius: 1,
            backgroundColor: b.color,
            opacity: k.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.9, 0] }),
            transform: [
              { translateX: k.interpolate({ inputRange: [0, 1], outputRange: [0, b.dx] }) },
              // Out fast, then drifting down.
              { translateY: k.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, b.dy * 0.8, b.dy + 26] }) },
              { rotate: k.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${b.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

function CalloutView({ c, home, away, focusId }: { c: Callout; home: Club; away: Club; focusId?: string }) {
  const looks = useLooks();
  const pop = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (motionReduced()) pop.setValue(1);
    else Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: NATIVE }).start();
  }, [pop]);
  const big = c.tone === 'goal';
  const color = big ? (c.side === 'home' ? home.colors[0] : away.colors[0]) : colors.gold;
  if (c.fight) {
    const kits = matchKits(home.colors, away.colors);
    const homeFirst = c.fight.a === 'home';
    return <FightScene c={c} aKit={homeFirst ? kits.homeShirt : kits.awayShirt} bKit={homeFirst ? kits.awayShirt : kits.homeShirt} />;
  }
  if (c.signal) return <RefScene c={c} />;
  if (big) {
    const kits = matchKits(home.colors, away.colors);
    const you = c.scorer === focusId ? looks.me : undefined;
    return <GoalScene c={c} kit={c.side === 'home' ? kits.homeShirt : kits.awayShirt} skin={you?.skin} hair={you ? you.hair : undefined} boots={you?.boots} tint={color} />;
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: big ? 'center' : 'flex-start', paddingTop: big ? 0 : 10 }, big && { backgroundColor: alpha(color, 0.3) }]}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }], opacity: pop }}>
        {(c.tone === 'yellow' || c.tone === 'red') && (
          // The card itself, held up.
          <View style={{ width: 22, height: 30, borderRadius: 3, marginBottom: 4, backgroundColor: c.tone === 'red' ? '#e5322d' : '#f6d32d', borderWidth: 1.5, borderColor: '#ffffff', transform: [{ rotate: '-8deg' }] }} />
        )}
        <Text style={{ fontFamily: fonts.display, fontSize: big ? 64 : 24, color: '#ffffff', letterSpacing: 3, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 } }}>{c.text}</Text>
        {c.sub ? <Text style={{ fontFamily: fonts.bold, fontSize: big ? 16 : 12, color: '#ffffff', letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 }}>{c.sub}</Text> : null}
      </Animated.View>
    </View>
  );
}

export interface LivePitchProps {
  world: World;
  live: MatchState;
  focusId?: string;
  // 1, 2 or 4: how fast the pitch plays.
  speed: number;
  width: number;
  // True while the clock may run. The pitch asks for the next minute when
  // its current move has played out.
  running: boolean;
  paused: boolean;
  // A moment game covers the pitch: everyone stays exactly where they are, so
  // play resumes from the picture the game showed.
  frozen?: boolean;
  onNeedMinute?: () => void;
  onGoal?: () => void;
  onMomentReady?: () => void;
  // Pass options to light up on the pitch, and what a tap on one does.
  targets?: Record<string, PitchTarget>;
  onTarget?: (id: string) => void;
  // Tells the match whether the user's player has the ball in a quiet move,
  // and hands over the pitch so the match can let him act on it.
  onBall?: (has: boolean) => void;
  onSim?: (sim: PitchSim) => void;
  // Career: the user's zone and current call, which move his player.
  zone?: 'defend' | 'middle' | 'attack';
  shout?: 'call' | 'run' | 'track' | null;
  // Career: the celebration the user picked for his player.
  celebration?: string;
}

const SHOUT_TAG = { call: 'CALL', run: 'RUN', track: 'BACK' } as const;
// Real seconds play waits while the user's player has the ball, so he can
// shoot, pass or take his man on.
const ON_BALL_WAIT = 1.4;

// The live pitch: 22 players and a ball, moving every frame (see pitchSim).
export function LivePitch({ world, live, focusId, speed, width, running, paused, frozen, onNeedMinute, onGoal, onMomentReady, targets, onTarget, onBall, onSim, zone, shout, celebration }: LivePitchProps) {
  const h = (width * VH) / VW;
  const home = teamById(world, live.home.clubId);
  const away = teamById(world, live.away.clubId);
  const sim = useState(() => new PitchSim(live.rngState))[0];
  const registry = useState<Registry>(() => new Map())[0];
  // z is the ball's height: it lifts the ball off its shadow and grows it,
  // and the shadow shrinks and fades, so a lob reads clearly against a pass
  // along the ground.
  // rot spins the ball as it rolls.
  const ball = useState(() => ({ pos: new Animated.ValueXY({ x: -50, y: -50 }), shadow: new Animated.ValueXY({ x: -50, y: -50 }), size: new Animated.Value(10), z: new Animated.Value(0), rot: new Animated.Value(0) }))[0];
  const [confetti, setConfetti] = useState<{ key: number; x: number; y: number; palette: string[] } | null>(null);
  // Where the VAR monitor stands while a check is on.
  const [monitor, setMonitor] = useState<{ x: number; y: number } | null>(null);
  const [caption, setCaption] = useState(sim.caption);
  const [callout, setCallout] = useState<Callout | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  // Players walking off (subbed, sent off, injured): still drawn until they
  // reach the touchline.
  const [gone, setGone] = useState<{ id: string; side: SideKey }[]>([]);
  const refPos = useState(() => new Animated.ValueXY({ x: -50, y: -50 }))[0];
  // Latest props for the frame loop, which is set up once.
  const homeKit = home.colors;
  const awayKit = away.colors;
  const props = useRef({ speed, running, paused, frozen, onNeedMinute, onGoal, onMomentReady, onBall, focusId, width, h, zone, shout, homeKit, awayKit });
  useEffect(() => {
    props.current = { speed, running, paused, frozen, onNeedMinute, onGoal, onMomentReady, onBall, focusId, width, h, zone, shout, homeKit, awayKit };
  });
  useEffect(() => {
    if (focusId && celebration) sim.setCelebration(focusId, celebration);
  }, [sim, focusId, celebration]);
  useEffect(() => {
    onSim?.(sim);
    // Handed over once; the sim lives as long as this pitch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim]);

  // Players on the pitch: who, where they stand in the shape, how fast.
  const ids = `${live.home.onPitch.join(',')}|${live.away.onPitch.join(',')}|${live.home.formation}|${live.away.formation}`;
  useEffect(() => {
    const infos: BodyInfo[] = [];
    for (const side of ['home', 'away'] as SideKey[]) {
      const team = side === 'home' ? home : away;
      const spots = formationSpots(world, { ...team, formation: live[side].formation }, live[side].onPitch);
      for (const id of live[side].onPitch) {
        const p = world.players[id];
        if (!p) continue;
        infos.push({ id, side, spot: spots[id] ?? { depth: 0.5, lat: 0.5 }, pos: id === live[side].standIn ? 'GK' : p.position, pace: p.attrs.pace, name: `#${live.numbers?.[id] ?? ''} ${shortName(p)}` });
      }
    }
    sim.sync(infos);
    // ids stands in for the lineups, which change in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, sim, world]);

  // Each new move from the engine joins the queue, once. The engine builds a
  // fresh array for every move, so the array itself is the key: a call, a
  // card or a sub adds events but must not replay the move.
  const asked = useRef(false);
  const queued = useRef<unknown>(null);
  const period = useRef(live.half);
  useEffect(() => {
    if (period.current === live.half) return;
    period.current = live.half;
    sim.halfTime(live.half === 2 ? 'away' : 'home');
    asked.current = false;
    queued.current = null;
  }, [live.half, sim]);
  const play = moveToShow(live);
  useEffect(() => {
    if (play && play !== queued.current) {
      queued.current = play;
      sim.enqueue(play.map((s) => ({ ...s })));
    }
    asked.current = false;
  }, [play, live.minute, sim]);

  useEffect(() => {
    sim.setHooks({
      onGoal: () => props.current.onGoal?.(),
      onMoment: () => props.current.onMomentReady?.(),
      // Fast-forwarding at 4x would turn kicks into a rattle; keep the big ones.
      onSound: (name, volume) => {
        if (props.current.speed >= 4 && name === 'kick') return;
        // The referee's voice has its own switch, and stays quiet at 4x.
        if (name.startsWith('ref-') && (props.current.speed >= 4 || !useSettings.getState().refVoice)) return;
        playSound(name, volume);
      },
    });
    let raf = 0;
    let last = 0;
    let lastCaption = '';
    const captions = new CaptionQueue();
    let lastCallout: Callout | null = null;
    let lastOwner: string | null = null;
    let lastOnBall = false;
    let onBallAt = 0;
    let lastGone = '';
    let lastCelebrate = -1;
    let lastVar: number | null = null;
    const toScreen = (x: number, y: number) => {
      const { width: w, h: hh } = props.current;
      return { x: ((y - VX) / VW) * w, y: ((x - VY) / VH) * hh };
    };
    const frame = (now: number) => {
      const elapsed = last ? (now - last) / 1000 : 0;
      // Returning from the background must not fast-forward the match.
      const dt = elapsed > 0.25 ? 0 : elapsed;
      last = now;
      const p = props.current;
      if (!p.frozen && !sim.holding) sim.focus = p.focusId && p.zone ? { id: p.focusId, zone: p.zone, shout: p.shout ?? null } : null;
      // Decisions hold the physical state captured by the engine.
      // On the ball play eases off so the choice is his, but at 4x
      // it stays at full 1x instead of dropping to slow motion.
      const scale = p.paused || p.frozen ? 0 : sim.holding ? 0.25 : lastOnBall ? (p.speed >= 4 ? 1 : Math.min(1, p.speed) * 0.8) : p.speed;
      sim.update(dt * scale);
      const c = sim.celebrate;
      for (const [id, body] of sim.bodies) {
        const v = registry.get(id);
        if (!v) continue;
        v.pos.setValue(toScreen(body.x, body.y));
        // The scorer jumps for joy at the corner flag (a backflip leaps).
        let pop = 1;
        if (c && id === c.scorer && Math.hypot(body.x - c.cx, body.y - c.cy) < 2.5) {
          const f = ((sim.clock - c.at) * (c.style === 'backflip' ? 1.2 : 2)) % 1;
          pop = 1 + Math.sin(f * Math.PI) * (c.style === 'backflip' ? 0.5 : 0.25);
        }
        v.pop.setValue(pop);
      }
      const b = toScreen(sim.ball.x, sim.ball.y);
      ball.shadow.setValue(b);
      const bp = { x: b.x, y: b.y - sim.ball.z * 5 };
      ball.pos.setValue(bp);
      ball.size.setValue(10 + sim.ball.z * 2.2);
      ball.z.setValue(Math.min(1, sim.ball.z / 4));
      ball.rot.setValue(sim.ball.rot);
      // A VAR check: the monitor appears at the touchline until the call.
      const vc = sim.varCheck;
      if ((vc?.at ?? null) !== lastVar) {
        lastVar = vc?.at ?? null;
        setMonitor(vc ? toScreen(vc.x, vc.y) : null);
      }
      // A goal: confetti once, where the scorer celebrates.
      if (c && c.at !== lastCelebrate) {
        lastCelebrate = c.at;
        const at = toScreen(c.cx, c.cy);
        const scorerSide = c.side === 'home' ? props.current.homeKit : props.current.awayKit;
        setConfetti({ key: c.at, x: at.x, y: at.y, palette: [...scorerSide, colors.gold, '#ffffff'] });
      }
      captions.offer(sim.caption, now / 1000);
      const line = captions.read(now / 1000);
      if (line !== lastCaption) {
        lastCaption = line;
        setCaption(line);
      }
      if (sim.callout !== lastCallout) {
        lastCallout = sim.callout;
        setCallout(sim.callout);
      }
      refPos.setValue(toScreen(sim.ref.x, sim.ref.y));
      const leavingNow = [...sim.bodies.values()].filter((x) => x.leaving).map((x) => `${x.id}:${x.side}`).join(',');
      if (leavingNow !== lastGone) {
        lastGone = leavingNow;
        setGone(leavingNow ? leavingNow.split(',').map((x) => ({ id: x.split(':')[0], side: x.split(':')[1] as SideKey })) : []);
      }
      if (sim.ball.owner !== lastOwner) {
        lastOwner = sim.ball.owner;
        setOwner(sim.ball.owner);
      }
      const onBallNow = !!p.focusId && sim.ball.owner === p.focusId && !sim.holding && sim.quietAhead() && sim.layout === 'play';
      if (onBallNow !== lastOnBall) {
        lastOnBall = onBallNow;
        if (onBallNow) onBallAt = now;
        p.onBall?.(onBallNow);
      }
      // Ready for more: ask once per move. With the ball at his feet the
      // user gets a moment to act first.
      const waiting = onBallNow && now - onBallAt < ON_BALL_WAIT * 1000;
      if (p.running && !p.paused && sim.idle() && !asked.current && !waiting) {
        asked.current = true;
        p.onNeedMinute?.();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sim, registry, ball, refPos]);

  const size = Math.max(15, Math.min(21, width / 22));
  const { awayShirt, homeKeeper, awayKeeper } = matchKits(home.colors, away.colors);
  // The user's side attacks to the right if they are at home.
  const mine = focusId ? (live.home.onPitch.includes(focusId) || live.home.bench.includes(focusId) ? 'right' : 'left') : null;
  const attack = mine && (live.minute <= 3 || (live.minute >= 46 && live.minute <= 48)) ? mine : null;
  const dots = (['home', 'away'] as SideKey[]).flatMap((side) => {
    const team = side === 'home' ? home : away;
    const ids = [...live[side].onPitch, ...gone.filter((g) => g.side === side && !live[side].onPitch.includes(g.id)).map((g) => g.id)];
    return ids.map((id) => {
      const me = id === focusId;
      const has = id === owner;
      const keeper = world.players[id]?.position === 'GK';
      const fill = keeper ? (side === 'home' ? homeKeeper : awayKeeper) : side === 'away' ? awayShirt : kitFill(team);
      return (
        <Dot
          key={id}
          id={id}
          registry={registry}
          size={me ? size + 3 : size}
          fill={fill}
          ring={me ? colors.gold : has ? '#ffffff' : keeper ? '#111827' : side === 'away' && awayShirt !== away.colors[0] ? away.colors[0] : kitRing(team)}
          text={String(live.numbers?.[id] ?? '')}
          textColor={luminance(fill) > 0.55 ? '#111111' : '#ffffff'}
          glow={me || has}
          tag={me && shout ? SHOUT_TAG[shout] : undefined}
          keeper={keeper}
          target={targets?.[id]}
          onTarget={onTarget}
        />
      );
    });
  });

  const line = { stroke: '#ffffff', strokeOpacity: 0.5, strokeWidth: 0.35, fill: 'none' };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ width, height: h, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.pitchDark }}>
        <Svg width={width} height={h} viewBox={`${VX} ${VY} ${VW} ${VH}`} style={StyleSheet.absoluteFill}>
          {Array.from({ length: 10 }, (_, i) => (
            <Rect key={i} x={i * 10.5} y={0} width={10.5} height={PW} fill={i % 2 ? colors.pitch : colors.pitchDark} />
          ))}
          <Rect x={0} y={0} width={PL} height={PW} {...line} />
          <Line x1={PL / 2} y1={0} x2={PL / 2} y2={PW} {...line} />
          <Circle cx={PL / 2} cy={PW / 2} r={9.15} {...line} />
          <Circle cx={PL / 2} cy={PW / 2} r={0.5} fill="#ffffff" fillOpacity={0.6} />
          <Rect x={0} y={PW / 2 - 20.15} width={16.5} height={40.3} {...line} />
          <Rect x={0} y={PW / 2 - 9.16} width={5.5} height={18.32} {...line} />
          <Rect x={PL - 16.5} y={PW / 2 - 20.15} width={16.5} height={40.3} {...line} />
          <Rect x={PL - 5.5} y={PW / 2 - 9.16} width={5.5} height={18.32} {...line} />
          <Circle cx={11} cy={PW / 2} r={0.45} fill="#ffffff" fillOpacity={0.6} />
          <Circle cx={PL - 11} cy={PW / 2} r={0.45} fill="#ffffff" fillOpacity={0.6} />
          <Path d={`M 16.5 ${PW / 2 - 7.3} A 9.15 9.15 0 0 1 16.5 ${PW / 2 + 7.3}`} {...line} />
          <Path d={`M ${PL - 16.5} ${PW / 2 - 7.3} A 9.15 9.15 0 0 0 ${PL - 16.5} ${PW / 2 + 7.3}`} {...line} />
          <Rect x={-2} y={PW / 2 - 3.66} width={2} height={7.32} fill="#ffffff" fillOpacity={0.25} stroke="#ffffff" strokeWidth={0.4} />
          <Rect x={PL} y={PW / 2 - 3.66} width={2} height={7.32} fill="#ffffff" fillOpacity={0.25} stroke="#ffffff" strokeWidth={0.4} />
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ball.shadow.x,
            top: ball.shadow.y,
            width: 10,
            height: 5,
            marginLeft: -5,
            marginTop: -1,
            borderRadius: 4,
            backgroundColor: '#000000',
            opacity: ball.z.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.15] }),
            transform: [{ scale: ball.z.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) }],
          }}
        />
        {/* Which way you are attacking, for the first moments of each half. */}
        {attack && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Svg width={width * 0.5} height={40} viewBox="0 0 200 40" style={{ transform: attack === 'left' ? [{ scaleX: -1 }] : undefined }}>
              <Path d="M 6 20 L 170 20 M 150 6 L 176 20 L 150 34" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        )}
        {dots}
        {/* The referee: black with a yellow trim. */}
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: refPos.x, top: refPos.y, width: size * 0.78, height: size * 0.78, marginLeft: (-size * 0.78) / 2, marginTop: (-size * 0.78) / 2, borderRadius: size, backgroundColor: '#111111', borderWidth: 2, borderColor: '#e8f53b' }}
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ball.pos.x,
            top: ball.pos.y,
            width: ball.size,
            height: ball.size,
            marginLeft: -5,
            marginTop: -5,
            transform: [{ rotate: ball.rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
          }}
        >
          <FootballIcon />
        </Animated.View>
        {confetti && <Confetti key={confetti.key} x={confetti.x} y={confetti.y} palette={confetti.palette} />}
        {monitor && (
          <View pointerEvents="none" style={{ position: 'absolute', left: monitor.x - 13, top: monitor.y - 22, alignItems: 'center' }}>
            {/* A pitch-side monitor: the screen on a stand. */}
            <View style={{ width: 26, height: 17, borderRadius: 3, backgroundColor: '#111827', borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 7, color: colors.accent }}>VAR</Text>
            </View>
            <View style={{ width: 3, height: 7, backgroundColor: '#e5e7eb' }} />
          </View>
        )}
        {callout && <CalloutView key={`${callout.text}-${callout.until}`} c={callout} home={home} away={away} focusId={focusId} />}
      </View>
      <View style={{ height: 22, justifyContent: 'center', paddingHorizontal: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: callout?.tone === 'goal' ? fonts.bold : fonts.semibold, fontSize: 13, color: callout?.tone === 'goal' ? colors.accent : colors.text }}>
          {caption}
        </Text>
      </View>
    </View>
  );
}
