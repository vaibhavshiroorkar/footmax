import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { Button, Row, T } from '../kit';
import { colors } from '../theme';
import { Football } from '../football';

const BASE_WINDOW = 0.9;

// Dribble: wait for the defender to commit, then go the other way.
// Tackle: wait for the attacker to cut, then go the same way to block him.
// Going early, or the wrong way, loses the duel.
// stat: dribbling for a dribble, defending for a tackle; it sets most of
// the reaction time.
export function DribbleGame({ speed = 0, stat = 60, mode = 'dribble', onDone }: { speed?: number; stat?: number; mode?: 'dribble' | 'tackle'; onDone: (q: number, text: string) => void }) {
  // Speed Burst (dribble) or Rock at the Back (tackle) gives a longer window.
  const WINDOW = BASE_WINDOW * (0.55 + (stat / 99) * 0.7) + 0.12 * speed;
  const tackle = mode === 'tackle';
  const [setup] = useState(() => ({ delay: 0.7 + Math.random() * 1.1, dir: Math.random() < 0.5 ? -1 : 1 }));
  const [done, setDone] = useState<string | null>(null);
  const finished = useRef(false);
  const t = useTicker(!done);
  const committed = t >= setup.delay;

  const finish = (q: number, text: string) => {
    if (finished.current) return;
    finished.current = true;
    setDone(text);
    setTimeout(() => onDone(q, text), 800);
  };

  const go = (dir: -1 | 1) => {
    if (!committed) return finish(0.15, tackle ? 'You dived in early and he skips round you.' : 'Too early! He reads it and nicks the ball.');
    const right = tackle ? dir === setup.dir : dir !== setup.dir;
    if (!right) return finish(0.1, tackle ? 'Wrong way. He is gone.' : 'Straight into him. Ball lost.');
    const reaction = t - setup.delay;
    const q = Math.max(0.25, Math.min(1, 1 - reaction / WINDOW + 0.2));
    if (tackle) finish(q, q > 0.7 ? 'Perfectly timed. Clean tackle!' : 'You get a toe to it.');
    else finish(q, q > 0.7 ? 'Brilliant! He is left on the floor.' : 'You squeeze past him.');
  };

  useEffect(() => {
    if (committed && t - setup.delay > WINDOW && !done) finish(0.1, tackle ? 'Too slow. He is past you.' : 'You hesitated and he wins it back.');
  });

  const move = committed ? Math.min(1, (t - setup.delay) / 0.25) * setup.dir * 55 : Math.sin(t * 9) * 4;
  const prompt = tackle
    ? committed
      ? `He cuts ${setup.dir < 0 ? 'LEFT' : 'RIGHT'}! Go with him!`
      : 'Stay on your feet... wait for him to move.'
    : committed
      ? `He dives ${setup.dir < 0 ? 'LEFT' : 'RIGHT'}! Go the other way!`
      : 'Hold... wait for him to commit.';
  return (
    <View>
      <Svg width="100%" height={180} viewBox="0 0 300 170">
        <Rect x={0} y={0} width={300} height={170} fill={colors.pitch} />
        {tackle ? (
          <>
            {/* The attacker with the ball comes at you. */}
            <Circle cx={150 + move} cy={60} r={16} fill="#d94b4b" stroke="#ffffff" strokeWidth={2} />
            <Football cx={150 + move} cy={84} r={6.5} rot={move * 6} />
            <Circle cx={150} cy={140} r={14} fill={colors.gold} stroke="#ffffff" strokeWidth={2} />
          </>
        ) : (
          <>
            <Circle cx={150 + move} cy={70} r={16} fill="#d94b4b" stroke="#ffffff" strokeWidth={2} />
            <Circle cx={150} cy={140} r={14} fill={colors.gold} stroke="#ffffff" strokeWidth={2} />
            <Football cx={150} cy={118} r={6.5} />
          </>
        )}
      </Svg>
      <T bold style={{ textAlign: 'center', marginVertical: 8 }}>
        {done ?? prompt}
      </T>
      <Row>
        <Button label={tackle ? 'Block left' : 'Go left'} icon="arrow-back" style={{ flex: 1 }} variant="secondary" disabled={!!done} onPress={() => go(-1)} />
        <Button label={tackle ? 'Block right' : 'Go right'} icon="arrow-forward" style={{ flex: 1 }} variant="secondary" disabled={!!done} onPress={() => go(1)} />
      </Row>
    </View>
  );
}
