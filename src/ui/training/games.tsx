import React, { useEffect, useRef, useState, useEffectEvent } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { useTicker } from '../moments/useTicker';
import { Button, Icon, IconName, Row, haptic } from '../kit';
import { alpha, colors, fonts } from '../theme';

// Quick training mini-games. Each reports a score from 0 to 1, which sets
// how much the drill improves the player.

type Done = (score: number) => void;

function useFinish(onDone: Done) {
  const done = useRef(false);
  return (score: number) => {
    if (done.current) return;
    done.current = true;
    onDone(Math.max(0, Math.min(1, score)));
  };
}

function TimerBar({ left, color = colors.accent }: { left: number; color?: string }) {
  return (
    <View style={{ height: 10, backgroundColor: colors.bgElev, borderRadius: 5, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, left) * 100}%`, height: 10, backgroundColor: left > 0.25 ? color : colors.red, borderRadius: 5 }} />
    </View>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.text, textAlign: 'center' }}>{children}</Text>;
}

// Finishing: tap targets as they pop up in the goal.
export function TargetGame({ onDone }: { onDone: Done }) {
  const LENGTH = 8;
  const EACH = 0.85;
  const [spots] = useState(() => Array.from({ length: Math.ceil(LENGTH / EACH) }, () => ({ x: 0.1 + Math.random() * 0.8, y: 0.15 + Math.random() * 0.7 })));
  const [hits, setHits] = useState<number[]>([]);
  const t = useTicker(true);
  const finish = useFinish(onDone);
  const idx = Math.floor(t / EACH);
  useEffect(() => {
    if (t >= LENGTH) finish(hits.length / spots.length + 0.1);
  });
  const s = spots[idx];
  const age = (t % EACH) / EACH;
  return (
    <View style={{ gap: 10 }}>
      <Prompt>Hit the targets! {hits.length} / {spots.length}</Prompt>
      <TimerBar left={1 - t / LENGTH} />
      <View style={{ height: 190, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.pitch }}>
        <Svg width="100%" height="100%" viewBox="0 0 300 190" style={{ position: 'absolute' }}>
          <Rect x={20} y={14} width={260} height={150} stroke="#fff" strokeWidth={6} fill="rgba(255,255,255,0.12)" />
          {Array.from({ length: 9 }, (_, i) => <Line key={i} x1={20 + i * 32.5} y1={14} x2={20 + i * 32.5} y2={164} stroke="#ffffff33" strokeWidth={1} />)}
        </Svg>
        {s && !hits.includes(idx) && t < LENGTH && (
          <Pressable
            onPressIn={() => {
              haptic();
              setHits((h) => [...h, idx]);
            }}
            style={{ position: 'absolute', left: `${s.x * 100}%`, top: `${s.y * 100}%`, marginLeft: -26, marginTop: -26, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.red, borderWidth: 6, borderColor: '#fff', transform: [{ scale: 1.15 - age * 0.5 }], alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' }} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Sprints: alternate left and right as fast as you can.
export function TapRaceGame({ onDone }: { onDone: Done }) {
  const LENGTH = 5;
  const GOAL = 34;
  const [taps, setTaps] = useState(0);
  const [next, setNext] = useState<'L' | 'R'>('L');
  const [started, setStarted] = useState(false);
  const t = useTicker(started);
  const finish = useFinish(onDone);
  useEffect(() => {
    if (started && t >= LENGTH) finish(taps / GOAL);
  });
  const press = (side: 'L' | 'R') => {
    if (!started) setStarted(true);
    if (side !== next) return;
    haptic();
    setTaps((n) => n + 1);
    setNext(side === 'L' ? 'R' : 'L');
  };
  return (
    <View style={{ gap: 10 }}>
      <Prompt>{started ? `${taps} strides` : 'Tap left, right, left... as fast as you can!'}</Prompt>
      <TimerBar left={started ? 1 - t / LENGTH : 1} color={colors.gold} />
      <View style={{ height: 22, backgroundColor: colors.bgElev, borderRadius: 11, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(1, taps / GOAL) * 100}%`, height: 22, backgroundColor: colors.accent, borderRadius: 11 }} />
      </View>
      <Row>
        {(['L', 'R'] as const).map((side) => (
          <Pressable key={side} onPressIn={() => press(side)} style={{ flex: 1, height: 120, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: next === side ? colors.accent : colors.bgElev, borderBottomWidth: 6, borderColor: next === side ? colors.accentDark : colors.borderStrong }}>
            <Icon name="footsteps" size={42} color={next === side ? '#fff' : colors.faint} />
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: next === side ? '#fff' : colors.faint }}>{side === 'L' ? 'Left' : 'Right'}</Text>
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

// Passing: stop the marker inside a shrinking green zone, five times.
export function TimingGame({ onDone }: { onDone: Done }) {
  const ROUNDS = 5;
  const [round, setRound] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const t = useTicker(round < ROUNDS, round);
  const finish = useFinish(onDone);
  // One roll per round, made up front so render stays pure.
  const [rolls] = useState(() => Array.from({ length: ROUNDS }, () => Math.random()));
  const w = 0.3 - round * 0.045;
  const start = 0.1 + rolls[Math.min(round, ROUNDS - 1)] * (0.8 - w);
  const zone = [start, start + w];
  const speed = 1.4 + round * 0.25;
  const x = (Math.sin(t * speed * Math.PI) + 1) / 2;
  const tap = () => {
    const mid = (zone[0] + zone[1]) / 2;
    const inside = x >= zone[0] && x <= zone[1];
    const sc = inside ? 1 - Math.abs(x - mid) / (zone[1] - zone[0]) : Math.max(0, 0.4 - Math.abs(x - mid));
    haptic();
    const all = [...scores, sc];
    setScores(all);
    if (all.length >= ROUNDS) finish(all.reduce((a, b) => a + b, 0) / ROUNDS + 0.05);
    else setRound(round + 1);
  };
  return (
    <View style={{ gap: 12 }}>
      <Prompt>
        Pass {Math.min(round + 1, ROUNDS)} of {ROUNDS}: stop in the green!
      </Prompt>
      <View style={{ height: 40, backgroundColor: colors.bgElev, borderRadius: 20, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: `${zone[0] * 100}%`, width: `${(zone[1] - zone[0]) * 100}%`, top: 0, bottom: 0, backgroundColor: alpha(colors.accent, 0.6) }} />
        <View style={{ position: 'absolute', left: `${x * 100}%`, marginLeft: -6, top: 2, bottom: 2, width: 12, borderRadius: 6, backgroundColor: colors.text }} />
      </View>
      <Row gap={6} style={{ justifyContent: 'center' }}>
        {Array.from({ length: ROUNDS }, (_, i) => (
          <Icon key={i} name={i < scores.length ? (scores[i] >= 0.5 ? 'checkmark-circle' : 'close-circle') : 'ellipse-outline'} size={22} color={i < scores.length ? (scores[i] >= 0.5 ? colors.accent : colors.red) : colors.faint} />
        ))}
      </Row>
      <Button label="Pass!" icon="send" onPress={tap} />
    </View>
  );
}

const ARROWS: { key: string; icon: IconName }[] = [
  { key: 'L', icon: 'arrow-back' },
  { key: 'U', icon: 'arrow-up' },
  { key: 'D', icon: 'arrow-down' },
  { key: 'R', icon: 'arrow-forward' },
];

// Ball mastery: watch the skill-move combo, then repeat it.
export function SequenceGame({ onDone }: { onDone: Done }) {
  const LEN = 6;
  const [seq] = useState(() => Array.from({ length: LEN }, () => ARROWS[Math.floor(Math.random() * 4)].key));
  const [input, setInput] = useState<string[]>([]);
  const t = useTicker(true);
  const finish = useFinish(onDone);
  const SHOW = 0.65;
  const showing = t < LEN * SHOW + 0.4;
  const lit = showing ? seq[Math.floor(t / SHOW)] : null;
  const press = (k: string) => {
    if (showing) return;
    haptic();
    const next = [...input, k];
    setInput(next);
    const wrong = next.findIndex((v, i) => v !== seq[i]);
    if (wrong >= 0) finish(wrong / LEN);
    else if (next.length === LEN) finish(1);
  };
  return (
    <View style={{ gap: 12 }}>
      <Prompt>{showing ? 'Watch the combo...' : `Your turn: ${input.length} / ${LEN}`}</Prompt>
      <Row gap={8} style={{ justifyContent: 'center' }}>
        {seq.map((k, i) => (
          <View key={i} style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: !showing && i < input.length ? colors.accent : colors.bgElev }}>
            <Icon name={showing ? 'help' : i < input.length ? ARROWS.find((a) => a.key === seq[i])!.icon : 'ellipse-outline'} size={16} color={!showing && i < input.length ? '#fff' : colors.faint} />
          </View>
        ))}
      </Row>
      <Row gap={10} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {ARROWS.map((a) => (
          <Pressable key={a.key} onPressIn={() => press(a.key)} style={{ width: 70, height: 70, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: lit === a.key ? colors.accent : colors.bgElev, borderWidth: 1, borderColor: lit === a.key ? colors.accent : colors.borderStrong }}>
            <Icon name={a.icon} size={32} color={lit === a.key ? colors.ink : colors.text} />
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

// Defending and goalkeeping: react to the direction as fast as you can.
export function ReactGame({ onDone, keeper }: { onDone: Done; keeper?: boolean }) {
  const ROUNDS = 6;
  const [round, setRound] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [setups] = useState(() => Array.from({ length: ROUNDS }, () => ({ delay: 0.6 + Math.random() * 1.0, dir: Math.floor(Math.random() * 3) })));
  const setup = setups[Math.min(round, ROUNDS - 1)];
  const t = useTicker(round < ROUNDS, round);
  const finish = useFinish(onDone);
  const live = t >= setup.delay;
  const record = (sc: number) => {
    const all = [...scores, sc];
    setScores(all);
    if (all.length >= ROUNDS) finish(all.reduce((a, b) => a + b, 0) / ROUNDS + 0.05);
    else setRound(round + 1);
  };
  // Too slow: the round counts as a miss 1.1 s after the cue shows.
  const onMiss = useEffectEvent(() => {
    if (scores.length === round) record(0);
  });
  useEffect(() => {
    if (!live) return;
    const id = setTimeout(onMiss, 1100);
    return () => clearTimeout(id);
  }, [live, round]);
  const press = (d: number) => {
    haptic();
    if (!live) return record(0);
    if (d !== setup.dir) return record(0);
    const rt = t - setup.delay;
    record(Math.max(0.2, Math.min(1, 1.25 - rt * 1.4)));
  };
  const labels = keeper ? ['Dive left', 'Stay', 'Dive right'] : ['Block left', 'Stand', 'Block right'];
  const icons: IconName[] = ['arrow-back', keeper ? 'hand-left' : 'shield', 'arrow-forward'];
  return (
    <View style={{ gap: 12 }}>
      <Prompt>{live ? 'NOW!' : `Round ${Math.min(round + 1, ROUNDS)} of ${ROUNDS}: wait for it...`}</Prompt>
      <Row gap={8}>
        {[0, 1, 2].map((d) => (
          <View key={d} style={{ flex: 1, height: 70, borderRadius: 18, backgroundColor: live && setup.dir === d ? colors.orange : colors.bgElev, alignItems: 'center', justifyContent: 'center' }}>
            {live && setup.dir === d && <Icon name="football" size={36} color="#fff" />}
          </View>
        ))}
      </Row>
      <Row gap={8}>
        {[0, 1, 2].map((d) => (
          <Button key={d} label={labels[d]} icon={icons[d]} small variant={keeper ? 'blue' : 'secondary'} style={{ flex: 1 }} onPress={() => press(d)} />
        ))}
      </Row>
      <Row gap={6} style={{ justifyContent: 'center' }}>
        {Array.from({ length: ROUNDS }, (_, i) => (
          <Icon key={i} name={i < scores.length ? (scores[i] >= 0.5 ? 'checkmark-circle' : 'close-circle') : 'ellipse-outline'} size={22} color={i < scores.length ? (scores[i] >= 0.5 ? colors.accent : colors.red) : colors.faint} />
        ))}
      </Row>
    </View>
  );
}

export function GameFor({ drill, onDone }: { drill: string; onDone: Done }) {
  switch (drill) {
    case 'finishing':
      return <TargetGame onDone={onDone} />;
    case 'speed':
      return <TapRaceGame onDone={onDone} />;
    case 'playmaking':
      return <TimingGame onDone={onDone} />;
    case 'technique':
      return <SequenceGame onDone={onDone} />;
    case 'keeping':
      return <ReactGame keeper onDone={onDone} />;
    default:
      return <ReactGame onDone={onDone} />;
  }
}
