import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { Club, World } from '../engine/types';
import { MatchState, SideKey } from '../engine/match';
import { teamById } from '../engine/lineup';
import { formationSpots } from '../engine/play';
import { shortName } from '../engine/player';
import { BodyInfo, Callout, PL, PW, PitchSim } from './pitchSim';
import { alpha, colors, fonts, luminance } from './theme';
import { motionReduced } from '../state/settings';
import { colourGap, keeperKit } from './moments/Keeper';
import { playSound } from './sound';

const NATIVE = Platform.OS !== 'web';
// The drawing area in metres: the pitch plus a strip for the goals.
const VX = -3;
const VW = PL + 6;
const VY = -1.5;
const VH = PW + 3;

const kitFill = (c: Club) => c.colors[0];
const kitRing = (c: Club) => (c.colors[1] && c.colors[1].toLowerCase() !== c.colors[0].toLowerCase() ? c.colors[1] : luminance(c.colors[0]) > 0.55 ? '#111111' : '#ffffff');

// What each drawn player needs every frame: where he is, which way he
// faces (degrees, 0 is up the screen), his stride (-1..1, legs and arms
// swing), arms (0 at his sides, 1 up and out: a diving keeper, a celebration),
// stretch (0 upright, 1 flat out: on the floor or sliding) and pop (size: a
// jump).
type BodyAnim = { pos: Animated.ValueXY; rot: Animated.Value; stride: Animated.Value; arms: Animated.Value; stretch: Animated.Value; pop: Animated.Value };
type Registry = Map<string, BodyAnim>;

const HAIR = ['#2a1d14', '#141414', '#5b3a1e', '#a7773f', '#7a4a26', '#3b2a20'];
const hashOf = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
};

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

// A player seen from above: shoulders in the shirt, the head on top, arms
// and legs that swing as he runs, all turned the way he faces. The shirt
// number stays upright on his back.
function Body({ id, registry, size, fill, ring, text, textColor, glow, keeper, target, onTarget, tag }: { id: string; registry: Registry; size: number; fill: string; ring: string; text: string; textColor: string; glow: boolean; keeper?: boolean; target?: PitchTarget; onTarget?: (id: string) => void; tag?: string }) {
  const a = useState<BodyAnim>(() => ({ pos: new Animated.ValueXY({ x: -100, y: -100 }), rot: new Animated.Value(0), stride: new Animated.Value(0), arms: new Animated.Value(0), stretch: new Animated.Value(0), pop: new Animated.Value(1) }))[0];
  useEffect(() => {
    registry.set(id, a);
    return () => {
      registry.delete(id);
    };
  }, [id, registry, a]);
  const S = size * 1.3;
  const hair = HAIR[hashOf(id) % HAIR.length];
  const rotate = a.rot.interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });
  const upright = a.rot.interpolate({ inputRange: [-720, 720], outputRange: ['720deg', '-720deg'] });
  const legW = S * 0.17;
  const limb = keeper ? '#f8fafc' : fill;
  const leg = (sign: 1 | -1) => (
    <Animated.View
      style={{
        position: 'absolute',
        left: S / 2 + sign * S * 0.13 - legW / 2,
        top: S * 0.34,
        width: legW,
        height: S * 0.34,
        borderRadius: legW,
        backgroundColor: '#1f2937',
        transform: [{ translateY: Animated.multiply(a.stride, sign * S * 0.2) }],
      }}
    />
  );
  const arm = (sign: 1 | -1) => (
    <Animated.View
      style={{
        position: 'absolute',
        left: S / 2 + sign * S * 0.4 - S * 0.09,
        top: S * 0.38,
        width: S * 0.18,
        height: S * 0.26,
        borderRadius: S * 0.1,
        backgroundColor: limb,
        borderWidth: keeper ? 1 : 0,
        borderColor: '#111827',
        transform: [
          { translateY: Animated.add(Animated.multiply(a.stride, -sign * S * 0.12), Animated.multiply(a.arms, -S * 0.3)) },
          { translateX: Animated.multiply(a.arms, sign * S * 0.14) },
        ],
      }}
    />
  );
  return (
    <>
      {target && onTarget && <TargetRing v={a.pos} size={size} target={target} onPress={() => onTarget(id)} />}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: a.pos.x,
          top: a.pos.y,
          width: S,
          height: S,
          marginLeft: -S / 2,
          marginTop: -S / 2,
          transform: [{ rotate }, { scale: a.pop }, { scaleY: a.stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
        }}
      >
        {glow && <View style={{ position: 'absolute', left: -2, top: S * 0.18, width: S + 4, height: S * 0.64, borderRadius: S, backgroundColor: alpha(ring, 0.45) }} />}
        {leg(-1)}
        {leg(1)}
        {arm(-1)}
        {arm(1)}
        {/* Shoulders in the shirt. */}
        <View style={{ position: 'absolute', left: S * 0.06, top: S * 0.3, width: S * 0.88, height: S * 0.4, borderRadius: S * 0.2, backgroundColor: fill, borderWidth: glow ? 2 : 1.2, borderColor: ring }} />
        {/* The head, a little forward of the shoulders. */}
        <View style={{ position: 'absolute', left: S * 0.32, top: S * 0.24, width: S * 0.36, height: S * 0.36, borderRadius: S, backgroundColor: hair, borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' }} />
        {!!text && (
          <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: S * 0.47, alignItems: 'center', transform: [{ rotate: upright }] }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: S * 0.27, lineHeight: S * 0.32, color: textColor }}>{text}</Text>
          </Animated.View>
        )}
      </Animated.View>
      {tag && (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: a.pos.x, top: a.pos.y, width: 40, marginLeft: -20, marginTop: -S * 0.9, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.6, color: colors.ink, backgroundColor: colors.gold, borderRadius: 4, paddingHorizontal: 4, overflow: 'hidden' }}>{tag}</Text>
        </Animated.View>
      )}
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

function CalloutView({ c, home, away }: { c: Callout; home: Club; away: Club }) {
  const pop = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (motionReduced()) pop.setValue(1);
    else Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: NATIVE }).start();
  }, [pop]);
  const big = c.tone === 'goal';
  const color = big ? (c.side === 'home' ? home.colors[0] : away.colors[0]) : colors.gold;
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
  paused?: boolean;
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
const ON_BALL_WAIT = 2.2;

// The live pitch: 22 players and a ball, moving every frame (see pitchSim).
export function LivePitch({ world, live, focusId, speed, width, running, paused, onNeedMinute, onGoal, onMomentReady, targets, onTarget, onBall, onSim, zone, shout, celebration }: LivePitchProps) {
  const h = (width * VH) / VW;
  const home = teamById(world, live.home.clubId);
  const away = teamById(world, live.away.clubId);
  const sim = useState(() => new PitchSim())[0];
  const registry = useState<Registry>(() => new Map())[0];
  // z is the ball's height: it lifts the ball off its shadow and grows it,
  // and the shadow shrinks and fades, so a lob reads clearly against a pass
  // along the ground.
  // rot spins the ball as it rolls; trail is three ghosts behind it, shown
  // only when it is moving fast.
  const ball = useState(() => ({ pos: new Animated.ValueXY({ x: -50, y: -50 }), shadow: new Animated.ValueXY({ x: -50, y: -50 }), size: new Animated.Value(10), z: new Animated.Value(0), rot: new Animated.Value(0), trail: [0, 1, 2].map(() => new Animated.ValueXY({ x: -50, y: -50 })), trailOn: new Animated.Value(0) }))[0];
  const [confetti, setConfetti] = useState<{ key: number; x: number; y: number; palette: string[] } | null>(null);
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
  const props = useRef({ speed, running, paused, onNeedMinute, onGoal, onMomentReady, onBall, focusId, width, h, zone, shout, homeKit, awayKit });
  useEffect(() => {
    props.current = { speed, running, paused, onNeedMinute, onGoal, onMomentReady, onBall, focusId, width, h, zone, shout, homeKit, awayKit };
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
  const ids = `${live.home.onPitch.join(',')}|${live.away.onPitch.join(',')}|${home.formation}|${away.formation}`;
  useEffect(() => {
    const infos: BodyInfo[] = [];
    for (const side of ['home', 'away'] as SideKey[]) {
      const team = side === 'home' ? home : away;
      const spots = formationSpots(world, team, live[side].onPitch);
      for (const id of live[side].onPitch) {
        const p = world.players[id];
        if (!p) continue;
        infos.push({ id, side, spot: spots[id] ?? { depth: 0.5, lat: 0.5 }, pos: p.position, pace: p.attrs.pace, name: `#${live.numbers?.[id] ?? ''} ${shortName(p)}` });
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
  const play = live.play;
  useEffect(() => {
    if (play && play !== queued.current) {
      queued.current = play;
      sim.enqueue(play.map((s) => ({ ...s })));
    }
    asked.current = false;
  }, [play, live.minute, sim]);

  // The break: both teams line up again.
  useEffect(() => {
    if (live.half === 2 && live.minute <= 46) sim.halfTime('away');
  }, [live.half, live.minute, sim]);

  useEffect(() => {
    sim.setHooks({
      onGoal: () => props.current.onGoal?.(),
      onMoment: () => props.current.onMomentReady?.(),
      // Fast-forwarding at 4x would turn kicks into a rattle; keep the big ones.
      onSound: (name, volume) => {
        if (props.current.speed >= 4 && name === 'kick') return;
        playSound(name, volume);
      },
    });
    let raf = 0;
    let last = 0;
    let lastCaption = '';
    let lastCallout: Callout | null = null;
    let lastOwner: string | null = null;
    let lastOnBall = false;
    let onBallAt = 0;
    let lastGone = '';
    let lastCelebrate = -1;
    const poses = new Map<string, { ang: number; phase: number }>();
    const history: { x: number; y: number }[] = [];
    const toScreen = (x: number, y: number) => {
      const { width: w, h: hh } = props.current;
      return { x: ((y - VX) / VW) * w, y: ((x - VY) / VH) * hh };
    };
    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const p = props.current;
      sim.focus = p.focusId && p.zone ? { id: p.focusId, zone: p.zone, shout: p.shout ?? null } : null;
      // A key moment plays in slow motion while the user decides.
      // On the ball, play eases to slow motion so the choice is his.
      const scale = p.paused ? 0 : sim.holding ? 0.25 : lastOnBall ? Math.min(1, p.speed) * 0.6 : p.speed;
      sim.update(dt * scale);
      const simDt = dt * scale;
      const c = sim.celebrate;
      const act = sim.act;
      const diving = !!act && (act.step.act === 'goal' || act.step.act === 'save' || act.step.act === 'miss') && !!sim.ball.flight ? act.keeperId : undefined;
      for (const [id, body] of sim.bodies) {
        const v = registry.get(id);
        if (!v) continue;
        v.pos.setValue(toScreen(body.x, body.y));
        // Screen x runs along the pitch's length, screen y across it.
        const st = poses.get(id) ?? { ang: 0, phase: Math.random() * 6 };
        const sp = Math.hypot(body.vx, body.vy);
        const dx = sp > 0.6 ? body.vy : sim.ball.y - body.y;
        const dy = sp > 0.6 ? body.vx : sim.ball.x - body.x;
        let want = (Math.atan2(dx, -dy) * 180) / Math.PI;
        let arms = id === diving ? 1 : 0;
        let stretch = body.down > 0 ? 1 : id === diving ? 0.35 : 0;
        let pop = 1;
        if (c && id === c.scorer) {
          const ct = sim.clock - c.at;
          const there = Math.hypot(body.x - c.cx, body.y - c.cy) < 2.5;
          if (c.style === 'knee-slide' && ct > 0.7 && ct < 2.6) stretch = 0.55;
          if (there && c.style === 'backflip') {
            const f = ((ct * 1.2) % 1);
            pop = 1 + Math.sin(f * Math.PI) * 0.45;
            want += f * 360;
          }
          if (there && c.style === 'robot') want = Math.round(ct * 3) % 2 ? want + 90 : want - 90;
          if (there && (c.style === 'heart' || c.style === 'shush' || c.style === 'calm')) {
            // Facing the crowd behind the corner flag.
            want = (Math.atan2(c.cy - PL / 2, -(c.cx - PW / 2)) * 180) / Math.PI;
            arms = c.style === 'calm' ? 0.3 : 0.7;
          }
          if (!there || c.style === 'knee-slide') arms = Math.max(arms, 0.8);
        } else if (c && body.side === c.side && sim.clock - c.at > 1.4 && body.pos !== 'GK') {
          // Team-mates arrive with arms up.
          arms = 0.6;
        }
        const turn = ((want - st.ang + 540) % 360) - 180;
        st.ang += turn * Math.min(1, dt * 10);
        st.phase += sp * simDt * 2.4;
        poses.set(id, st);
        v.rot.setValue(st.ang);
        v.stride.setValue(body.down > 0 ? 0 : Math.sin(st.phase) * Math.min(1, sp / 4));
        v.arms.setValue(arms);
        v.stretch.setValue(stretch);
        v.pop.setValue(pop);
      }
      const b = toScreen(sim.ball.x, sim.ball.y);
      ball.shadow.setValue(b);
      const bp = { x: b.x, y: b.y - sim.ball.z * 5 };
      ball.pos.setValue(bp);
      ball.size.setValue(10 + sim.ball.z * 2.2);
      ball.z.setValue(Math.min(1, sim.ball.z / 4));
      ball.rot.setValue(sim.ball.rot);
      // The trail follows a few frames behind, and fades in with speed.
      history.unshift(bp);
      if (history.length > 10) history.pop();
      ball.trail.forEach((g, i) => g.setValue(history[Math.min(history.length - 1, (i + 1) * 3)]));
      const moved = history.length > 3 ? Math.hypot(history[0].x - history[3].x, history[0].y - history[3].y) : 0;
      ball.trailOn.setValue(sim.ball.flight ? Math.min(1, moved / 14) : 0);
      // A goal: confetti once, where the scorer celebrates.
      if (c && c.at !== lastCelebrate) {
        lastCelebrate = c.at;
        const at = toScreen(c.cx, c.cy);
        const scorerSide = c.side === 'home' ? props.current.homeKit : props.current.awayKit;
        setConfetti({ key: c.at, x: at.x, y: at.y, palette: [...scorerSide, colors.gold, '#ffffff'] });
      }
      if (sim.caption !== lastCaption) {
        lastCaption = sim.caption;
        setCaption(sim.caption);
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
  // When the shirts are too alike, the away side wears its second colour,
  // as in a real match. Each keeper wears a colour that clashes with neither.
  const awayShirt = colourGap(home.colors[0], away.colors[0]) < 140 && away.colors[1] && colourGap(home.colors[0], away.colors[1]) > colourGap(home.colors[0], away.colors[0]) ? away.colors[1] : away.colors[0];
  const homeKeeper = keeperKit([home.colors[0], awayShirt]);
  const awayKeeper = keeperKit([home.colors[0], awayShirt, homeKeeper], homeKeeper);
  const dots = (['home', 'away'] as SideKey[]).flatMap((side) => {
    const team = side === 'home' ? home : away;
    const ids = [...live[side].onPitch, ...gone.filter((g) => g.side === side && !live[side].onPitch.includes(g.id)).map((g) => g.id)];
    return ids.map((id) => {
      const me = id === focusId;
      const has = id === owner;
      const keeper = world.players[id]?.position === 'GK';
      const fill = keeper ? (side === 'home' ? homeKeeper : awayKeeper) : side === 'away' ? awayShirt : kitFill(team);
      return (
        <Body
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
        {dots}
        {/* The referee: black with a yellow trim. */}
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: refPos.x, top: refPos.y, width: size * 0.78, height: size * 0.78, marginLeft: (-size * 0.78) / 2, marginTop: (-size * 0.78) / 2, borderRadius: size, backgroundColor: '#111111', borderWidth: 2, borderColor: '#e8f53b' }}
        />
        {ball.trail.map((g, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{ position: 'absolute', left: g.x, top: g.y, width: 8 - i * 1.5, height: 8 - i * 1.5, marginLeft: -4 + i * 0.75, marginTop: -4 + i * 0.75, borderRadius: 6, backgroundColor: '#ffffff', opacity: Animated.multiply(ball.trailOn, 0.35 - i * 0.1) }}
          />
        ))}
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
            borderRadius: 8,
            backgroundColor: '#ffffff',
            borderWidth: 1.5,
            borderColor: '#111111',
            overflow: 'hidden',
            transform: [{ rotate: ball.rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
          }}
        >
          {/* Two panels, so the spin shows. */}
          <View style={{ position: 'absolute', left: '28%', top: '8%', width: '44%', height: '34%', borderRadius: 2, backgroundColor: '#111111' }} />
          <View style={{ position: 'absolute', left: '22%', top: '64%', width: '56%', height: '22%', borderRadius: 2, backgroundColor: '#111111', opacity: 0.8 }} />
        </Animated.View>
        {confetti && <Confetti key={confetti.key} x={confetti.x} y={confetti.y} palette={confetti.palette} />}
        {callout && <CalloutView key={`${callout.text}-${callout.until}`} c={callout} home={home} away={away} />}
      </View>
      <View style={{ height: 22, justifyContent: 'center', paddingHorizontal: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: callout?.tone === 'goal' ? fonts.bold : fonts.semibold, fontSize: 13, color: callout?.tone === 'goal' ? colors.accent : colors.text }}>
          {caption}
        </Text>
      </View>
    </View>
  );
}
