import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { T } from '../kit';
import { alpha, colors } from '../theme';
import { PassOutcome } from '../../engine/match';
import { passWeight } from '../../engine/contact';
import { Football } from '../football';
import { Person } from '../rig/Figure';
import { run as runPose } from '../rig/poses';

// Scenes for the big passes, top-down with the attack going up the screen.
// Both teams wear this match's kits. Each scene reports a quality from 0 to 1 and what happened, and the pitch then shows exactly
// that (see resolveMoment's passed).

const W = 300;
const H = 180;
const FLIGHT = 0.55;
// Seconds of holding for a full bar.
const HOLD = 0.9;
// The weight matters, but less than the timing: a plain tap still gets there.
const weightOf = (charge: number) => 0.7 + 0.3 * passWeight(charge, 0.5);

// How hard you are hitting it. The middle of the bar is the right weight.
function HoldBar({ charge }: { charge: number }) {
  return (
    <View style={{ height: 8, marginTop: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.bg }}>
      <View style={{ position: 'absolute', left: '40%', width: '20%', top: 0, bottom: 0, backgroundColor: alpha(colors.accent, 0.5) }} />
      <View style={{ position: 'absolute', left: `${charge * 100}%`, top: 0, bottom: 0, width: 4, marginLeft: -2, backgroundColor: '#ffffff' }} />
    </View>
  );
}

type Done = (q: number, outcome: PassOutcome, text: string) => void;

function useFinish(onDone: Done) {
  const [done, setDone] = useState<{ q: number; outcome: PassOutcome; text: string; at: number } | null>(null);
  const sent = useRef(false);
  const finish = (q: number, outcome: PassOutcome, text: string, at: number) => {
    if (sent.current) return;
    sent.current = true;
    setDone({ q, outcome, text, at });
    setTimeout(() => onDone(q, outcome, text), 1300);
  };
  return { done, finish };
}

function Turf({ children }: { children: React.ReactNode }) {
  return (
    <Svg width="100%" height={190} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={0} y={0} width={W} height={H} fill={colors.pitch} />
      {children}
    </Svg>
  );
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.max(0, Math.min(1, k));

// Through ball: the runner bursts at the defensive line, which may step up.
// Release it just before he crosses the line. Too late and he is offside;
// too early and a defender reads it. Better passers get a wider window.
// window: extra share of window from abilities (0 for none).
export function ThroughBallScene({ passing, vision, window = 0, onDone }: { passing: number; vision: number; window?: number; onDone: Done }) {
  const [setup] = useState(() => ({
    rx: 95 + Math.random() * 110,
    burst: 0.35 + Math.random() * 0.5,
    speed: 38 + Math.random() * 14,
    stepAt: Math.random() < 0.55 ? 0.5 + Math.random() * 0.9 : Infinity,
    defs: [70, 150, 230].map((x) => x + (Math.random() - 0.5) * 24),
  }));
  const t = useTicker(true);
  const { done, finish } = useFinish(onDone);
  // How close to the line (in px) a release still beats the defender.
  const gapOk = (6 + ((passing + vision) / 198) * 26) * (1 + window);
  const lineY = (tt: number) => 74 + (tt > setup.stepAt ? lerp(0, 12, (tt - setup.stepAt) / 0.3) : 0);
  const runnerY = (tt: number) => (tt < setup.burst ? 108 + Math.sin(tt * 8) * 1.5 : 108 - setup.speed * (tt - setup.burst));
  const runnerX = (tt: number) => setup.rx + Math.sin(tt * 2) * 6;

  const [heldAt, setHeldAt] = useState<number | null>(null);
  const charge = heldAt === null || done ? 0 : Math.min(1, (t - heldAt) / HOLD);
  const release = () => {
    if (done) return;
    const weight = weightOf(charge);
    const gap = runnerY(t) - lineY(t);
    if (gap < -2) return finish(0.05, 'offside', 'Flag up. You held it too long.', t);
    if (gap > gapOk) return finish(0.1, 'cut', 'Too early. The defender reads it.', t);
    const q = Math.max(0.4, 1 - (Math.max(0, gap) / gapOk) * 0.6) * weight;
    // Never a sure thing: even a good ball can meet an outstretched leg.
    if (Math.random() > Math.min(0.92, 0.55 + 0.3 * q + (passing - 60) / 200)) return finish(0.2, 'cut', 'Good ball, but a defender stretches and gets a toe to it.', t);
    finish(q, 'ok', q > 0.8 ? 'Perfect. Right into his stride!' : 'Through! He is in.', t);
  };
  // Waited far too long: he is miles offside.
  useEffect(() => {
    if (!done && runnerY(t) - lineY(t) < -26) finish(0.05, 'offside', 'Flag up. You held it too long.', t);
  });

  const at = done ? done.at : t;
  const since = done ? t - done.at : 0;
  const k = done ? Math.min(1, since / FLIGHT) : 0;
  // After the release the run goes on; on a cut-out the nearest man steps in.
  const rt = done && done.outcome !== 'ok' ? at : t;
  const rx = runnerX(rt);
  const ry = runnerY(rt);
  const ly = lineY(t);
  const near = setup.defs.reduce((a, b) => (Math.abs(b - rx) < Math.abs(a - rx) ? b : a));
  const target = done?.outcome === 'cut' ? { x: near, y: ly + 4 } : { x: runnerX(at + FLIGHT), y: runnerY(at + FLIGHT) - 8 };
  const ballX = done ? lerp(150, target.x, k) : 150;
  const ballY = done ? lerp(166, target.y, k) : 166;

  return (
    <Pressable onPressIn={() => setHeldAt(t)} onPressOut={release} accessibilityRole="button" accessibilityLabel="Hold, then release the through ball">
      <Turf>
        <Rect x={90} y={0} width={120} height={14} fill="none" stroke={colors.pitchLine} strokeWidth={2} />
        <Line x1={0} y1={ly} x2={W} y2={ly} stroke="#ffffff" strokeWidth={1.5} strokeDasharray="5 5" opacity={0.6} />
        {setup.defs.map((x, i) => (
          <Person key={i} side="opp" x={done?.outcome === 'cut' && x === near ? lerp(x, target.x, k) : x} y={ly + 3} />
        ))}
        {/* His run: an arrow ahead of him. */}
        {!done && <Path d={`M ${rx} ${ry - 10} L ${rx} ${ry - 34}`} stroke={colors.accent} strokeWidth={2} strokeDasharray="3 4" opacity={0.7} />}
        <Person side="own" x={rx} y={ry} pose={runPose(t * 11)} />
        <Person side="own" me x={150} y={158} />
        <Football cx={ballX} cy={ballY} r={6.5} rot={(ballX + ballY) * 9} />
        {done?.outcome === 'offside' && <Rect x={W - 26} y={ly - 22} width={14} height={10} fill="#facc15" />}
      </Turf>
      <HoldBar charge={charge} />
      <T bold style={{ textAlign: 'center', marginTop: 8 }}>
        {done ? done.text : 'Hold to weigh it. Release just before he crosses the line.'}
      </T>
    </Pressable>
  );
}

// Cross: the striker attacks the near or the far post, and may switch late.
// A marker sweeps across the box; tap to whip it in. The ball takes a
// moment to land, so aim where he will be, not where he is.
// window: extra share of reach from abilities (0 for none).
export function CrossScene({ crossing, window = 0, onDone }: { crossing: number; window?: number; onDone: Done }) {
  const [setup] = useState(() => {
    const left = Math.random() < 0.5;
    const nearX = left ? 128 : 172;
    const farX = left ? 182 : 118;
    const first = Math.random() < 0.5 ? nearX : farX;
    const switches = Math.random() < 0.45;
    return { left, first, final: switches ? (first === nearX ? farX : nearX) : first, switchAt: 0.7 + Math.random() * 0.5, offset: Math.random() * 6 };
  });
  const t = useTicker(true);
  const { done, finish } = useFinish(onDone);
  const FLY = 0.65;
  const reach = (8 + (crossing / 99) * 16) * (1 + window);
  const goalY = 44;
  const striker = (tt: number) => {
    const aimX = tt < setup.switchAt ? setup.first : setup.final;
    const fromX = tt < setup.switchAt ? 150 : lerp(150, setup.first, setup.switchAt / 1.6);
    const k = tt < setup.switchAt ? tt / 1.6 : setup.switchAt / 1.6 + (tt - setup.switchAt) / 1.1;
    return { x: lerp(fromX, aimX, k), y: lerp(118, goalY, k) };
  };
  // The marker follows him half a step behind.
  const marker = (tt: number) => {
    const s = striker(Math.max(0, tt - 0.25));
    return { x: s.x + (setup.left ? 8 : -8), y: s.y + 6 };
  };
  const sweep = (tt: number) => 150 + 62 * Math.sin(tt * 2.3 + setup.offset);
  const from = { x: setup.left ? 14 : W - 14, y: 112 };

  const [heldAt, setHeldAt] = useState<number | null>(null);
  const charge = heldAt === null || done ? 0 : Math.min(1, (t - heldAt) / HOLD);
  const cross = (auto = false) => {
    if (done) return;
    const weight = weightOf(charge);
    const spot = { x: sweep(t), y: goalY + 4 };
    const s = striker(t + FLY);
    const d = marker(t + FLY);
    const ds = Math.hypot(s.x - spot.x, s.y - spot.y);
    const dd = Math.hypot(d.x - spot.x, d.y - spot.y);
    if (ds <= reach && ds <= dd + 4) {
      const q = Math.max(0.4, 1 - (ds / reach) * 0.6) * weight;
      if (Math.random() > Math.min(0.9, 0.5 + 0.3 * q + (crossing - 60) / 200)) return finish(0.15, 'cut', 'Good cross, but the defender gets a head to it first.', t);
      return finish(q, 'ok', q > 0.8 ? 'On a plate. He meets it!' : 'He gets on the end of it!', t);
    }
    if (dd <= reach) return finish(0.1, 'cut', 'The defender heads it clear.', t);
    finish(0.08, 'cut', auto ? 'Too slow. It is blocked.' : 'Nobody there. It drifts through.', t);
  };
  useEffect(() => {
    if (!done && t > 3) cross(true);
  });

  const at = done ? done.at : t;
  const k = done ? Math.min(1, (t - at) / FLY) : 0;
  const spot = { x: done ? sweep(at) : sweep(t), y: goalY + 4 };
  const s = striker(Math.min(t, 2.6));
  const d = marker(Math.min(t, 2.6));
  const ballX = done ? lerp(from.x, spot.x, k) : from.x;
  const ballY = done ? lerp(from.y, spot.y, k) - Math.sin(Math.PI * k) * 26 : from.y;

  return (
    <Pressable onPressIn={() => setHeldAt(t)} onPressOut={() => cross()} accessibilityRole="button" accessibilityLabel="Hold, then release the cross">
      <Turf>
        {/* The box, the six-yard box and the goal, at the top. */}
        <Rect x={60} y={6} width={180} height={110} fill="none" stroke={colors.pitchLine} strokeWidth={2} />
        <Rect x={110} y={6} width={80} height={38} fill="none" stroke={colors.pitchLine} strokeWidth={2} />
        <Rect x={130} y={0} width={40} height={6} fill="#ffffff" opacity={0.85} />
        {!done && <Circle cx={spot.x} cy={spot.y} r={reach * 0.55} fill="none" stroke="#ffffff" strokeWidth={2} strokeDasharray="4 3" />}
        {done && <Circle cx={spot.x} cy={spot.y} r={5} fill="none" stroke="#ffffff" strokeWidth={1.5} opacity={0.6} />}
        <Person side="opp" x={d.x} y={d.y} pose={runPose(t * 10)} />
        <Person side="own" x={s.x} y={s.y} pose={runPose(t * 11)} />
        <Person side="own" me x={from.x} y={from.y + 6} />
        <Football cx={ballX} cy={ballY} r={6.5} rot={(ballX + ballY) * 9} />
      </Turf>
      <View style={{ marginTop: 8 }}>
        <HoldBar charge={charge} />
        <T bold style={{ textAlign: 'center' }}>
          {done ? done.text : 'Hold to weigh it, release where he is running. Watch for a late switch.'}
        </T>
      </View>
    </Pressable>
  );
}
