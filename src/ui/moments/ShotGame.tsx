import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { T } from '../kit';
import { colors } from '../theme';

type Kind = 'shot' | 'penalty' | 'freekick';

const W = 300;
const H = 150;
const GOAL = { x: 30, y: 20, w: 240, h: 90 };
const SWEET = [0.6, 0.85];


// Two taps: first stops the aim marker, second stops the power bar.
// Aim away from the keeper and into the sweet spot for the best chance.
export function ShotGame({ kind, composure, finesse = 0, onDone }: { kind: Kind; composure: number; finesse?: number; onDone: (q: number, text: string) => void }) {
  // Finesse Shot widens the power sweet spot.
  const sweet: [number, number] = [SWEET[0] - 0.04 * finesse, SWEET[1] + 0.03 * finesse];
  const [phase, setPhase] = useState<'aim' | 'power' | 'done'>('aim');
  // Where the aim locked; drawn while the power bar runs.
  const [aim, setAim] = useState(0.5);
  const [setup] = useState(
    () => ({
      keeper: 0.3 + Math.random() * 0.4,
      dive: Math.random() < 0.5 ? -1 : 1,
      wall: 0.15 + Math.random() * 0.4,
      offset: Math.random() * Math.PI * 2,
    }),
  );
  const t = useTicker(phase !== 'done', phase);
  const speed = 2 + (1 - composure / 99) * 2.4;

  const aimX = phase === 'aim' ? 0.5 + 0.62 * Math.sin(t * speed + setup.offset) : aim;
  const power = phase === 'power' ? (Math.sin(t * 3.4 - Math.PI / 2) + 1) / 2 : 0;
  const [result, setResult] = useState<{ q: number; text: string; power: number } | null>(null);

  const keeperX = kind === 'penalty' && phase === 'done' ? clamp(setup.keeper + setup.dive * 0.28) : setup.keeper;

  const tap = () => {
    if (phase === 'aim') {
      setAim(aimX);
      setPhase('power');
    } else if (phase === 'power') {
      const r = score(kind, aim, power, setup, sweet);
      setResult({ ...r, power });
      setPhase('done');
      setTimeout(() => onDone(r.q, r.text), 900);
    }
  };

  const px = (x: number) => GOAL.x + x * GOAL.w;
  const barPower = phase === 'done' ? result?.power ?? 0 : power;

  return (
    <Pressable onPress={tap}>
      <View style={{ alignItems: 'center' }}>
        <Svg width="100%" height={180} viewBox={`0 0 ${W} ${H}`}>
          <Rect x={0} y={0} width={W} height={H} fill={colors.pitch} />
          {Array.from({ length: 13 }, (_, i) => (
            <Line key={`v${i}`} x1={GOAL.x + (i * GOAL.w) / 12} y1={GOAL.y} x2={GOAL.x + (i * GOAL.w) / 12} y2={GOAL.y + GOAL.h} stroke="#ffffff22" strokeWidth={1} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <Line key={`h${i}`} x1={GOAL.x} y1={GOAL.y + (i * GOAL.h) / 5} x2={GOAL.x + GOAL.w} y2={GOAL.y + (i * GOAL.h) / 5} stroke="#ffffff22" strokeWidth={1} />
          ))}
          <Rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} stroke="#ffffff" strokeWidth={4} fill="none" />
          <Line x1={0} y1={GOAL.y + GOAL.h} x2={W} y2={GOAL.y + GOAL.h} stroke={colors.pitchLine} strokeWidth={2} />
          {kind === 'freekick' && <Rect x={px(setup.wall)} y={GOAL.y + GOAL.h - 46} width={GOAL.w * 0.3} height={46} rx={6} fill="#c8102e" opacity={0.9} />}
          <Rect x={px(keeperX) - 14} y={GOAL.y + GOAL.h - 58} width={28} height={58} rx={8} fill={colors.gold} />
          <Circle cx={px(aimX)} cy={GOAL.y + GOAL.h / 2} r={9} stroke="#ffffff" strokeWidth={3} fill={phase === 'aim' ? 'none' : '#ffffff'} />
          <Line x1={px(aimX)} y1={GOAL.y + 8} x2={px(aimX)} y2={GOAL.y + GOAL.h - 8} stroke="#ffffff88" strokeWidth={1} />
        </Svg>
        <View style={{ width: '100%', height: 18, backgroundColor: colors.bg, borderRadius: 9, overflow: 'hidden', marginTop: 8 }}>
          <View style={{ position: 'absolute', left: `${sweet[0] * 100}%`, width: `${(sweet[1] - sweet[0]) * 100}%`, top: 0, bottom: 0, backgroundColor: '#3ddc8455' }} />
          <View style={{ width: `${barPower * 100}%`, height: 18, backgroundColor: phase === 'aim' ? 'transparent' : colors.accent }} />
        </View>
        <T bold style={{ marginTop: 10, textAlign: 'center' }}>
          {phase === 'aim' ? 'Tap to aim. Pick a spot away from the keeper.' : phase === 'power' ? 'Tap again for power. Hit the green zone.' : result?.text}
        </T>
      </View>
    </Pressable>
  );
}

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}

function score(kind: Kind, x: number, power: number, setup: { keeper: number; dive: number; wall: number }, sweet: [number, number]): { q: number; text: string } {
  if (x < 0.03 || x > 0.97) return { q: 0.03, text: 'Wide of the post!' };
  if (power > 0.95) return { q: 0.05, text: 'Blazed over the bar!' };
  let aimQ = clamp(Math.abs(x - setup.keeper) / 0.4);
  if (x < 0.15 || x > 0.85) aimQ = clamp(aimQ + 0.15);
  if (kind === 'penalty') {
    const diveTo = clamp(setup.keeper + setup.dive * 0.28);
    if (Math.abs(x - diveTo) < 0.18) aimQ *= 0.3;
  }
  const powerQ = power >= sweet[0] && power <= sweet[1] ? 1 : power < sweet[0] ? 0.3 + power : clamp(1 - (power - sweet[1]) * 5);
  if (kind === 'freekick' && x >= setup.wall && x <= setup.wall + 0.3 && power < 0.75) {
    return { q: 0.08, text: 'Straight into the wall.' };
  }
  const q = aimQ * 0.6 + powerQ * 0.4;
  const text = q > 0.8 ? 'Perfect strike!' : q > 0.55 ? 'Good contact.' : q > 0.3 ? 'Scuffed it a bit.' : 'Poor effort.';
  return { q, text };
}
