import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { PitchSim } from '../../engine/matchRuntime/pitch';
import { ShotAttempt } from '../../engine/matchRuntime/shot';
import { project, shotCamera } from '../../engine/matchRuntime/camera';
import { Player } from '../../engine/types';
import { Football } from '../football';
import { RigFigure, useLooks } from '../rig/Figure';
import { kick, ready, run, stand } from '../rig/poses';
import { colors, fonts } from '../theme';
import { useTicker } from './useTicker';

export function RuntimeShotGame({ sim, actor, shooting, weakFoot, onSubmit, onFinish, onPass }: {
  sim: PitchSim; actor: Player; shooting: number; weakFoot: boolean;
  onSubmit: (attempt: Omit<ShotAttempt, 'direction'>) => boolean;
  onFinish: () => void;
  onPass?: () => void;
}) {
  const [phase, setPhase] = useState<'aim' | 'power' | 'flight'>('aim');
  const [aim, setAim] = useState(0);
  const [shape, setShape] = useState<ShotAttempt['shape']>('driven');
  const [error, setError] = useState('');
  const committed = useRef(false);
  const finish = useRef(onFinish);
  useEffect(() => { finish.current = onFinish; }, [onFinish]);
  const time = useTicker(true, phase);
  const looks = useLooks();
  const side = sim.bodies.get(actor.id)!.side;
  const direction = side === 'home' ? 1 : -1;
  const [camera] = useState(() => shotCamera(sim.ball, direction, 320, 220));
  const marker = phase === 'aim' ? Math.sin(time * (2.4 + (1 - actor.attrs.composure / 99) * 2)) * 1.15 : aim;
  const power = Math.min(1, time / (0.7 + shooting / 99 * 0.4)) ** 1.7;
  const outcome = sim.physicalShot?.outcome;
  useEffect(() => {
    if (!outcome || committed.current) return;
    const timer = setTimeout(() => { committed.current = true; finish.current(); }, 850);
    return () => clearTimeout(timer);
  }, [outcome]);
  const submit = () => {
    const nearest = sim.active().filter((body) => body.side !== side && body.pos !== 'GK').reduce((distance, body) => Math.min(distance, Math.hypot(body.x - sim.ball.x, body.y - sim.ball.y)), Infinity);
    if (onSubmit({ actorId: actor.id, aim, power, timing: (power - 0.7) / 0.3, shooting, weakFoot, pressure: Math.max(0, 1 - nearest / 5), shape })) {
      setPhase('flight');
      setError('');
    } else setError('The chance has changed. Choose another action.');
  };
  const point = (x: number, y: number, z = 0) => project(camera, { x, y, z });
  const goalY = direction > 0 ? 105 : 0;
  const segment = (key: string, ax: number, ay: number, az: number, bx: number, by: number, bz: number, stroke = '#ffffff') => {
    const a = point(ax, ay, az); const b = point(bx, by, bz);
    return a && b ? <Line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={1.5} /> : null;
  };
  const ball = point(sim.ball.x, sim.ball.y, sim.ball.z + 0.11);
  const target = point(34 + direction * marker * 3.66, goalY, 1);
  const bodies = sim.active().map((body) => ({ body, point: point(body.x, body.y) })).filter((item) => item.point !== null).sort((a, b) => b.point!.depth - a.point!.depth);
  // The ball shares the players' projection and depth order, so nearby bodies can occlude it.
  const figures = bodies.map(({ body, point: p }) => ({ depth: p!.depth, key: body.id, node: <RigFigure x={p!.x} ground={p!.y} h={(body.id === actor.id ? actor.heightCm ?? 180 : 180) / 100 * p!.scale} kit={body.pos === 'GK' ? body.side === side ? looks.ownKeeper : looks.oppKeeper : body.side === side ? looks.own : looks.opp} gloves={body.pos === 'GK'} back={body.side === side} pose={body.id === actor.id && phase === 'flight' ? kick(actor.foot ?? 'R', Math.min(1, (sim.physicalShot?.elapsed ?? 0) * 4)) : body.pos === 'GK' ? ready() : Math.hypot(body.vx, body.vy) > 0.5 ? run(sim.clock * 8) : stand()} /> }));
  if (ball) figures.push({ depth: ball.depth, key: 'ball', node: <Football cx={ball.x} cy={ball.y} r={0.11 * ball.scale} rot={sim.ball.rot} /> });
  figures.sort((a, b) => b.depth - a.depth);
  return <View style={{ gap: 10 }}>
    <Svg width="100%" height={220} viewBox="0 0 320 220" style={{ backgroundColor: '#246342', borderRadius: 10 }}>
      <Rect x={0} y={0} width={320} height={44} fill="#152d2a" />
      {segment('line', 0, goalY, 0, 68, goalY, 0, '#a8c8b0')}
      {segment('left', 30.34, goalY, 0, 30.34, goalY, 2.44)}
      {segment('right', 37.66, goalY, 0, 37.66, goalY, 2.44)}
      {segment('bar', 30.34, goalY, 2.44, 37.66, goalY, 2.44)}
      {figures.map((figure) => <React.Fragment key={figure.key}>{figure.node}</React.Fragment>)}
      {phase !== 'flight' && target && <Circle cx={target.x} cy={target.y} r={5} stroke={colors.gold} strokeWidth={2} fill="none" />}
    </Svg>
    {phase !== 'flight' && <View style={{ flexDirection: 'row', gap: 8 }}>{(['driven', 'curl', 'low'] as const).map((item) => <Pressable key={item} onPress={() => setShape(item)} accessibilityRole="button" accessibilityState={{ selected: shape === item }} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: shape === item ? colors.accent : colors.bgElev }}><Text style={{ textAlign: 'center', fontFamily: fonts.bold, color: shape === item ? colors.ink : colors.text }}>{item === 'driven' ? 'Drive' : item === 'curl' ? 'Curl' : 'Low'}</Text></Pressable>)}</View>}
    {phase === 'power' && <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.bgElev }}><View style={{ width: `${power * 100}%`, height: 12, borderRadius: 6, backgroundColor: power > 0.85 ? colors.orange : colors.accent }} /></View>}
    {phase !== 'flight' && <Pressable accessibilityRole="button" onPress={() => { if (phase === 'aim') { setAim(marker); setPhase('power'); } else submit(); }} style={{ backgroundColor: colors.accent, padding: 14, borderRadius: 10 }}><Text style={{ textAlign: 'center', color: colors.ink, fontFamily: fonts.bold }}>{phase === 'aim' ? 'Set aim' : 'Shoot'}</Text></Pressable>}
    {phase !== 'flight' && onPass && <Pressable accessibilityRole="button" onPress={onPass} style={{ padding: 10 }}><Text style={{ textAlign: 'center', color: colors.accent, fontFamily: fonts.bold }}>Pass instead</Text></Pressable>}
    {!!outcome && <Text style={{ textAlign: 'center', color: colors.text, fontFamily: fonts.bold }}>{outcome.kind === 'goal' ? 'Goal!' : outcome.kind === 'save' ? 'Saved!' : outcome.kind === 'block' ? 'Blocked!' : outcome.kind === 'woodwork' ? 'Off the woodwork!' : 'Off target'}</Text>}
    {!!error && <Text style={{ color: colors.orange }}>{error}</Text>}
  </View>;
}
