import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { Club, Player, World } from '../engine/types';
import { MatchState, SideKey } from '../engine/match';
import { POSITIONS, teamById } from '../engine/lineup';
import { colors } from './theme';

const W = 320;
const H = 200;

// Spots for a side's players, from its formation. Depth runs from the
// side's own goal (0) to the opponent's (1); the shape slides with the ball.
function shape(world: World, team: Club, ids: string[], ballDepth: number): { id: string; depth: number; lat: number }[] {
  const players = ids.map((id) => world.players[id]).filter(Boolean) as Player[];
  const sorted = [...players].sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position));
  const outfield = sorted.filter((p) => p.position !== 'GK');
  const rows = team.formation.split('-').map(Number);
  const out: { id: string; depth: number; lat: number }[] = [];
  const keeper = sorted.find((p) => p.position === 'GK');
  if (keeper) out.push({ id: keeper.id, depth: 0.04, lat: 0.5 });
  const shift = (ballDepth - 0.5) * 0.18;
  let i = 0;
  rows.forEach((n, r) => {
    const depth = 0.2 + (0.58 * r) / Math.max(1, rows.length - 1) + shift;
    for (let k = 0; k < n && i < outfield.length; k++, i++) out.push({ id: outfield[i].id, depth, lat: (k + 1) / (n + 1) });
  });
  // Anyone left over (after a red card the shape still fits).
  while (i < outfield.length) out.push({ id: outfield[i++].id, depth: 0.5, lat: 0.5 });
  return out;
}

function Dot({ x, y, fill, ring, size, duration }: { x: number; y: number; fill: string; ring: string; size: number; duration: number }) {
  const pos = useState(() => new Animated.ValueXY({ x, y }))[0];
  useEffect(() => {
    Animated.timing(pos, { toValue: { x, y }, duration, useNativeDriver: false }).start();
  }, [x, y, duration, pos]);
  return <Animated.View style={{ position: 'absolute', left: pos.x, top: pos.y, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, borderRadius: size / 2, backgroundColor: fill, borderWidth: 2, borderColor: ring }} />;
}

export function LivePitch({ world, live, focusId, tickMs, width }: { world: World; live: MatchState; focusId?: string; tickMs: number; width: number }) {
  const scale = width / W;
  const h = H * scale;
  const home = teamById(world, live.home.clubId);
  const away = teamById(world, live.away.clubId);
  const dur = Math.max(120, tickMs * 0.9);
  const kit = (c: Club) => (c.colors[0] === '#ffffff' ? '#e8e8e8' : c.colors[0]);
  // Home attacks left to right.
  const toXY = (side: SideKey, depth: number, lat: number) => ({
    x: (side === 'home' ? depth : 1 - depth) * width,
    y: (side === 'home' ? lat : 1 - lat) * h,
  });
  const ball = { x: live.ball.y * width, y: live.ball.x * h };
  const dots: { key: string; x: number; y: number; fill: string; ring: string; size: number }[] = [];
  for (const side of ['home', 'away'] as SideKey[]) {
    const team = side === 'home' ? home : away;
    const ballDepth = side === 'home' ? live.ball.y : 1 - live.ball.y;
    const spots = shape(world, team, live[side].onPitch, ballDepth).map((s) => ({ s, ...toXY(side, s.depth, s.lat) }));
    // The two outfield players nearest the ball close it down; the side in
    // possession gets right on it.
    const chasers = spots
      .filter((d) => world.players[d.s.id]?.position !== 'GK')
      .map((d) => ({ id: d.s.id, dist: Math.hypot(d.x - ball.x, d.y - ball.y) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2)
      .map((d) => d.id);
    const pull = (id: string) => (chasers[0] === id ? 0.8 : chasers[1] === id ? 0.45 : 0);
    for (const d of spots) {
      const k = pull(d.s.id);
      const me = d.s.id === focusId;
      dots.push({ key: d.s.id, x: d.x + (ball.x - d.x) * k + (k ? (side === 'home' ? -6 : 6) : 0), y: d.y + (ball.y - d.y) * k, fill: kit(team), ring: me ? colors.gold : team.colors[1], size: me ? 16 : 12 });
    }
  }
  return (
    <View style={{ width, height: h, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
      <Svg width={width} height={h} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
        {Array.from({ length: 8 }, (_, i) => (
          <Rect key={i} x={i * 40} y={0} width={40} height={H} fill={i % 2 ? colors.pitch : colors.pitchDark} />
        ))}
        <Rect x={6} y={6} width={W - 12} height={H - 12} stroke="#fff" strokeOpacity={0.4} strokeWidth={1.5} fill="none" />
        <Line x1={W / 2} y1={6} x2={W / 2} y2={H - 6} stroke="#fff" strokeOpacity={0.4} strokeWidth={1.5} />
        <Circle cx={W / 2} cy={H / 2} r={24} stroke="#fff" strokeOpacity={0.4} strokeWidth={1.5} fill="none" />
        <Rect x={6} y={60} width={34} height={80} stroke="#fff" strokeOpacity={0.4} strokeWidth={1.5} fill="none" />
        <Rect x={W - 40} y={60} width={34} height={80} stroke="#fff" strokeOpacity={0.4} strokeWidth={1.5} fill="none" />
        <Rect x={0} y={85} width={6} height={30} fill="#fff" fillOpacity={0.5} />
        <Rect x={W - 6} y={85} width={6} height={30} fill="#fff" fillOpacity={0.5} />
      </Svg>
      {dots.map((d) => (
        <Dot key={d.key} x={d.x} y={d.y} fill={d.fill} ring={d.ring} size={d.size} duration={dur} />
      ))}
      <Dot x={ball.x} y={ball.y} fill="rgba(255,255,255,0.35)" ring="transparent" size={14} duration={dur * 1.6} />
      <Dot x={ball.x} y={ball.y} fill="#ffffff" ring="#111111" size={10} duration={dur} />
    </View>
  );
}

