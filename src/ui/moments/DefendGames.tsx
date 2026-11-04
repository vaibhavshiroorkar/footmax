import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { Button, Row, T } from '../kit';
import { colors } from '../theme';
import { Football } from '../football';
import { Person } from '../rig/Figure';
import { jump as jumpPose, slide as slidePose } from '../rig/poses';

// Three defending games, all on a top-down pitch in this match's kits. Each
// reports a quality from 0 to 1.

const W = 300;
const H = 180;
const LINE = '#ff6b6b';

function useFinish(onDone: (q: number, text: string) => void) {
  const [done, setDone] = useState<string | null>(null);
  const finished = useRef(false);
  const finish = (q: number, text: string) => {
    if (finished.current) return;
    finished.current = true;
    setDone(text);
    setTimeout(() => onDone(q, text), 1000);
  };
  return { done, finish };
}

function Turf({ children }: { children: React.ReactNode }) {
  return (
    <Svg width="100%" height={190} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={0} y={0} width={W} height={H} fill={colors.pitch} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Rect key={i} x={0} y={i * 30} width={W} height={15} fill="#ffffff07" />
      ))}
      {children}
    </Svg>
  );
}


type Lane = -1 | 0 | 1;
const LANES: Lane[] = [-1, 0, 1];
const laneX = (l: Lane) => W / 2 + l * 95;

// Read the pass. The passer looks up, shapes his body toward one of three
// team-mates, then plays it. Step into the right lane before the ball is
// past you. Guessing early works if you guess right; better vision gives
// a longer look at his body shape.
export function InterceptGame({ vision, onDone }: { vision: number; onDone: (q: number, text: string) => void }) {
  const [setup] = useState(() => ({ look: 0.7 + Math.random() * 0.8, lane: LANES[Math.floor(Math.random() * 3)] }));
  const lead = 0.15 + (vision / 99) * 0.6;
  const FLIGHT = 0.55;
  const { done, finish } = useFinish(onDone);
  const [picked, setPicked] = useState<Lane | null>(null);
  // Keeps running after the pick so the ball plays out.
  const t = useTicker(true);
  const release = setup.look + lead;
  const flying = t >= release;
  // The ball is level with the user at this share of its flight.
  const MEET = 0.42;
  const k = flying ? Math.min(1, (t - release) / FLIGHT) : 0;

  const pick = (l: Lane) => {
    if (done || picked !== null) return;
    setPicked(l);
    if (l !== setup.lane) return finish(0.05, 'Wrong lane. He played it the other way.');
    if (t < setup.look) return finish(0.6, 'Gambled and guessed right!');
    const q = Math.max(0.4, Math.min(1, 1 - (t - setup.look) / (lead + FLIGHT * MEET) + 0.3));
    finish(q, q > 0.8 ? 'Read it like a book!' : 'Just in time!');
  };

  useEffect(() => {
    if (!done && flying && k > MEET && picked === null) setTimeout(() => finish(0.06, 'Too late. The pass is through.'), 0);
  });

  const passer = { x: W / 2, y: 160 };
  const target = { x: laneX(setup.lane), y: 34 };
  const userX = picked === null ? W / 2 : laneX(picked);
  const userY = 98;
  const stopped = picked === setup.lane && k >= MEET;
  const kk = stopped ? MEET : k;
  const ballX = passer.x + (target.x - passer.x) * kk;
  const ballY = passer.y - 10 + (target.y - passer.y + 10) * kk;
  // The tell: an arrow from the passer toward the lane he is about to use.
  const looking = t >= setup.look && !flying;
  return (
    <View>
      <Turf>
        {LANES.map((l) => (
          <Line key={l} x1={passer.x} y1={passer.y} x2={laneX(l)} y2={34} stroke="#ffffff30" strokeWidth={2} strokeDasharray="6 6" />
        ))}
        {LANES.map((l) => (
          <Person key={l} side="opp" x={laneX(l)} y={26} />
        ))}
        {looking && <Line x1={passer.x} y1={passer.y} x2={passer.x + (target.x - passer.x) * 0.22} y2={passer.y + (target.y - passer.y) * 0.22} stroke={LINE} strokeWidth={4} strokeLinecap="round" />}
        <Person side="opp" x={passer.x} y={passer.y - 8} h={38} />
        <Person side="own" me x={userX} y={userY - 8} h={38} />
        <Football cx={flying ? ballX : passer.x} cy={flying ? ballY : passer.y - 14} r={7} rot={flying ? (ballX + ballY) * 9 : 0} />
      </Turf>
      <T bold style={{ textAlign: 'center', marginVertical: 8 }}>
        {done ?? (flying ? 'He plays it!' : looking ? 'Watch his body shape...' : 'He looks up...')}
      </T>
      <Row>
        <Button label="Left" icon="arrow-back" style={{ flex: 1 }} variant="secondary" disabled={!!done} onPress={() => pick(-1)} />
        <Button label="Middle" icon="arrow-up" style={{ flex: 1 }} variant="secondary" disabled={!!done} onPress={() => pick(0)} />
        <Button label="Right" icon="arrow-forward" style={{ flex: 1 }} variant="secondary" disabled={!!done} onPress={() => pick(1)} />
      </Row>
    </View>
  );
}

// Block the shot. The ring round the shooter closes as he winds up; slide
// in as it closes. Too early and he steps round you; too late and the
// ball is past. Defending widens the window.
export function BlockGame({ defending, onDone }: { defending: number; onDone: (q: number, text: string) => void }) {
  const [setup] = useState(() => ({ strike: 1.1 + Math.random() * 0.8, side: Math.random() < 0.5 ? -1 : 1 }));
  const WINDOW = 0.08 + (defending / 99) * 0.26;
  const { done, finish } = useFinish(onDone);
  const [slid, setSlid] = useState<number | null>(null);
  const t = useTicker(true);
  const struck = t >= setup.strike;
  const k = struck ? Math.min(1, (t - setup.strike) / 0.5) : 0;

  const slide = () => {
    if (done || slid !== null) return;
    setSlid(t);
    const dt = t - setup.strike;
    if (dt < -WINDOW) return finish(0.05, 'Went to ground too early. He steps round you.');
    if (dt > WINDOW) return finish(0.06, 'Too late. It is past you.');
    const q = Math.max(0.45, 1 - Math.abs(dt) / WINDOW + 0.25);
    finish(Math.min(1, q), q > 0.85 ? 'Perfectly timed block!' : 'You get a toe to it!');
  };

  useEffect(() => {
    if (!done && struck && t - setup.strike > WINDOW && slid === null) setTimeout(() => finish(0.05, 'Too late. It is past you.'), 0);
  });

  const shooter = { x: W / 2 + setup.side * 30, y: 150 };
  const user = { x: W / 2 + setup.side * 12, y: 95 };
  const goalY = 12;
  // The ring closes to the shooter's feet at the moment he strikes.
  const ring = Math.max(10, 46 - (t / setup.strike) * 36);
  const blocked = slid !== null && Math.abs(slid - setup.strike) <= WINDOW && slid - setup.strike >= -WINDOW;
  const stopAt = (shooter.y - user.y) / (shooter.y - goalY);
  const kk = blocked ? Math.min(k, stopAt) : k;
  let ballX = shooter.x + (W / 2 - setup.side * 40 - shooter.x) * kk;
  let ballY = shooter.y - 12 - (shooter.y - 12 - goalY) * kk;
  if (blocked && k > stopAt) {
    // Off his body and away for a corner.
    const out = (k - stopAt) / (1 - stopAt);
    ballX += setup.side * 90 * out;
    ballY += 10 * out;
  }
  const sliding = slid !== null;
  return (
    <View>
      <Turf>
        <Rect x={W / 2 - 60} y={2} width={120} height={10} fill="none" stroke="#ffffff" strokeWidth={3} />
        <Line x1={0} y1={goalY + 30} x2={W} y2={goalY + 30} stroke={colors.pitchLine} strokeWidth={2} />
        {!struck && <Circle cx={shooter.x} cy={shooter.y} r={ring} fill="none" stroke={ring < 16 ? colors.gold : '#ffffff80'} strokeWidth={3} />}
        <Person side="opp" x={shooter.x} y={shooter.y - 8} h={38} />
        <Person side="own" me x={user.x} y={user.y - 8} h={38} pose={sliding ? slidePose(setup.side < 0 ? 1 : -1) : undefined} />
        <Football cx={ballX} cy={ballY} r={7} rot={(ballX + ballY) * 9} />
      </Turf>
      <T bold style={{ textAlign: 'center', marginVertical: 8 }}>
        {done ?? (struck ? 'He shoots!' : 'Slide as the ring closes!')}
      </T>
      <Button label="Slide in" icon="flash" disabled={!!done} onPress={slide} />
    </View>
  );
}

// Head it clear. The cross floats in; its shadow runs to the ring at your
// feet. Jump as the ball drops onto the ring. Height and strength give a
// longer window, and a big attacker shortens it.
export function ClearGame({ air, onDone }: { air: number; onDone: (q: number, text: string) => void }) {
  const [setup] = useState(() => ({ flight: 1.3 + Math.random() * 0.5, from: Math.random() < 0.5 ? -1 : 1 }));
  const WINDOW = 0.07 + Math.max(0, Math.min(1, air / 99)) * 0.23;
  const { done, finish } = useFinish(onDone);
  const [jumped, setJumped] = useState<number | null>(null);
  const t = useTicker(true);
  const k = Math.min(1.2, t / setup.flight);

  const jump = () => {
    if (done || jumped !== null) return;
    setJumped(t);
    const dt = t - setup.flight;
    if (dt < -WINDOW) return finish(0.08, 'Jumped too soon. It sails over you.');
    if (dt > WINDOW) return finish(0.08, 'Too late. He gets there first.');
    const q = Math.max(0.45, 1 - Math.abs(dt) / WINDOW + 0.25);
    finish(Math.min(1, q), q > 0.85 ? 'Towering header! Cleared.' : 'You get your head to it!');
  };

  useEffect(() => {
    if (!done && t - setup.flight > WINDOW && jumped === null) setTimeout(() => finish(0.08, 'Too late. He gets there first.'), 0);
  });

  const start = { x: W / 2 + setup.from * 140, y: 60 };
  const spot = { x: W / 2 - setup.from * 10, y: 70 };
  const won = jumped !== null && Math.abs(jumped - setup.flight) <= WINDOW;
  const kk = Math.min(1, k);
  const groundX = start.x + (spot.x - start.x) * kk;
  const groundY = start.y + (spot.y - start.y) * kk;
  // Height of the ball above its shadow: up and down in an arc.
  const z = Math.sin(Math.PI * kk) * 38;
  let bx = groundX;
  let by = groundY - z;
  if (won && t > setup.flight) {
    // Headed away up the pitch.
    const out = Math.min(1, (t - setup.flight) / 0.5);
    bx = spot.x + setup.from * 50 * out;
    by = spot.y + 100 * out - Math.sin(Math.PI * out) * 30;
  }
  const up = jumped !== null && t - jumped < 0.4 ? Math.sin(((t - jumped) / 0.4) * Math.PI) * 8 : 0;
  return (
    <View>
      <Turf>
        <Rect x={W / 2 - 60} y={2} width={120} height={10} fill="none" stroke="#ffffff" strokeWidth={3} />
        <Rect x={W / 2 - 110} y={12} width={220} height={78} fill="none" stroke={colors.pitchLine} strokeWidth={2} />
        <Circle cx={spot.x} cy={spot.y} r={14} fill="none" stroke={colors.gold} strokeWidth={2.5} strokeDasharray="4 4" />
        <Person side="opp" x={spot.x + 18} y={spot.y - 12} h={38} />
        <Person side="own" me x={spot.x} y={spot.y - 10} h={38} pose={up > 0 ? jumpPose(up / 8) : undefined} lift={up} />
        <Ellipse cx={groundX} cy={groundY + 4} rx={5} ry={2.5} fill="#00000055" />
        <Football cx={bx} cy={by} r={7 + z / 14} rot={(bx + by) * 9} />
      </Turf>
      <T bold style={{ textAlign: 'center', marginVertical: 8 }}>
        {done ?? 'Jump as the ball drops onto the ring!'}
      </T>
      <Button label="Jump" icon="arrow-up-circle" disabled={!!done} onPress={jump} />
    </View>
  );
}
