import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { Button, Row, T } from '../kit';
import { colors } from '../theme';

const BASE_WINDOW = 0.75;
type Dir = -1 | 0 | 1;
const LABEL: Record<Dir, string> = { [-1]: 'LEFT', 0: 'DOWN THE MIDDLE', 1: 'RIGHT' };

// The striker winds up and the ball flies late. Dive the right way fast.
// Guessing early is allowed: a right guess is a decent save, a wrong one
// leaves the goal open.
export function SaveGame({ reflex = 0, onDone }: { reflex?: number; onDone: (q: number, text: string) => void }) {
  const WINDOW = BASE_WINDOW + 0.12 * reflex;
  const [setup] = useState(() => ({ delay: 0.8 + Math.random() * 1.0, dir: ([-1, 0, 1] as Dir[])[Math.floor(Math.random() * 3)] }));
  const [done, setDone] = useState<string | null>(null);
  const [dived, setDived] = useState<Dir | null>(null);
  const finished = useRef(false);
  const t = useTicker(!done);
  const struck = t >= setup.delay;

  const finish = (q: number, text: string) => {
    if (finished.current) return;
    finished.current = true;
    setDone(text);
    setTimeout(() => onDone(q, text), 900);
  };

  const dive = (dir: Dir) => {
    setDived(dir);
    if (dir !== setup.dir) return finish(0.05, struck ? 'Wrong way!' : 'You guessed wrong and he rolls it the other way.');
    if (!struck) return finish(0.6, 'You guessed right!');
    const reaction = t - setup.delay;
    const q = Math.max(0.3, Math.min(1, 1 - reaction / WINDOW + 0.25));
    finish(q, q > 0.75 ? 'Superb reactions!' : 'You get a hand to it...');
  };

  useEffect(() => {
    if (struck && t - setup.delay > WINDOW && !done) finish(0.08, 'Rooted to the spot.');
  });

  // Ball travels from the penalty spot toward the chosen corner.
  const flight = struck ? Math.min(1, (t - setup.delay) / WINDOW) : 0;
  const ballX = 150 + setup.dir * 95 * flight;
  const ballY = 150 - 95 * flight;
  const keeperX = 150 + (dived ?? 0) * 60;
  return (
    <View>
      <Svg width="100%" height={190} viewBox="0 0 300 180">
        <Rect x={0} y={0} width={300} height={180} fill={colors.pitch} />
        <Rect x={40} y={20} width={220} height={70} stroke="#ffffff" strokeWidth={4} fill="none" />
        {Array.from({ length: 10 }, (_, i) => (
          <Line key={i} x1={40 + i * 22} y1={20} x2={40 + i * 22} y2={90} stroke="#ffffff22" strokeWidth={1} />
        ))}
        <Line x1={0} y1={90} x2={300} y2={90} stroke={colors.pitchLine} strokeWidth={2} />
        <Rect x={keeperX - 14} y={34} width={28} height={56} rx={8} fill={colors.gold} />
        {!struck && <Circle cx={150} cy={165} r={12} fill="#d94b4b" stroke="#ffffff" strokeWidth={2} />}
        <Circle cx={ballX} cy={ballY} r={7} fill="#ffffff" />
      </Svg>
      <T bold style={{ textAlign: 'center', marginVertical: 8 }}>
        {done ?? (struck ? `He goes ${LABEL[setup.dir]}!` : 'He steps up... read his body shape.')}
      </T>
      <Row>
        <Button label="Dive left" icon="arrow-back" style={{ flex: 1 }} variant="secondary" disabled={!!done} onPress={() => dive(-1)} />
        <Button label="Stay" icon="hand-left" style={{ flex: 1 }} variant="secondary" disabled={!!done} onPress={() => dive(0)} />
        <Button label="Dive right" icon="arrow-forward" style={{ flex: 1 }} variant="secondary" disabled={!!done} onPress={() => dive(1)} />
      </Row>
    </View>
  );
}
