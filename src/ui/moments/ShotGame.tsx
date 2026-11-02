import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { KeeperFigure } from './Keeper';
import { T } from '../kit';
import { colors, fonts } from '../theme';

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
const SWEET = [0.6, 0.85];
const FLIGHT = 0.6;

// Two taps: the first stops the aim marker, the second the power bar. Then
// the ball flies and what you see is what counts: out of the keeper's reach
// and on target is a goal, inside his reach is a save, too wide or too much
// power misses.
export function ShotGame({ kind, composure, finesse = 0, keeper = 60, view = 'box', chip = false, onDone }: { kind: Kind; composure: number; finesse?: number; keeper?: number; view?: ShotView; chip?: boolean; onDone: (q: number, text: string, outcome: ShotOutcome) => void }) {
  const GOAL = kind === 'shot' ? GOALS[view] : GOALS.box;
  const outside = kind === 'shot' && view === 'outside';
  const oneOnOne = kind === 'shot' && view === 'oneonone';
  // Finesse Shot widens the power sweet spot.
  const sweet: [number, number] = [SWEET[0] - 0.04 * finesse, SWEET[1] + 0.03 * finesse];
  const [phase, setPhase] = useState<'aim' | 'power' | 'flight' | 'done'>('aim');
  const [aim, setAim] = useState(0.5);
  const [shot, setShot] = useState<{ power: number; outcome: ShotOutcome; text: string; q: number; diveTo: number; blockAt: number } | null>(null);
  const [setup] = useState(() => ({
    keeper: 0.32 + Math.random() * 0.36,
    dive: Math.random() < 0.5 ? -1 : 1,
    kit: ['#22c55e', '#facc15', '#a855f7', '#f97316'][Math.floor(Math.random() * 4)],
    wall: 0.15 + Math.random() * 0.4,
    offset: Math.random() * Math.PI * 2,
    blockers: [0.25 + Math.random() * 0.2, 0.55 + Math.random() * 0.2].map((x) => ({ x, speed: 0.8 + Math.random() * 0.8, phase: Math.random() * 6 })),
  }));
  const t = useTicker(phase !== 'done', phase);
  const speed = 2 + (1 - composure / 99) * 2.4;
  // How far the keeper can get across, as a share of the goal's width. Out
  // at your feet in a one on one he covers more of it.
  const reach = (0.15 + (keeper / 99) * 0.13) * (oneOnOne ? 1.35 : 1);
  const flight = outside ? 0.85 : FLIGHT;

  const aimX = phase === 'aim' ? 0.5 + 0.62 * Math.sin(t * speed + setup.offset) : aim;
  const power = phase === 'power' ? (Math.sin(t * 3.4 - Math.PI / 2) + 1) / 2 : shot?.power ?? 0;

  const tap = () => {
    if (phase === 'aim') {
      setAim(aimX);
      setPhase('power');
    } else if (phase === 'power') {
      // Two defenders shuffle across in front of a shot from distance.
      const blocked = outside && setup.blockers.some((b) => Math.abs(blockerX(b, t) - aim) < 0.07);
      const lob = oneOnOne && chip && power > sweet[1] && power <= sweet[1] + 0.14;
      const r = blocked
        ? { outcome: 'miss' as ShotOutcome, text: 'Blocked by a defender!', q: 0.08, diveTo: setup.keeper }
        : lob
          ? { outcome: 'goal' as ShotOutcome, text: 'Chipped over him! Sublime.', q: 1, diveTo: setup.keeper }
          : judge(kind, aim, power, setup, sweet, reach);
      setShot({ power, blockAt: t, ...r });
      setPhase('flight');
    }
  };

  // When the ball lands, show the result for a moment, then report it.
  const sent = useRef(false);
  useEffect(() => {
    if (phase === 'flight' && shot && t >= flight && !sent.current) {
      sent.current = true;
      setTimeout(() => onDone(shot.q, shot.text, shot.outcome), 900);
    }
  });

  const px = (x: number) => GOAL.x + x * GOAL.w;
  const k = phase === 'flight' && shot ? Math.min(1, t / flight) : 0;
  const landed = k >= 1;
  // Ball path: from the spot to the target, over the bar when overhit.
  const over = !!shot && shot.outcome === 'miss' && shot.power > sweet[1] + 0.06;
  const targetY = over ? GOAL.y - 14 : GOAL.y + GOAL.h * (0.85 - 0.6 * Math.min(1, (shot?.power ?? 0.5) / sweet[1]));
  const ballX = 150 + (px(aim) - 150) * k;
  const ballY = H - 12 + (targetY - (H - 12)) * k - Math.sin(Math.PI * k) * 10;
  const ballR = 8 - 3.5 * k;
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
          {phase !== 'flight' && <Rect x={px(setup.keeper - reach)} y={GOAL.y + GOAL.h - 4} width={GOAL.w * reach * 2} height={4} fill="#ffffff" opacity={0.25} />}
          {outside && (
            <>
              <Rect x={0} y={GOAL.y + GOAL.h + 22} width={W} height={2} fill={colors.pitchLine} opacity={0.6} />
              {setup.blockers.map((b, i) => (
                <G key={i}>
                  <Ellipse cx={px(blockerX(b, phase === 'flight' ? shot?.blockAt ?? 0 : t))} cy={GOAL.y + GOAL.h + 52} rx={10} ry={3} fill="#000000" opacity={0.25} />
                  <Rect x={px(blockerX(b, phase === 'flight' ? shot?.blockAt ?? 0 : t)) - 7} y={GOAL.y + GOAL.h + 20} width={14} height={32} rx={6} fill="#c8102e" />
                  <Circle cx={px(blockerX(b, phase === 'flight' ? shot?.blockAt ?? 0 : t))} cy={GOAL.y + GOAL.h + 15} r={6} fill="#d9a77c" />
                </G>
              ))}
            </>
          )}
          {kind === 'freekick' && <Rect x={px(setup.wall)} y={GOAL.y + GOAL.h - 46} width={GOAL.w * 0.3} height={46} rx={6} fill="#c8102e" opacity={0.9} />}
          <KeeperFigure x={px(keeperAt)} ground={GOAL.y + GOAL.h + (oneOnOne ? 22 : 0)} h={oneOnOne ? 74 : outside ? 44 : 58} dive={diveAmount} kit={setup.kit} />
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
        <View style={{ width: '100%', height: 18, backgroundColor: colors.bg, borderRadius: 9, overflow: 'hidden', marginTop: 8 }}>
          <View style={{ position: 'absolute', left: `${sweet[0] * 100}%`, width: `${(sweet[1] - sweet[0]) * 100}%`, top: 0, bottom: 0, backgroundColor: '#3ddc8455' }} />
          <View style={{ width: `${power * 100}%`, height: 18, backgroundColor: phase === 'aim' ? 'transparent' : colors.accent }} />
        </View>
        <T bold style={{ marginTop: 10, textAlign: 'center' }}>
          {phase === 'aim'
            ? outside
              ? 'Long range. Aim between the defenders and away from the keeper.'
              : oneOnOne
                ? `One on one! He is rushing out.${chip ? ' Overhit just past green to chip him.' : ''}`
                : 'Tap to aim. The white line under the keeper is his reach.'
            : phase === 'power'
              ? 'Tap again for power. Hit the green zone.'
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
  sweet: [number, number],
  reach: number,
): { outcome: ShotOutcome; text: string; q: number; diveTo: number } {
  const toward = (target: number) => clamp(setup.keeper + Math.max(-reach, Math.min(reach, target - setup.keeper)));
  if (x < 0.02 || x > 0.98) return { outcome: 'miss', text: 'Wide of the post!', q: 0.05, diveTo: toward(x) };
  if (power > sweet[1] + 0.06) return { outcome: 'miss', text: 'Blazed over the bar!', q: 0.05, diveTo: toward(x) };
  if (kind === 'freekick' && x >= setup.wall && x <= setup.wall + 0.3 && power < 0.75) return { outcome: 'miss', text: 'Straight into the wall.', q: 0.08, diveTo: setup.keeper };
  if (kind === 'penalty') {
    const diveTo = clamp(setup.keeper + setup.dive * 0.3);
    if (Math.abs(x - diveTo) < 0.17 || (power < sweet[0] - 0.2 && Math.abs(x - setup.keeper) < 0.25)) return { outcome: 'save', text: 'He guessed right!', q: 0.35, diveTo: x };
    return { outcome: 'goal', text: power >= sweet[0] ? 'Sent the keeper the wrong way!' : 'Rolled in. Cheeky!', q: 0.95, diveTo };
  }
  // A weak shot gives the keeper time to get across.
  const weak = power < sweet[0] - 0.12;
  const gap = Math.abs(x - setup.keeper);
  if (gap <= reach * (weak ? 1.6 : 1)) return { outcome: 'save', text: weak ? 'Too soft. Easy save.' : 'Within his reach. Saved!', q: 0.4, diveTo: x };
  return { outcome: 'goal', text: x < 0.12 || x > 0.88 ? 'Into the corner!' : 'Beat him all ends up!', q: power >= sweet[0] ? 1 : 0.85, diveTo: toward(x) };
}
