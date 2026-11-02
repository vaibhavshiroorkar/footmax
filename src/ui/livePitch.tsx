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

type Registry = Map<string, Animated.ValueXY>;

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

function Dot({ id, registry, size, fill, ring, text, textColor, glow, keeper, target, onTarget }: { id: string; registry: Registry; size: number; fill: string; ring: string; text: string; textColor: string; glow: boolean; keeper?: boolean; target?: PitchTarget; onTarget?: (id: string) => void }) {
  const v = useState(() => new Animated.ValueXY({ x: -100, y: -100 }))[0];
  useEffect(() => {
    registry.set(id, v);
    return () => {
      registry.delete(id);
    };
  }, [id, registry, v]);
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
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.48, color: textColor, lineHeight: size * 0.62 }}>{text}</Text>
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
}

// The live pitch: 22 players and a ball, moving every frame (see pitchSim).
export function LivePitch({ world, live, focusId, speed, width, running, paused, onNeedMinute, onGoal, onMomentReady, targets, onTarget }: LivePitchProps) {
  const h = (width * VH) / VW;
  const home = teamById(world, live.home.clubId);
  const away = teamById(world, live.away.clubId);
  const sim = useState(() => new PitchSim())[0];
  const registry = useState<Registry>(() => new Map())[0];
  const ball = useState(() => ({ pos: new Animated.ValueXY({ x: -50, y: -50 }), shadow: new Animated.ValueXY({ x: -50, y: -50 }), size: new Animated.Value(10) }))[0];
  const [caption, setCaption] = useState(sim.caption);
  const [callout, setCallout] = useState<Callout | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  // Latest props for the frame loop, which is set up once.
  const props = useRef({ speed, running, paused, onNeedMinute, onGoal, onMomentReady, width, h });
  useEffect(() => {
    props.current = { speed, running, paused, onNeedMinute, onGoal, onMomentReady, width, h };
  });

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

  // Each new move from the engine joins the queue.
  const playKey = live.play ? `${live.minute}-${live.events.length}-${live.play.length}` : `none-${live.minute}`;
  const asked = useRef(false);
  useEffect(() => {
    if (live.play) sim.enqueue(live.play.map((s) => ({ ...s })));
    asked.current = false;
    // A new move is the only thing that should queue one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, sim]);

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
    const toScreen = (x: number, y: number) => {
      const { width: w, h: hh } = props.current;
      return { x: ((y - VX) / VW) * w, y: ((x - VY) / VH) * hh };
    };
    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const p = props.current;
      // A key moment plays in slow motion while the user decides.
      const scale = p.paused ? 0 : sim.holding ? 0.25 : p.speed;
      sim.update(dt * scale);
      for (const [id, body] of sim.bodies) {
        const v = registry.get(id);
        if (v) v.setValue(toScreen(body.x, body.y));
      }
      const b = toScreen(sim.ball.x, sim.ball.y);
      ball.shadow.setValue(b);
      ball.pos.setValue({ x: b.x, y: b.y - sim.ball.z * 2.2 });
      ball.size.setValue(10 + sim.ball.z * 1.1);
      if (sim.caption !== lastCaption) {
        lastCaption = sim.caption;
        setCaption(sim.caption);
      }
      if (sim.callout !== lastCallout) {
        lastCallout = sim.callout;
        setCallout(sim.callout);
      }
      if (sim.ball.owner !== lastOwner) {
        lastOwner = sim.ball.owner;
        setOwner(sim.ball.owner);
      }
      // Ready for more: ask once per move.
      if (p.running && !p.paused && sim.idle() && !asked.current) {
        asked.current = true;
        p.onNeedMinute?.();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sim, registry, ball]);

  const size = Math.max(15, Math.min(21, width / 22));
  // When the shirts are too alike, the away side wears its second colour,
  // as in a real match. Each keeper wears a colour that clashes with neither.
  const awayShirt = colourGap(home.colors[0], away.colors[0]) < 140 && away.colors[1] && colourGap(home.colors[0], away.colors[1]) > colourGap(home.colors[0], away.colors[0]) ? away.colors[1] : away.colors[0];
  const homeKeeper = keeperKit([home.colors[0], awayShirt]);
  const awayKeeper = keeperKit([home.colors[0], awayShirt, homeKeeper], homeKeeper);
  const dots = (['home', 'away'] as SideKey[]).flatMap((side) => {
    const team = side === 'home' ? home : away;
    return live[side].onPitch.map((id) => {
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
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: ball.shadow.x, top: ball.shadow.y, width: 9, height: 5, marginLeft: -4.5, marginTop: -1, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.35)' }} />
        {dots}
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
          }}
        />
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
