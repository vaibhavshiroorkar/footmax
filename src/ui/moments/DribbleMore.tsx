import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { Icon, IconName, Row, T, haptic } from '../kit';
import { alpha, colors, fonts } from '../theme';
import { Football } from '../football';
import { Person } from '../rig/Figure';
import { straddle } from '../rig/poses';

type Done = (q: number, text: string) => void;

// Calls onDone once, after a short beat so the result can be read.
function useFinish(onDone: Done) {
  const [done, setDone] = useState<string | null>(null);
  const finished = useRef(false);
  const finish = (q: number, text: string) => {
    if (finished.current) return;
    finished.current = true;
    setDone(text);
    setTimeout(() => onDone(Math.max(0, Math.min(1, q)), text), 800);
  };
  return { done, finish, finished };
}

function Field({ children }: { children: React.ReactNode }) {
  return (
    <Svg width="100%" height={150} viewBox="0 0 300 150">
      <Rect x={0} y={0} width={300} height={150} fill={colors.pitch} />
      <Line x1={0} y1={20} x2={300} y2={20} stroke="#ffffff33" strokeWidth={2} />
      {children}
    </Svg>
  );
}

const KEYS: { id: 'L' | 'R' | 'U'; icon: IconName; label: string }[] = [
  { id: 'L', icon: 'arrow-back', label: 'Left' },
  { id: 'U', icon: 'arrow-up', label: 'Burst' },
  { id: 'R', icon: 'arrow-forward', label: 'Right' },
];

// Skill combo: the move's inputs flash up; repeat them fast and in order.
export function ComboDribble({ move = 'Stepover', length = 3, speed = 0, onDone }: { move?: string; length?: number; speed?: number; onDone: Done }) {
  const [combo] = useState(() => Array.from({ length }, () => KEYS[Math.floor(Math.random() * 3)].id));
  const [input, setInput] = useState<string[]>([]);
  const { done, finish } = useFinish(onDone);
  const limit = 2.2 + length * 0.6 + 0.3 * speed;
  const t = useTicker(!done);
  useEffect(() => {
    if (t > limit && !done) finish(0.12, 'Too slow. He closes you down.');
  });
  const press = (k: string) => {
    if (done) return;
    haptic();
    const next = [...input, k];
    if (combo[next.length - 1] !== k) return finish(0.15, 'Fumbled the move. Ball lost.');
    setInput(next);
    if (next.length === combo.length) finish(Math.min(1, 1.15 - t / limit), `${move}! He is left for dead.`);
  };
  return (
    <View style={{ gap: 10 }}>
      <T muted style={{ fontSize: 12.5, textAlign: 'center' }}>
        {done ?? `${move}: repeat the moves in order.`}
      </T>
      <Row gap={8} style={{ justifyContent: 'center' }}>
        {combo.map((k, i) => (
          <View key={i} style={{ width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: i < input.length ? colors.accent : colors.borderStrong, backgroundColor: i < input.length ? alpha(colors.accent, 0.2) : colors.bgElev }}>
            <Icon name={KEYS.find((x) => x.id === k)!.icon} size={20} color={i < input.length ? colors.accent : colors.text} />
          </View>
        ))}
      </Row>
      <View style={{ height: 8, backgroundColor: colors.bgElev, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(0, 1 - t / limit) * 100}%`, height: 8, backgroundColor: colors.gold }} />
      </View>
      <Row gap={8}>
        {KEYS.map((k) => (
          <Pressable key={k.id} onPress={() => press(k.id)} accessibilityRole="button" accessibilityLabel={k.label} style={({ pressed }) => ({ flex: 1, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? alpha(colors.accent, 0.25) : colors.cardAlt, borderWidth: 1.5, borderColor: colors.borderStrong, borderBottomWidth: 4, borderBottomColor: '#0a0f18' })}>
            <Icon name={k.icon} size={24} color={colors.text} />
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

// Nutmeg: his legs open and close; go through when the gap is wide.
export function GapDribble({ speed = 0, onDone }: { speed?: number; onDone: Done }) {
  const { done, finish } = useFinish(onDone);
  const [setup] = useState(() => ({ rate: 2.4 + Math.random() * 1.2, phase: Math.random() * 6 }));
  const t = useTicker(!done);
  const gap = (Math.sin(t * setup.rate + setup.phase) + 1) / 2;
  useEffect(() => {
    if (t > 5 && !done) finish(0.1, 'He stands you up and takes it.');
  });
  const go = () => {
    if (done) return;
    haptic('medium');
    // A wider gap is a cleaner nutmeg; Close Control widens what counts.
    const q = Math.min(1, gap * (1.05 + 0.1 * speed));
    finish(q, q > 0.75 ? 'Through the legs! Nutmeg!' : q > 0.4 ? 'It squeezes through.' : 'Legs closed. Blocked.');
  };
  const spread = 6 + gap * 26;
  return (
    <Pressable onPress={go} accessibilityRole="button" accessibilityLabel="Go through his legs" style={{ gap: 8 }}>
      <T muted style={{ fontSize: 12.5, textAlign: 'center' }}>
        {done ?? 'Tap when his legs are wide open.'}
      </T>
      <Field>
        <Person side="opp" x={150} y={84} h={88} pose={straddle(spread * 0.68)} />
        <Rect x={150 - spread + 6} y={104} width={Math.max(0, spread * 2 - 12)} height={8} rx={4} fill={gap > 0.6 ? colors.accent : '#ffffff22'} />
        <Football cx={150} cy={138} r={7} />
      </Field>
    </Pressable>
  );
}

// Sprint: knock it past him and race; tap as fast as you can.
export function RaceDribble({ pace = 60, onDone }: { pace?: number; onDone: Done }) {
  const { done, finish } = useFinish(onDone);
  const [taps, setTaps] = useState(0);
  const t = useTicker(!done);
  // The defender keeps a steady pace; quicker players need fewer taps.
  const need = Math.round(16 - (pace / 99) * 6);
  const him = Math.min(1, t / 3.2);
  const me = Math.min(1, taps / need);
  useEffect(() => {
    if (!done && him >= 1) finish(me > 0.85 ? 0.55 : 0.12, me > 0.85 ? 'Neck and neck... you just get there.' : 'He gets back and wins it.');
  });
  const tap = () => {
    if (done) return;
    const next = taps + 1;
    setTaps(next);
    if (next >= need) finish(Math.min(1, 1.2 - him), 'Gone! He cannot catch you.');
  };
  return (
    <View style={{ gap: 8 }}>
      <T muted style={{ fontSize: 12.5, textAlign: 'center' }}>
        {done ?? 'Knock it past him and run! Tap fast.'}
      </T>
      {[
        { label: 'You', v: me, color: colors.accent },
        { label: 'Him', v: him, color: colors.red },
      ].map((r) => (
        <Row key={r.label} gap={8}>
          <Text style={{ width: 34, fontFamily: fonts.display, fontSize: 16, color: r.color }}>{r.label}</Text>
          <View style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: colors.bgElev, overflow: 'hidden' }}>
            <View style={{ width: `${r.v * 100}%`, height: 14, backgroundColor: r.color }} />
          </View>
        </Row>
      ))}
      <Pressable onPressIn={tap} accessibilityRole="button" accessibilityLabel="Sprint" style={({ pressed }) => ({ height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.accentDark : colors.accent, borderBottomWidth: 5, borderBottomColor: '#5a7a22' })}>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>SPRINT</Text>
      </Pressable>
    </View>
  );
}
