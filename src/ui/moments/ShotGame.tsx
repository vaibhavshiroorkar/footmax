import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { KeeperFigure, OutfieldFigure } from './Keeper';
import { ShotShape } from '../../engine/match';
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
const MID = 0.64;
const HIGH = 0.85;
// Half the width of goal a blocking defender covers, when the pitch does
// not say (see Lane).
const BLOCK_HALF = 0.055;
const FLIGHT = 0.6;
// The power bar speeds up as it fills (power = time share ^ EASE), so it
// crawls through LOW and whips through HIGH. Hitting HIGH takes a sharp tap.
const EASE = 1.5;

// Two taps: the first stops the aim marker, the second the power bar. Then
// the ball flies and what you see is what counts: out of the keeper's reach
// and on target is a goal, inside his reach is a save, too wide or too much
// power misses.
// shooting and weakFoot widen or narrow how far a shot strays from the aim.
// range: 0 at the edge of the box, 1 from a long way out.
// defenders: the men in the way on the live pitch (PitchSim.laneDefenders).
// A shot into one is blocked, and onDone names him so the pitch shows it.
// Every player can pick how to strike it (see SHAPES): driven, curled or low.
// angle: where he stands across the goal (-1 out to his left, 1 to his
// right, see PitchSim.shotAngle); the ball starts from there.
// onPass: give it to a team-mate instead, before the aim is set.
export function ShotGame({ kind, composure, shooting = 60, weakFoot = false, finesse = 0, keeper = 60, view = 'box', chip = false, range = 0, defenders, angle = 0, onPass, onDone }: { kind: Kind; composure: number; shooting?: number; weakFoot?: boolean; finesse?: number; keeper?: number; view?: ShotView; chip?: boolean; range?: number; defenders?: Lane[]; angle?: number; onPass?: () => void; onDone: (q: number, text: string, outcome: ShotOutcome, played: { aim: number; blocker?: string; shape: ShotShape; over?: boolean; wall?: boolean }) => void }) {
  const GOAL = kind === 'shot' ? GOALS[view] : GOALS.box;
  const outside = kind === 'shot' && view === 'outside';
  const oneOnOne = kind === 'shot' && view === 'oneonone';
  // Finesse Shot pushes back where too high starts.
  const bands: Bands = { low: LOW, mid: MID, high: Math.min(0.95, HIGH + 0.03 * finesse) };
  const [phase, setPhase] = useState<'aim' | 'power' | 'flight' | 'done'>('aim');
  const [aim, setAim] = useState(0.5);
  const [shape, setShape] = useState<ShotShape>('driven');
  const shapes = kind === 'penalty' ? [] : SHAPES;
  // x is where the ball actually goes: the aim plus any stray.
  // stop: the ball never reaches the goal because a defender or the wall
  // was in the way.
  const [shot, setShot] = useState<{ power: number; outcome: ShotOutcome; text: string; q: number; diveTo: number; blockAt: number; x: number; parry: number; stop?: 'block' | 'wall'; blocker?: number } | null>(null);
  const [setup] = useState(() => ({
    keeper: 0.32 + Math.random() * 0.36,
    dive: Math.random() < 0.5 ? -1 : 1,
    kit: ['#22c55e', '#facc15', '#a855f7', '#f97316'][Math.floor(Math.random() * 4)],
    wall: 0.15 + Math.random() * 0.4,
    offset: Math.random() * Math.PI * 2,
    blockers: [0.25 + Math.random() * 0.2, 0.55 + Math.random() * 0.2].map((x) => ({ x, speed: 0.8 + Math.random() * 0.8, phase: Math.random() * 6 })),
    jitter: [0, 1, 2].map(() => ({ speed: 0.9 + Math.random() * 0.8, phase: Math.random() * 6 })),
    // Two normal draws, used for the stray and for where a parry goes.
    stray: Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random()),
    parry: Math.random() < 0.5 ? -1 : 1,
    // How this ball flies: bend on a curler, swerve on a driven shot, and
    // its arc. Random each time, so no two shots look the same.
    bend: 40 + Math.random() * 38,
    swerve: (Math.random() - 0.5) * 26,
    arc: 0.7 + Math.random() * 0.7,
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
  // A curler into the corner bends away from him, but it is slower, so a
  // curler at him gives him time. A low shot is hard to get down to.
  const reachAt = (p: number, x = aim) => {
    if (kind === 'penalty') return reach;
    const band = p < bands.low ? 1.6 : p <= bands.mid ? 1 : shape === 'curl' ? 0.95 : 0.85;
    const time = 1 + range * (p > bands.mid ? 0.25 : 0.9);
    const struck = shape === 'curl' ? (Math.abs(x - 0.5) > 0.28 ? 0.88 : 1.08) : shape === 'low' ? 0.9 : 1;
    return reach * band * time * struck;
  };
  // The men in the way. From the live pitch when it says, shuffling a little
  // as they close you down. Without it, from distance: one defender from the
  // edge of the box, two from far out.
  const blockers: Blocker[] =
    kind !== 'shot' || oneOnOne
      ? []
      : defenders
        ? defenders.map((d, i) => ({ ...d, ...setup.jitter[i % 3], amp: 0.025 }))
        : outside
          ? (range > 0.55 ? setup.blockers : setup.blockers.slice(0, 1)).map((b) => ({ ...b, half: BLOCK_HALF, near: 0.4, amp: 0.14 }))
          : [];

  const aimX = phase === 'aim' ? 0.5 + 0.62 * Math.sin(t * speed + setup.offset) : aim;
  // Power climbs fast once the aim is set; wait too long and he shoots at
  // full power, which flies over the bar.
  // Seconds for the bar to fill: a good finisher gets a touch more time.
  const RISE = 0.78 + (shooting / 99) * 0.2;
  const power = phase === 'power' ? Math.min(1, t / RISE) ** EASE : shot?.power ?? 0;
  // In open play a defender closes in while you pick a spot.
  const aimLimit = kind === 'shot' ? 2.2 + (composure / 99) * 1.2 : Infinity;

  const tap = () => {
    if (phase === 'aim') {
      setAim(aimX);
      setRushAt(t);
      setPhase('power');
    } else if (phase === 'power') fire(power);
  };

  const fire = (struck: number) => {
    let power = struck;
    {
      // No shot goes exactly where it was aimed. Better finishers stray less;
      // the weaker foot, distance and an overhit ball stray more.
      // A low shot cannot go over: struck too hard it drags wide instead.
      const dragged = shape === 'low' && power > bands.high;
      const spread = 0.025 + (1 - (composure + shooting) / 198) * 0.09 + (weakFoot ? 0.05 : 0) + (outside ? 0.015 : 0) + range * 0.04 + (power > bands.mid ? 0.025 : power > bands.low ? -0.01 : 0) + (shape === 'curl' ? 0.012 : 0) + (dragged ? 0.08 : 0);
      const x = aim + setup.stray * spread;
      const strayed = Math.abs(x - aim) > 0.06;
      if (dragged) power = bands.high;
      // Into a defender's body: blocked. A curler passes him wide of where it
      // ends up, so it can bend round him; a low one is easier to block.
      const hit = blockers.findIndex((b) => Math.abs(blockerX(b, t) - (shape === 'curl' ? x + curlSide(x) * 0.14 * b.near : x)) < b.half * (shape === 'low' ? 1.3 : 1));
      const blocked = hit >= 0;
      const lob = oneOnOne && chip && power > bands.high && power <= bands.high + 0.1;
      const r = blocked
        ? { outcome: 'miss' as ShotOutcome, text: 'Blocked by a defender!', q: 0.08, diveTo: setup.keeper }
        : lob
          ? { outcome: 'goal' as ShotOutcome, text: 'Chipped over him! Sublime.', q: 1, diveTo: setup.keeper }
          : judge(kind, x, power, setup, bands, reachAt(power, x), wallSpan(shape, power));
      if (r.outcome === 'miss' && strayed && (x < 0.02 || x > 0.98)) r.text = weakFoot ? 'Sliced it with the weaker foot. Wide!' : 'It drifted wide of the post!';
      const span = wallSpan(shape, power);
      const wall = kind === 'freekick' && !!span && x >= setup.wall + span[0] && x <= setup.wall + span[1];
      setShot({ power, blockAt: t, x, parry: setup.parry, stop: blocked ? 'block' : wall ? 'wall' : undefined, blocker: blocked ? hit : undefined, ...r });
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
      setTimeout(() => onDone(shot.q, shot.text, shot.outcome, { aim: shot.x, blocker: shot.blocker !== undefined ? blockers[shot.blocker]?.id : undefined, shape, over: shot.outcome === 'miss' && !shot.stop && shot.power > bands.high, wall: shot.stop === 'wall' }), 1200);
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
  const hitMan = shot?.blocker !== undefined ? blockers[shot.blocker] : undefined;
  const stopY = shot?.stop === 'block' ? (hitMan ? manAt(hitMan, GOAL).ground - manAt(hitMan, GOAL).h * 0.6 : GOAL.y + GOAL.h + 30) : shot?.stop === 'wall' ? GOAL.y + GOAL.h - 24 : null;
  const low = shape === 'low';
  const targetY = stopY ?? (over ? GOAL.y - 14 : low ? GOAL.y + GOAL.h * 0.86 : GOAL.y + GOAL.h * (0.85 - 0.6 * Math.min(1, (shot?.power ?? 0.5) / bands.high)));
  const endX = shot ? px(shot.outcome === 'save' ? shot.diveTo : shot.x) : px(aim);
  // Where the ball is at kk (0 at the boot, 1 at the goal). A curler starts
  // out wide and bends back in; a driven shot rises a little; a low one
  // skims the grass.
  const fromX = 150 + angle * 105;
  const pathAt = (kk: number) => {
    const bendX = !shot ? 0 : shape === 'curl' ? curlSide(shot.x) * setup.bend : shape === 'low' ? setup.swerve * 0.3 : setup.swerve;
    const x = (1 - kk) * (1 - kk) * fromX + 2 * (1 - kk) * kk * ((fromX + endX) / 2 + bendX) + kk * kk * endX;
    const y = H - 12 + (targetY - (H - 12)) * (low ? 1 - (1 - kk) * (1 - kk) : kk) - Math.sin(Math.PI * kk) * (low ? 2 : shape === 'curl' ? 14 : 9) * setup.arc;
    return { x, y, r: 8 - 3.5 * kk };
  };
  const at0 = pathAt(k);
  let ballX = at0.x;
  let ballY = at0.y;
  let ballR = at0.r;
  // Spin: the seam turns as it flies, faster on a curler.
  const spin = (t * (shape === 'curl' ? 1500 : 900)) % 360;
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
    <View>
      {shapes.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, alignSelf: 'stretch' }}>
          {shapes.map((sh) => {
            const on = shape === sh.id;
            const locked = phase === 'flight' || phase === 'done';
            return (
              <Pressable
                key={sh.id}
                disabled={locked}
                onPress={() => setShape(sh.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${sh.label} shot`}
                style={{ flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? alpha(colors.accent, 0.16) : colors.bgElev, opacity: locked && !on ? 0.4 : 1 }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: on ? colors.accent : colors.muted }}>{sh.label.toUpperCase()}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 9.5, color: colors.faint }} numberOfLines={1}>
                  {sh.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {onPass && kind === 'shot' && phase === 'aim' && (
        <Pressable
          onPress={onPass}
          accessibilityRole="button"
          accessibilityLabel="Pass instead"
          style={({ pressed }) => ({ height: 32, marginBottom: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.blue, backgroundColor: pressed ? alpha(colors.blue, 0.2) : alpha(colors.blue, 0.08) })}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.8, color: colors.blue }}>PASS INSTEAD</Text>
        </Pressable>
      )}
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
            {outside && <Rect x={0} y={GOAL.y + GOAL.h + 22} width={W} height={2} fill={colors.pitchLine} opacity={0.6} />}
            {[...blockers].sort((a, b) => a.near - b.near).map((b, i) => {
              const m = manAt(b, GOAL);
              const cx = px(blockerX(b, phase === 'flight' ? shot?.blockAt ?? 0 : t));
              return (
                <OutfieldFigure key={b.id ?? i} x={cx} ground={m.ground} h={m.h} span={m.w} />
              );
            })}
            {kind === 'freekick' &&
              [0, 1, 2, 3].map((i) => (
                <OutfieldFigure key={i} x={px(setup.wall + 0.0375 + i * 0.075)} ground={GOAL.y + GOAL.h + 2} h={50} span={GOAL.w * 0.075} jump={phase === 'flight' ? Math.sin(Math.min(1, k * 1.5) * Math.PI) : 0} />
              ))}
            <KeeperFigure x={px(keeperAt)} ground={GOAL.y + GOAL.h + (oneOnOne ? 22 : 0) + rush * 22} h={(oneOnOne ? 74 : outside ? 44 : 58) + rush * 14} dive={diveAmount} kit={setup.kit} />
            {phase !== 'flight' && (
              <>
                <Circle cx={px(aimX)} cy={GOAL.y + GOAL.h / 2} r={9} stroke="#ffffff" strokeWidth={3} fill={phase === 'aim' ? 'none' : '#ffffff'} />
                <Line x1={px(aimX)} y1={GOAL.y + 8} x2={px(aimX)} y2={GOAL.y + GOAL.h - 8} stroke="#ffffff88" strokeWidth={1} />
              </>
            )}
            {phase !== 'flight' && <Circle cx={fromX} cy={H - 12} r={8} fill="#ffffff" stroke="#111111" strokeWidth={1.5} />}
            {phase === 'flight' && (
              <>
                <Ellipse cx={ballX} cy={Math.min(H - 6, H - 8 + (GOAL.y + GOAL.h - (H - 8)) * k)} rx={ballR} ry={ballR * 0.4} fill="#000000" opacity={0.25} />
                {/* A short trail behind the ball while it flies. */}
                {k < 1 &&
                  [0.05, 0.1, 0.15].map((d, i) => {
                    const g = pathAt(Math.max(0, k - d));
                    return <Circle key={i} cx={g.x} cy={g.y} r={g.r * (0.85 - i * 0.15)} fill="#ffffff" opacity={0.28 - i * 0.08} />;
                  })}
                <G transform={`rotate(${spin} ${ballX} ${ballY})`}>
                  <Circle cx={ballX} cy={ballY} r={ballR} fill="#ffffff" stroke="#111111" strokeWidth={1.5} />
                  <Path d={`M ${ballX - ballR * 0.55} ${ballY - ballR * 0.2} L ${ballX} ${ballY - ballR * 0.6} L ${ballX + ballR * 0.55} ${ballY - ballR * 0.2} L ${ballX + ballR * 0.35} ${ballY + ballR * 0.45} L ${ballX - ballR * 0.35} ${ballY + ballR * 0.45} Z`} fill="#111111" />
                </G>
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
                  : blockers.length
                    ? 'Tap to aim past the defender. The keeper comes out if you wait.'
                    : 'Tap to aim. He comes off his line if you wait.'
              : phase === 'power'
                ? 'Tap to set the power!'
                : landed
                  ? shot?.text
                  : ' '}
          </T>
        </View>
      </Pressable>
    </View>
  );
}

// A man in the way, as the live pitch reports him (see
// PitchSim.laneDefenders), plus how he shuffles while you aim.
export type Lane = { id: string; x: number; half: number; near: number };
type Blocker = Omit<Lane, 'id'> & { id?: string; speed: number; phase: number; amp: number };

// A defender's position across the goal at time t.
function blockerX(b: Blocker, t: number): number {
  return Math.max(-0.15, Math.min(1.15, b.x + b.amp * Math.sin(t * b.speed + b.phase)));
}

// How big and how low to draw him: the nearer the shooter, the bigger and
// the further down the screen. His width is exactly the goal he hides, so a
// shot that looks past him is past him.
function manAt(b: Blocker, goal: { y: number; h: number; w: number }): { w: number; h: number; ground: number } {
  const w = Math.max(8, b.half * 2 * goal.w);
  const base = goal.y + goal.h + 26;
  return { w, h: Math.min(w * 2.2, 54), ground: base + b.near * Math.max(0, H - 24 - base) };
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
  wall: [number, number] | null,
): { outcome: ShotOutcome; text: string; q: number; diveTo: number } {
  const toward = (target: number) => clamp(setup.keeper + Math.max(-reach, Math.min(reach, target - setup.keeper)));
  if (x < 0.02 || x > 0.98) return { outcome: 'miss', text: 'Wide of the post!', q: 0.05, diveTo: toward(x) };
  if (power > b.high) return { outcome: 'miss', text: 'Blazed over the bar!', q: 0.05, diveTo: toward(x) };
  if (kind === 'freekick' && wall && x >= setup.wall + wall[0] && x <= setup.wall + wall[1]) return { outcome: 'miss', text: 'Straight into the wall.', q: 0.08, diveTo: setup.keeper };
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

// How to strike it. Free for everyone; each trades one thing for another.
const SHAPES: { id: ShotShape; label: string; hint: string }[] = [
  { id: 'driven', label: 'Driven', hint: 'Hard and true' },
  { id: 'curl', label: 'Curl', hint: 'Bends round them' },
  { id: 'low', label: 'Low', hint: 'Skims the grass' },
];

// A curler is aimed outside the post and bends back in, so on its way it is
// further out than where it ends up: to the right of a right-side target.
function curlSide(x: number): number {
  return x >= 0.5 ? 1 : -1;
}

// The part of the wall (from its left end, as shares of the goal) a free
// kick runs into. A curler goes round the ends; a low one goes into their
// feet whatever the power; a driven one gets over if hit hard enough.
function wallSpan(shape: ShotShape, power: number): [number, number] | null {
  if (shape === 'curl') return power < 0.85 ? [0.06, 0.24] : null;
  if (shape === 'low') return [0, 0.3];
  return power < 0.75 ? [0, 0.3] : null;
}

const BAND_VIEW: { label: string; color: string; from: (b: Bands) => number; to: (b: Bands) => number }[] = [
  { label: 'LOW', color: colors.blue, from: () => 0, to: (b) => b.low },
  { label: 'MID', color: colors.green, from: (b) => b.low, to: (b) => b.mid },
  { label: 'HIGH', color: colors.gold, from: (b) => b.mid, to: (b) => b.high },
  { label: 'TOO HIGH', color: colors.red, from: (b) => b.high, to: () => 1 },
];

function bandName(p: number, b: Bands): string {
  return p < b.low ? 'LOW' : p <= b.mid ? 'MID' : p <= b.high ? 'HIGH' : 'TOO HIGH';
}
