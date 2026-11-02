import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { KeeperFigure } from './Keeper';
import { T } from '../kit';
import { alpha, colors, fonts } from '../theme';

type Kind = 'shot' | 'penalty' | 'freekick';
export type ShotOutcome = 'goal' | 'save' | 'miss';
// Where the shot is from. Each looks and plays differently.
export type ShotView = 'box' | 'outside' | 'oneonone';

const W = 300;
const H = 170;
const GOALS: Record<ShotView, { x: number; y: number; w: number; h: number }> = {
  box: { x: 30, y: 16, w: 240, h: 90 },
  // From distance the goal is smaller and there are bodies in the way.
  outside: { x: 70, y: 22, w: 160, h: 60 },
  // One on one: the keeper is out at you and fills more of the goal.
  oneonone: { x: 22, y: 12, w: 256, h: 96 },
};
// The power bar's bands, as shares of the bar: low up to LOW, mid up to
// MID, high up to HIGH, then too high (over the bar).
const LOW = 0.34;
const MID = 0.62;
const HIGH = 0.86;
// Half the width of goal a blocking defender covers.
const BLOCK_HALF = 0.055;
const FLIGHT = 0.6;
// Seconds for the power bar to fill. Fast: where you tap sets the power.
const RISE = 0.9;

// Two taps: the first stops the aim marker, the second the power bar. Then
// the ball flies and what you see is what counts: out of the keeper's reach
// and on target is a goal, inside his reach is a save, too wide or too much
// power misses.
// shooting and weakFoot widen or narrow how far a shot strays from the aim.
// range: 0 at the edge of the box, 1 from a long way out.
export function ShotGame({ kind, composure, shooting = 60, weakFoot = false, finesse = 0, keeper = 60, view = 'box', chip = false, range = 0, onDone }: { kind: Kind; composure: number; shooting?: number; weakFoot?: boolean; finesse?: number; keeper?: number; view?: ShotView; chip?: boolean; range?: number; onDone: (q: number, text: string, outcome: ShotOutcome, aim: number) => void }) {
  const GOAL = kind === 'shot' ? GOALS[view] : GOALS.box;
  const outside = kind === 'shot' && view === 'outside';
  const oneOnOne = kind === 'shot' && view === 'oneonone';
  // Finesse Shot pushes back where too high starts.
  const bands: Bands = { low: LOW, mid: MID, high: Math.min(0.95, HIGH + 0.03 * finesse) };
  const [phase, setPhase] = useState<'aim' | 'power' | 'flight' | 'done'>('aim');
  const [aim, setAim] = useState(0.5);
  // x is where the ball actually goes: the aim plus any stray.
  // stop: the ball never reaches the goal because a defender or the wall
  // was in the way.
  const [shot, setShot] = useState<{ power: number; outcome: ShotOutcome; text: string; q: number; diveTo: number; blockAt: number; x: number; parry: number; stop?: 'block' | 'wall' } | null>(null);
  const [setup] = useState(() => ({
    keeper: 0.32 + Math.random() * 0.36,
    dive: Math.random() < 0.5 ? -1 : 1,
    kit: ['#22c55e', '#facc15', '#a855f7', '#f97316'][Math.floor(Math.random() * 4)],
    wall: 0.15 + Math.random() * 0.4,
    offset: Math.random() * Math.PI * 2,
    blockers: [0.25 + Math.random() * 0.2, 0.55 + Math.random() * 0.2].map((x) => ({ x, speed: 0.8 + Math.random() * 0.8, phase: Math.random() * 6 })),
    // Two normal draws, used for the stray and for where a parry goes.
    stray: Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random()),
    parry: Math.random() < 0.5 ? -1 : 1,
  }));
  const t = useTicker(phase !== 'done', phase);
  const speed = 2 + (1 - composure / 99) * 2.4;
  // How far the keeper can get across, as a share of the goal's width. Out
  // at your feet in a one on one he covers more of it.
  // Open play: he comes off his line while you aim, which narrows the
  // angle. Locking the aim freezes him where he got to.
  const [rushAt, setRushAt] = useState<number | null>(null);
  const rushing = kind === 'shot' && !outside;
  const rush = rushing ? Math.min(1, (rushAt ?? (phase === 'aim' ? t : 0)) / (oneOnOne ? 1.8 : 2.8)) : 0;
  const reach = (0.15 + (keeper / 99) * 0.13) * (oneOnOne ? 1.25 : 1) * (1 + range * 0.15) * (1 + rush * 0.35);
  const flight = outside ? 0.85 : FLIGHT;
  // How much goal he covers for a shot of this power. Soft or mid-power
  // shots from distance give him time to get across; a high one does not.
  const reachAt = (p: number) => {
    if (kind === 'penalty') return reach;
    const band = p < bands.low ? 1.6 : p <= bands.mid ? 1 : 0.85;
    const time = 1 + range * (p > bands.mid ? 0.25 : 0.9);
    return reach * band * time;
  };
  // From the edge of the box one defender is in the way; from far out, two.
  const blockers = range > 0.55 ? setup.blockers : setup.blockers.slice(0, 1);

  const aimX = phase === 'aim' ? 0.5 + 0.62 * Math.sin(t * speed + setup.offset) : aim;
  // Power climbs fast once the aim is set; wait too long and he shoots at
  // full power, which flies over the bar.
  const power = phase === 'power' ? Math.min(1, t / RISE) : shot?.power ?? 0;
  // In open play a defender closes in while you pick a spot.
  const aimLimit = kind === 'shot' ? 2.2 + (composure / 99) * 1.2 : Infinity;

  const tap = () => {
    if (phase === 'aim') {
      setAim(aimX);
      setRushAt(t);
      setPhase('power');
    } else if (phase === 'power') fire(power);
  };

  const fire = (power: number) => {
    {
      // No shot goes exactly where it was aimed. Better finishers stray less;
      // the weaker foot, distance and an overhit ball stray more.
      const spread = 0.025 + (1 - (composure + shooting) / 198) * 0.09 + (weakFoot ? 0.05 : 0) + (outside ? 0.015 : 0) + range * 0.04 + (power > bands.mid ? 0.025 : power > bands.low ? -0.01 : 0);
      const x = aim + setup.stray * spread;
      const strayed = Math.abs(x - aim) > 0.06;
      // Two defenders shuffle across in front of a shot from distance.
      const blocked = outside && blockers.some((b) => Math.abs(blockerX(b, t) - x) < BLOCK_HALF);
      const lob = oneOnOne && chip && power > bands.high && power <= bands.high + 0.1;
      const r = blocked
        ? { outcome: 'miss' as ShotOutcome, text: 'Blocked by a defender!', q: 0.08, diveTo: setup.keeper }
        : lob
          ? { outcome: 'goal' as ShotOutcome, text: 'Chipped over him! Sublime.', q: 1, diveTo: setup.keeper }
          : judge(kind, x, power, setup, bands, reachAt(power));
      if (r.outcome === 'miss' && strayed && (x < 0.02 || x > 0.98)) r.text = weakFoot ? 'Sliced it with the weaker foot. Wide!' : 'It drifted wide of the post!';
      const wall = kind === 'freekick' && x >= setup.wall && x <= setup.wall + 0.3 && power < 0.75;
      setShot({ power, blockAt: t, x, parry: setup.parry, stop: blocked ? 'block' : wall ? 'wall' : undefined, ...r });
      setPhase('flight');
    }
  };

  // Out of time: tackled while aiming, or the power maxes out and he shoots.
  const timedOut = useRef(false);
  const tackled = () => {
    setShot({ power: 0.5, blockAt: t, x: aimX, parry: setup.parry, stop: 'block', outcome: 'miss', text: 'Too slow! A defender nicks it off you.', q: 0.05, diveTo: setup.keeper });
    setPhase('flight');
  };
  useEffect(() => {
    if (timedOut.current) return;
    // Deferred a tick so the state change happens outside the render pass.
    if (phase === 'aim' && t > aimLimit) {
      timedOut.current = true;
      setTimeout(tackled, 0);
    } else if (phase === 'power' && t >= RISE) {
      timedOut.current = true;
      setTimeout(() => fire(1), 0);
    }
  });

  // When the ball lands, show the result for a moment, then report it.
  const sent = useRef(false);
  useEffect(() => {
    if (phase === 'flight' && shot && t >= flight && !sent.current) {
      sent.current = true;
      setTimeout(() => onDone(shot.q, shot.text, shot.outcome, shot.x), 1200);
    }
  });

  const px = (x: number) => GOAL.x + x * GOAL.w;
  const k = phase === 'flight' && shot ? Math.min(1, t / flight) : 0;
  const landed = k >= 1;
  // After the ball arrives: a parry off the keeper, or on out of play.
  const after = phase === 'flight' && shot ? Math.min(1, Math.max(0, (t - flight) / 0.55)) : 0;
  const over = !!shot && shot.outcome === 'miss' && shot.power > bands.high;
  const wide = !!shot && shot.outcome === 'miss' && !over && (shot.x < 0.02 || shot.x > 0.98);
  // A blocked shot hits the defender's body; a wall shot hits the wall.
  const stopY = shot?.stop === 'block' ? GOAL.y + GOAL.h + 30 : shot?.stop === 'wall' ? GOAL.y + GOAL.h - 24 : null;
  const targetY = stopY ?? (over ? GOAL.y - 14 : GOAL.y + GOAL.h * (0.85 - 0.6 * Math.min(1, (shot?.power ?? 0.5) / bands.high)));
  const endX = shot ? px(shot.outcome === 'save' ? shot.diveTo : shot.x) : px(aim);
  let ballX = 150 + (endX - 150) * k;
  let ballY = H - 12 + (targetY - (H - 12)) * k - Math.sin(Math.PI * k) * 10;
  let ballR = 8 - 3.5 * k;
  if (after > 0 && shot) {
    if (shot.stop) {
      // Off the body and away: back toward you and to the side.
      ballX = endX + shot.parry * 55 * after;
      ballY = targetY + 40 * after - Math.sin(Math.PI * after) * 16;
      ballR = 5 + 2 * after;
    } else if (shot.outcome === 'save') {
      // Palmed away: back out and to the side, bouncing once.
      ballX = endX + shot.parry * 70 * after;
      ballY = targetY + (H - 30 - targetY) * after - Math.sin(Math.PI * after) * 22;
      ballR = 4.5 + 2.5 * after;
    } else if (shot.outcome === 'miss') {
      // On past the post or over the bar, into the crowd.
      ballX = endX + (wide ? (shot.x < 0.5 ? -40 : 40) : 0) * after;
      ballY = targetY - (over ? 14 : 6) * after;
      ballR = 4.5 - 1.5 * after;
    } else {
      // In the net: it drops into the back of it.
      ballY = targetY + 8 * after;
    }
  }
  // The keeper dives as the ball comes; on a save he gets to it.
  const keeperAt = shot ? setup.keeper + (shot.diveTo - setup.keeper) * Math.min(1, k * 1.4) : setup.keeper;
  const diveSide = shot ? Math.sign(shot.diveTo - setup.keeper) || setup.dive : 0;
  const diveAmount = shot ? Math.min(1, k * 1.6) * 0.9 * diveSide : 0;

  return (
    <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={phase === 'aim' ? 'Lock aim' : 'Lock power'}>
      <View style={{ alignItems: 'center' }}>
        <Svg width="100%" height={190} viewBox={`0 0 ${W} ${H}`}>
          <Rect x={0} y={0} width={W} height={H} fill={colors.pitch} />
          {Array.from({ length: 13 }, (_, i) => (
            <Line key={`v${i}`} x1={GOAL.x + (i * GOAL.w) / 12} y1={GOAL.y} x2={GOAL.x + (i * GOAL.w) / 12} y2={GOAL.y + GOAL.h} stroke="#ffffff22" strokeWidth={1} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <Line key={`h${i}`} x1={GOAL.x} y1={GOAL.y + (i * GOAL.h) / 5} x2={GOAL.x + GOAL.w} y2={GOAL.y + (i * GOAL.h) / 5} stroke="#ffffff22" strokeWidth={1} />
          ))}
          <Rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} stroke="#ffffff" strokeWidth={4} fill="none" />
          <Line x1={0} y1={GOAL.y + GOAL.h} x2={W} y2={GOAL.y + GOAL.h} stroke={colors.pitchLine} strokeWidth={2} />
          {/* The keeper's reach before you shoot, so the gap is readable. */}
          {phase !== 'flight' && <Rect x={px(Math.max(0, setup.keeper - (phase === 'power' ? reachAt(power) : reach)))} y={GOAL.y + GOAL.h - 4} width={GOAL.w * Math.min(1, (phase === 'power' ? reachAt(power) : reach) * 2)} height={4} fill="#ffffff" opacity={0.25} />}
          {outside && (
            <>
              <Rect x={0} y={GOAL.y + GOAL.h + 22} width={W} height={2} fill={colors.pitchLine} opacity={0.6} />
              {blockers.map((b, i) => (
                <G key={i}>
                  <Ellipse cx={px(blockerX(b, phase === 'flight' ? shot?.blockAt ?? 0 : t))} cy={GOAL.y + GOAL.h + 52} rx={10} ry={3} fill="#000000" opacity={0.25} />
                  <Rect x={px(blockerX(b, phase === 'flight' ? shot?.blockAt ?? 0 : t)) - 7} y={GOAL.y + GOAL.h + 20} width={14} height={32} rx={6} fill="#c8102e" />
                  <Circle cx={px(blockerX(b, phase === 'flight' ? shot?.blockAt ?? 0 : t))} cy={GOAL.y + GOAL.h + 15} r={6} fill="#d9a77c" />
                </G>
              ))}
            </>
          )}
          {kind === 'freekick' && <Rect x={px(setup.wall)} y={GOAL.y + GOAL.h - 46} width={GOAL.w * 0.3} height={46} rx={6} fill="#c8102e" opacity={0.9} />}
          <KeeperFigure x={px(keeperAt)} ground={GOAL.y + GOAL.h + (oneOnOne ? 22 : 0) + rush * 22} h={(oneOnOne ? 74 : outside ? 44 : 58) + rush * 14} dive={diveAmount} kit={setup.kit} />
          {phase !== 'flight' && (
            <>
              <Circle cx={px(aimX)} cy={GOAL.y + GOAL.h / 2} r={9} stroke="#ffffff" strokeWidth={3} fill={phase === 'aim' ? 'none' : '#ffffff'} />
              <Line x1={px(aimX)} y1={GOAL.y + 8} x2={px(aimX)} y2={GOAL.y + GOAL.h - 8} stroke="#ffffff88" strokeWidth={1} />
            </>
          )}
          {phase !== 'flight' && <Circle cx={150} cy={H - 12} r={8} fill="#ffffff" stroke="#111111" strokeWidth={1.5} />}
          {phase === 'flight' && (
            <>
              <Ellipse cx={ballX} cy={Math.min(H - 6, H - 8 + (GOAL.y + GOAL.h - (H - 8)) * k)} rx={ballR} ry={ballR * 0.4} fill="#000000" opacity={0.25} />
              <Circle cx={ballX} cy={ballY} r={ballR} fill="#ffffff" stroke="#111111" strokeWidth={1.5} />
            </>
          )}
        </Svg>
        {landed && shot && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 44, color: shot.outcome === 'goal' ? colors.accent : '#ffffff', letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 }}>
              {shot.outcome === 'goal' ? 'GOAL!' : shot.outcome === 'save' ? 'SAVED' : over ? 'OVER!' : 'MISSED'}
            </Text>
          </View>
        )}
        {/* One bar under the goal: first the time to aim, then the power. */}
        <View style={{ width: '100%', height: 30, marginTop: 8, justifyContent: 'center' }}>
          {phase === 'aim' ? (
            <View style={{ gap: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1, color: colors.muted }}>{aimLimit < Infinity ? '1. AIM  |  DEFENDER CLOSING' : '1. AIM'}</Text>
              <View style={{ height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: 'hidden' }}>
                {aimLimit < Infinity && <View style={{ width: `${Math.max(0, 1 - t / aimLimit) * 100}%`, height: 6, backgroundColor: t / aimLimit > 0.7 ? colors.red : colors.gold }} />}
              </View>
            </View>
          ) : (
            <View style={{ gap: 3 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1, color: colors.accent }}>2. POWER  |  {bandName(power, bands)}</Text>
              <View style={{ height: 18, flexDirection: 'row', borderRadius: 6, overflow: 'hidden' }}>
                {BAND_VIEW.map((b) => {
                  const from = b.from(bands);
                  const to = b.to(bands);
                  return (
                    <View key={b.label} style={{ width: `${(to - from) * 100}%`, backgroundColor: alpha(b.color, 0.28), alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: colors.bg }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.6, color: b.color }} numberOfLines={1}>
                        {b.label}
                      </Text>
                    </View>
                  );
                })}
                <View style={{ position: 'absolute', left: `${power * 100}%`, top: -2, bottom: -2, width: 4, marginLeft: -2, borderRadius: 2, backgroundColor: '#ffffff' }} />
              </View>
            </View>
          )}
        </View>
        <T bold style={{ marginTop: 10, textAlign: 'center' }}>
          {phase === 'aim'
            ? outside
              ? 'Tap to aim: past the defender, away from the keeper.'
              : oneOnOne
                ? `He is rushing out. Be quick!${chip ? ' Tap just into TOO HIGH to chip him.' : ''}`
                : 'Tap to aim. He comes off his line if you wait.'
            : phase === 'power'
              ? 'Tap to set the power!'
              : landed
                ? shot?.text
                : ' '}
        </T>
      </View>
    </Pressable>
  );
}

// A defender's position across the goal at time t.
function blockerX(b: { x: number; speed: number; phase: number }, t: number): number {
  return clamp(b.x + 0.14 * Math.sin(t * b.speed + b.phase));
}

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}

// Where the ball goes decides it. Penalties: the keeper guesses a side
// before the kick, so only a shot to where he dives is saved.
function judge(
  kind: Kind,
  x: number,
  power: number,
  setup: { keeper: number; dive: number; wall: number },
  b: Bands,
  reach: number,
): { outcome: ShotOutcome; text: string; q: number; diveTo: number } {
  const toward = (target: number) => clamp(setup.keeper + Math.max(-reach, Math.min(reach, target - setup.keeper)));
  if (x < 0.02 || x > 0.98) return { outcome: 'miss', text: 'Wide of the post!', q: 0.05, diveTo: toward(x) };
  if (power > b.high) return { outcome: 'miss', text: 'Blazed over the bar!', q: 0.05, diveTo: toward(x) };
  if (kind === 'freekick' && x >= setup.wall && x <= setup.wall + 0.3 && power < 0.75) return { outcome: 'miss', text: 'Straight into the wall.', q: 0.08, diveTo: setup.keeper };
  if (kind === 'penalty') {
    const diveTo = clamp(setup.keeper + setup.dive * 0.3);
    if (Math.abs(x - diveTo) < 0.17 || (power < b.low && Math.abs(x - setup.keeper) < 0.25)) return { outcome: 'save', text: 'He guessed right!', q: 0.35, diveTo: x };
    return { outcome: 'goal', text: power >= b.low ? 'Sent the keeper the wrong way!' : 'Rolled in. Cheeky!', q: 0.95, diveTo };
  }
  // reach already allows for the power and the distance (see reachAt).
  const weak = power < b.low;
  const gap = Math.abs(x - setup.keeper);
  if (gap <= reach) return { outcome: 'save', text: weak ? 'Too soft. Easy save.' : power <= b.mid ? 'He had time to get across. Saved!' : 'Within his reach. Parried away!', q: 0.4, diveTo: x };
  // He dives full stretch, but the glove (about a tenth of the goal wide)
  // ends short of the ball.
  const short = clamp(setup.keeper + Math.sign(x - setup.keeper) * Math.max(0, Math.min(reach, gap) - 0.1));
  return { outcome: 'goal', text: x < 0.12 || x > 0.88 ? 'Into the corner!' : 'Beat him all ends up!', q: power > b.mid ? 1 : 0.85, diveTo: short };
}

type Bands = { low: number; mid: number; high: number };

const BAND_VIEW: { label: string; color: string; from: (b: Bands) => number; to: (b: Bands) => number }[] = [
  { label: 'LOW', color: colors.blue, from: () => 0, to: (b) => b.low },
  { label: 'MID', color: colors.green, from: (b) => b.low, to: (b) => b.mid },
  { label: 'HIGH', color: colors.gold, from: (b) => b.mid, to: (b) => b.high },
  { label: 'TOO HIGH', color: colors.red, from: (b) => b.high, to: () => 1 },
];

function bandName(p: number, b: Bands): string {
  return p < b.low ? 'LOW' : p <= b.mid ? 'MID' : p <= b.high ? 'HIGH' : 'TOO HIGH';
}
