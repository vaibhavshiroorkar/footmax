import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { T } from '../kit';
import { colors } from '../theme';
import { PassOutcome } from '../../engine/match';

// Scenes for the big passes, top-down with the attack going up the screen.
// The user's team is in lime, the defenders in red. Each scene reports a
// quality from 0 to 1 and what happened, and the pitch then shows exactly
// that (see resolveMoment's passed).

const W = 300;
const H = 180;
const RED = '#d94b4b';
const FLIGHT = 0.55;

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
  const gapOk = (14 + ((passing + vision) / 198) * 14) * (1 + window);
  const lineY = (tt: number) => 74 + (tt > setup.stepAt ? lerp(0, 12, (tt - setup.stepAt) / 0.3) : 0);
  const runnerY = (tt: number) => (tt < setup.burst ? 108 + Math.sin(tt * 8) * 1.5 : 108 - setup.speed * (tt - setup.burst));
  const runnerX = (tt: number) => setup.rx + Math.sin(tt * 2) * 6;

  const release = () => {
    if (done) return;
    const gap = runnerY(t) - lineY(t);
    if (gap < -2) return finish(0.05, 'offside', 'Flag up. You held it too long.', t);
    if (gap > gapOk) return finish(0.1, 'cut', 'Too early. The defender reads it.', t);
    const q = Math.max(0.4, 1 - (Math.max(0, gap) / gapOk) * 0.6);
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
    <Pressable onPress={release} accessibilityRole="button" accessibilityLabel="Play the through ball">
      <Turf>
        <Rect x={90} y={0} width={120} height={14} fill="none" stroke={colors.pitchLine} strokeWidth={2} />
        <Line x1={0} y1={ly} x2={W} y2={ly} stroke="#ffffff" strokeWidth={1.5} strokeDasharray="5 5" opacity={0.6} />
        {setup.defs.map((x, i) => (
          <Circle key={i} cx={done?.outcome === 'cut' && x === near ? lerp(x, target.x, k) : x} cy={ly + 3} r={7} fill={RED} />
        ))}
        {/* His run: an arrow ahead of him. */}
        {!done && <Path d={`M ${rx} ${ry - 10} L ${rx} ${ry - 34}`} stroke={colors.accent} strokeWidth={2} strokeDasharray="3 4" opacity={0.7} />}
        <Circle cx={rx} cy={ry} r={7.5} fill={colors.accent} stroke="#111111" strokeWidth={1.5} />
        <Circle cx={150} cy={170} r={7.5} fill={colors.accent} stroke="#111111" strokeWidth={1.5} opacity={0.85} />
        <Circle cx={ballX} cy={ballY} r={4.5} fill="#ffffff" stroke="#111111" strokeWidth={1.2} />
        {done?.outcome === 'offside' && <Rect x={W - 26} y={ly - 22} width={14} height={10} fill="#facc15" />}
      </Turf>
      <T bold style={{ textAlign: 'center', marginTop: 8 }}>
        {done ? done.text : 'Tap to release it just before he crosses the line.'}
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
  const reach = (13 + (crossing / 99) * 7) * (1 + window);
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

  const cross = (auto = false) => {
    if (done) return;
    const spot = { x: sweep(t), y: goalY + 4 };
    const s = striker(t + FLY);
    const d = marker(t + FLY);
    const ds = Math.hypot(s.x - spot.x, s.y - spot.y);
    const dd = Math.hypot(d.x - spot.x, d.y - spot.y);
    if (ds <= reach && ds <= dd + 4) {
      const q = Math.max(0.4, 1 - (ds / reach) * 0.6);
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
    <Pressable onPress={() => cross()} accessibilityRole="button" accessibilityLabel="Whip in the cross">
      <Turf>
        {/* The box, the six-yard box and the goal, at the top. */}
        <Rect x={60} y={6} width={180} height={110} fill="none" stroke={colors.pitchLine} strokeWidth={2} />
        <Rect x={110} y={6} width={80} height={38} fill="none" stroke={colors.pitchLine} strokeWidth={2} />
        <Rect x={130} y={0} width={40} height={6} fill="#ffffff" opacity={0.85} />
        {!done && <Circle cx={spot.x} cy={spot.y} r={reach * 0.55} fill="none" stroke="#ffffff" strokeWidth={2} strokeDasharray="4 3" />}
        {done && <Circle cx={spot.x} cy={spot.y} r={5} fill="none" stroke="#ffffff" strokeWidth={1.5} opacity={0.6} />}
        <Circle cx={d.x} cy={d.y} r={7.5} fill={RED} />
        <Circle cx={s.x} cy={s.y} r={7.5} fill={colors.accent} stroke="#111111" strokeWidth={1.5} />
        <Circle cx={from.x} cy={from.y + 10} r={7.5} fill={colors.accent} stroke="#111111" strokeWidth={1.5} opacity={0.85} />
        <Circle cx={ballX} cy={ballY} r={4.5} fill="#ffffff" stroke="#111111" strokeWidth={1.2} />
      </Turf>
      <View style={{ marginTop: 8 }}>
        <T bold style={{ textAlign: 'center' }}>
          {done ? done.text : 'Tap to whip it in where he is running. Watch for a late switch.'}
        </T>
      </View>
    </Pressable>
  );
}
