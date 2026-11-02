import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { Club, World } from '../engine/types';
import { MatchState, SideKey } from '../engine/match';
import { teamById } from '../engine/lineup';
import { PlayStep, Spot, formationSpots, toPitch } from '../engine/play';
import { shortName } from '../engine/player';
import { alpha, colors, fonts, luminance } from './theme';
import { motionReduced } from '../state/settings';

const NATIVE = Platform.OS !== 'web';
const W = 320;
const H = 200;

// How long each step of a move takes on screen, and the pause after it.
export function playDuration(steps: PlayStep[] | undefined, stepMs: number): number {
  if (!steps?.length) return stepMs * 2;
  const last = steps[steps.length - 1].act;
  const tail = last === 'goal' ? stepMs * 5 : last === 'save' || last === 'miss' ? stepMs * 1.6 : stepMs * 0.4;
  return steps.length * stepMs + tail;
}

function Dot({ x, y, size, fill, ring, text, textColor, duration, glow }: { x: number; y: number; size: number; fill: string; ring: string; text?: string; textColor: string; duration: number; glow?: boolean }) {
  const pos = useState(() => new Animated.ValueXY({ x, y }))[0];
  useEffect(() => {
    Animated.timing(pos, { toValue: { x, y }, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
  }, [x, y, duration, pos]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: size / 2,
        backgroundColor: fill,
        borderWidth: glow ? 2.5 : 1.5,
        borderColor: ring,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: glow ? ring : '#000',
        shadowOpacity: glow ? 0.9 : 0.35,
        shadowRadius: glow ? 6 : 2,
        shadowOffset: { width: 0, height: 1 },
      }}
    >
      {text ? <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.48, color: textColor, lineHeight: size * 0.62 }}>{text}</Text> : null}
    </Animated.View>
  );
}

// A word on the pitch for the end of a move: GOAL, SAVED, WIDE.
function Callout({ text, sub, color, big }: { text: string; sub?: string; color: string; big: boolean }) {
  const pop = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (motionReduced()) pop.setValue(1);
    else Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: NATIVE }).start();
  }, [pop]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, big && { backgroundColor: alpha(color, 0.28) }]}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }], opacity: pop }}>
        <Text style={{ fontFamily: fonts.display, fontSize: big ? 64 : 30, color: '#ffffff', letterSpacing: 3, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 } }}>{text}</Text>
        {sub ? <Text style={{ fontFamily: fonts.bold, fontSize: big ? 16 : 13, color: '#ffffff', letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 }}>{sub}</Text> : null}
      </Animated.View>
    </View>
  );
}

const kitFill = (c: Club) => c.colors[0];
const kitText = (c: Club) => (luminance(c.colors[0]) > 0.55 ? '#111111' : '#ffffff');
const kitRing = (c: Club) => (c.colors[1] && c.colors[1].toLowerCase() !== c.colors[0].toLowerCase() ? c.colors[1] : luminance(c.colors[0]) > 0.55 ? '#111111' : '#ffffff');

// The live pitch. Each minute the engine hands over a move (see play.ts);
// this steps through it, moving the ball from player to player while both
// teams shift as a block around it.
export function LivePitch({ world, live, focusId, stepMs, width, onGoal }: { world: World; live: MatchState; focusId?: string; stepMs: number; width: number; onGoal?: () => void }) {
  const scale = width / W;
  const h = H * scale;
  const home = teamById(world, live.home.clubId);
  const away = teamById(world, live.away.clubId);
  const play = live.play;
  const playKey = `${live.minute}-${live.events.length}-${play?.length ?? 0}-${live.pending ? 'p' : ''}`;
  const [frame, setFrame] = useState({ key: playKey, i: 0 });
  const current = frame.key === playKey ? frame.i : 0;

  useEffect(() => {
    if (!play?.length) return;
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      setFrame({ key: playKey, i });
      if (play[i].act === 'goal') onGoal?.();
      if (i < play.length - 1) {
        i++;
        t = setTimeout(next, stepMs);
      }
    };
    next();
    return () => clearTimeout(t);
    // onGoal is a fresh function each render; the move only restarts on a new play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, play, stepMs]);

  const homeIds = live.home.onPitch.join(',');
  const awayIds = live.away.onPitch.join(',');
  const spots = useMemo(
    () => ({ home: formationSpots(world, home, live.home.onPitch), away: formationSpots(world, away, live.away.onPitch) }),
    // The ids strings stand in for the arrays, which change in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, home, away, homeIds, awayIds],
  );

  const step: PlayStep | undefined = play?.[Math.min(current, (play?.length ?? 1) - 1)];
  const ball = step ? { x: step.x, y: step.y } : live.minute === 0 ? { x: 0.5, y: 0.5 } : live.ball;
  const carrier = step?.carrier ?? null;
  // Screen: home attacks left to right. Pitch y (goal to goal) runs along the width.
  const toScreen = (p: { x: number; y: number }) => ({ left: p.y * width, top: p.x * h });

  const dots: { key: string; x: number; y: number; fill: string; ring: string; text: string; textColor: string; size: number; glow: boolean }[] = [];
  for (const side of ['home', 'away'] as SideKey[]) {
    const team = side === 'home' ? home : away;
    const ids = live[side].onPitch;
    const ballDepth = side === 'home' ? ball.y : 1 - ball.y;
    const ballLat = side === 'home' ? ball.x : 1 - ball.x;
    const inPossession = step ? step.side === side : false;
    // The block slides with the ball; the side on the ball pushes higher.
    const positions = ids.map((id) => {
      const base: Spot = spots[side][id] ?? { depth: 0.5, lat: 0.5 };
      const keeper = world.players[id]?.position === 'GK';
      // Before kick-off and at the break, each side stands in its own half.
      // In play, the side without the ball drops a few yards so the two
      // midfields do not sit on top of each other.
      const shift = keeper ? (ballDepth - 0.5) * 0.06 : (ballDepth - 0.45) * (inPossession ? 0.42 : 0.3) + (inPossession ? 0.03 : -0.06);
      const depth = !step ? (keeper ? 0.04 : 0.1 + base.depth * 0.5) : Math.max(0.02, Math.min(0.97, base.depth + shift));
      const lat = keeper ? 0.5 + (ballLat - 0.5) * 0.15 : base.lat + (ballLat - 0.5) * 0.22;
      return { id, ...toPitch(side, { depth, lat }), keeper };
    });
    // Without the ball, the nearest two close it down.
    if (!inPossession && step) {
      const chasers = positions
        .filter((p) => !p.keeper)
        .map((p) => ({ p, d: Math.hypot(p.x - ball.x, p.y - ball.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      chasers.forEach(({ p }, k) => {
        const pull = k === 0 ? 0.6 : 0.3;
        p.x += (ball.x - p.x) * pull;
        p.y += (ball.y - p.y) * pull;
      });
    }
    for (const p of positions) {
      const me = p.id === focusId;
      const has = p.id === carrier;
      const pos = has ? { x: ball.x, y: ball.y + (side === 'home' ? -0.02 : 0.02) } : p;
      const s = toScreen(pos);
      dots.push({
        key: p.id,
        x: s.left,
        y: s.top,
        fill: kitFill(team),
        ring: me ? colors.gold : has ? '#ffffff' : kitRing(team),
        text: String(live.numbers?.[p.id] ?? ''),
        textColor: kitText(team),
        size: (me ? 22 : 19) * Math.min(1.25, Math.max(0.85, scale)),
        glow: me || has,
      });
    }
  }

  const ballScreen = toScreen(ball);
  const act = step?.act;
  const quick = act === 'goal' || act === 'save' || act === 'miss';
  const ballMs = quick ? stepMs * 0.45 : stepMs * 0.8;
  const atEnd = !!play && current >= play.length - 1;
  const shooterStep = play && play.length > 1 ? play[play.length - 2] : undefined;
  const name = (id: string | null | undefined) => (id ? `#${live.numbers?.[id] ?? ''} ${shortName(world.players[id])}` : '');
  const scoringTeam = step?.side === 'home' ? home : away;

  let caption = live.minute === 0 ? 'Teams are out. Waiting for kick off.' : '';
  if (step) {
    const prev = play && current > 0 ? play[current - 1] : undefined;
    if (act === 'pass' && prev?.carrier) caption = `${name(prev.carrier)}  ->  ${name(carrier)}`;
    else if (act === 'win') caption = `${name(carrier)} wins the ball`;
    else if (act === 'goal') caption = `GOAL! ${name(shooterStep?.carrier)}`;
    else if (act === 'save') caption = `${name(shooterStep?.carrier)} shoots... saved by ${name(carrier)}`;
    else if (act === 'miss') caption = `${name(shooterStep?.carrier)} shoots wide`;
    else caption = `${name(carrier)} on the ball`;
    if (live.pending && atEnd) caption = live.pending.attackerId ? `${name(live.pending.attackerId)} is through on goal!` : `${name(live.pending.actorId)}: your moment!`;
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={{ width, height: h, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <Svg width={width} height={h} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
          {Array.from({ length: 8 }, (_, i) => (
            <Rect key={i} x={i * 40} y={0} width={40} height={H} fill={i % 2 ? colors.pitch : colors.pitchDark} />
          ))}
          <Rect x={6} y={6} width={W - 12} height={H - 12} stroke="#fff" strokeOpacity={0.45} strokeWidth={1.5} fill="none" />
          <Line x1={W / 2} y1={6} x2={W / 2} y2={H - 6} stroke="#fff" strokeOpacity={0.45} strokeWidth={1.5} />
          <Circle cx={W / 2} cy={H / 2} r={24} stroke="#fff" strokeOpacity={0.45} strokeWidth={1.5} fill="none" />
          <Circle cx={W / 2} cy={H / 2} r={2} fill="#fff" fillOpacity={0.6} />
          <Rect x={6} y={50} width={44} height={100} stroke="#fff" strokeOpacity={0.45} strokeWidth={1.5} fill="none" />
          <Rect x={6} y={78} width={16} height={44} stroke="#fff" strokeOpacity={0.45} strokeWidth={1.5} fill="none" />
          <Rect x={W - 50} y={50} width={44} height={100} stroke="#fff" strokeOpacity={0.45} strokeWidth={1.5} fill="none" />
          <Rect x={W - 22} y={78} width={16} height={44} stroke="#fff" strokeOpacity={0.45} strokeWidth={1.5} fill="none" />
          <Rect x={0} y={86} width={6} height={28} fill="#fff" fillOpacity={act === 'goal' && step?.side === 'away' ? 0.95 : 0.5} />
          <Rect x={W - 6} y={86} width={6} height={28} fill="#fff" fillOpacity={act === 'goal' && step?.side === 'home' ? 0.95 : 0.5} />
        </Svg>
        {dots.map((d) => (
          <Dot key={d.key} x={d.x} y={d.y} size={d.size} fill={d.fill} ring={d.ring} text={d.text} textColor={d.textColor} duration={stepMs * 0.9} glow={d.glow} />
        ))}
        <Dot x={ballScreen.left} y={ballScreen.top} size={11} fill="#ffffff" ring="#111111" textColor="#000" duration={ballMs} />
        {act === 'goal' && <Callout key={playKey} text="GOAL!" sub={name(shooterStep?.carrier)} color={scoringTeam.colors[0]} big />}
        {act === 'save' && <Callout key={playKey} text="SAVED" color={colors.blue} big={false} />}
        {act === 'miss' && <Callout key={playKey} text="WIDE" color={colors.muted} big={false} />}
      </View>
      <View style={{ height: 22, justifyContent: 'center', paddingHorizontal: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: act === 'goal' ? fonts.bold : fonts.semibold, fontSize: 13, color: act === 'goal' ? colors.accent : colors.text }}>
          {caption}
        </Text>
      </View>
    </View>
  );
}
