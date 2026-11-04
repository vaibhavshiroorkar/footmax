import React, { createContext, memo, useContext } from 'react';
import { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { PoseInput, Pt, solve } from './skeleton';
import { stand } from './poses';
import { colors } from '../theme';

export interface Looks {
  kit: string;
  shorts?: string;
  socks?: string;
  skin?: string;
  hair?: string | null;
  boots?: string;
  // Keepers: big gloves in place of hands.
  gloves?: boolean;
}

const TRIM = '#111827';

// One person from a pose, standing on `ground` at `x`, about `h` units tall.
// lift raises him off the grass while his shadow stays on it.
// turn: degrees, about his middle, for a flip. back: seen from behind, facing
// the same way as the camera.
export function RigFigure({ x, ground, h = 60, pose = stand(), lift = 0, turn = 0, back = false, kit, shorts = TRIM, socks, skin = '#d9a77c', hair = '#2a1d14', boots = '#0f172a', gloves = false }: { x: number; ground: number; h?: number; pose?: PoseInput; lift?: number; turn?: number; back?: boolean } & Looks) {
  const s = solve(pose);
  const sock = socks ?? kit;
  const bone = (a: Pt, b: Pt, stroke: string, w: number) => <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={w} strokeLinecap="round" />;
  const half = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const torso = `M ${s.shoulderL.x} ${s.shoulderL.y} L ${s.shoulderR.x} ${s.shoulderR.y} L ${s.hipR.x + 2} ${s.hipR.y} L ${s.hipL.x - 2} ${s.hipL.y} Z`;
  const hand = (p: Pt) => (gloves ? <Circle cx={p.x} cy={p.y} r={5} fill="#f8fafc" stroke={TRIM} strokeWidth={1} /> : <Circle cx={p.x} cy={p.y} r={2.8} fill={skin} />);
  const scale = h / 60;
  return (
    <G transform={`translate(${x} ${ground}) scale(${scale})`}>
      <Ellipse cx={s.hip.x} cy={0} rx={15} ry={3} fill="#000000" opacity={0.26} />
      <G transform={`translate(0 ${-lift}) rotate(${turn} 0 -30)`}>
        {bone(s.hipL, s.legL.mid, shorts, 7.5)}
        {bone(s.hipR, s.legR.mid, shorts, 7.5)}
        {bone(s.legL.mid, s.legL.end, sock, 6)}
        {bone(s.legR.mid, s.legR.end, sock, 6)}
        {bone(s.legL.end, { x: s.legL.end.x - 4, y: s.legL.end.y + 0.5 }, boots, 4.5)}
        {bone(s.legR.end, { x: s.legR.end.x + 4, y: s.legR.end.y + 0.5 }, boots, 4.5)}
        <Path d={torso} fill={kit} stroke={kit} strokeWidth={5} strokeLinejoin="round" />
        {bone(s.shoulderL, s.armL.mid, kit, 5.5)}
        {bone(s.shoulderR, s.armR.mid, kit, 5.5)}
        {bone(s.armL.mid, s.armL.end, gloves ? kit : skin, 4.5)}
        {bone(s.armR.mid, s.armR.end, gloves ? kit : skin, 4.5)}
        {hand(s.armL.end)}
        {hand(s.armR.end)}
        {bone(s.neck, half(s.neck, s.head), skin, 5)}
        <Circle cx={s.head.x} cy={s.head.y} r={6.3} fill={back && hair ? hair : skin} />
        {!back && (
          <>
            <Circle cx={s.head.x - 2.2} cy={s.head.y} r={0.9} fill="#1f2937" />
            <Circle cx={s.head.x + 2.2} cy={s.head.y} r={0.9} fill="#1f2937" />
          </>
        )}
        {!back && hair && <Path d={`M ${s.head.x - 6.3} ${s.head.y - 1} Q ${s.head.x - 6} ${s.head.y - 8} ${s.head.x} ${s.head.y - 8} Q ${s.head.x + 6} ${s.head.y - 8} ${s.head.x + 6.3} ${s.head.y - 1} Q ${s.head.x + 3} ${s.head.y - 4} ${s.head.x} ${s.head.y - 4} Q ${s.head.x - 3} ${s.head.y - 4} ${s.head.x - 6.3} ${s.head.y - 1} Z`} fill={hair} />}
      </G>
    </G>
  );
}

// The referee: all black with a yellow trim. A card, when shown, is in his
// raised hand.
export function RefereeFigure({ x, ground, h = 60, pose = stand(), card }: { x: number; ground: number; h?: number; pose?: PoseInput; card?: 'yellow' | 'red' }) {
  const s = solve(pose);
  const up = s.armL.end.y < s.armR.end.y ? s.armL.end : s.armR.end;
  const scale = h / 60;
  return (
    <G>
      <RigFigure x={x} ground={ground} h={h} pose={pose} kit="#141414" shorts="#0a0a0a" socks="#141414" skin="#c98f64" hair="#3a2a1d" boots="#0a0a0a" />
      <G transform={`translate(${x} ${ground}) scale(${scale})`}>
        <Line x1={s.shoulderL.x} y1={s.shoulderL.y + 1} x2={s.shoulderR.x} y2={s.shoulderR.y + 1} stroke="#e8f53b" strokeWidth={2} strokeLinecap="round" />
        {card && <Rect x={up.x - 5} y={up.y - 17} width={10} height={14} rx={1.4} fill={card === 'red' ? '#e5322d' : '#f6d32d'} stroke="#ffffff" strokeWidth={0.8} />}
      </G>
    </G>
  );
}

// Who is wearing what in this match, for every scene.
export interface MatchLooks {
  own: string;
  opp: string;
  ownKeeper: string;
  oppKeeper: string;
  // The user's own player, when there is one.
  me?: { skin: string; hair: string | null; boots: string };
}

export const LooksContext = createContext<MatchLooks>({ own: colors.gold, opp: '#d94b4b', ownKeeper: '#22c55e', oppKeeper: '#f97316' });

export const useLooks = () => useContext(LooksContext);

// A player in a top-down scene. x and y are where the old circle sat; the
// figure stands on that spot.
// Memoised: scenes redraw every frame, and most people in them stand still.
// Your side attacks up the screen, so you see their backs; the other side faces you.
export const Person = memo(function Person({ x, y, side, me = false, h = 34, pose, lift = 0, opacity }: { x: number; y: number; side: 'own' | 'opp'; me?: boolean; h?: number; pose?: PoseInput; lift?: number; opacity?: number }) {
  const looks = useLooks();
  const you = me ? looks.me : undefined;
  return (
    <G opacity={opacity}>
      <RigFigure x={x} ground={y + h * 0.3} h={h} pose={pose} lift={lift} back={side === 'own'} kit={side === 'own' ? looks.own : looks.opp} skin={you?.skin} hair={you ? you.hair : undefined} boots={you?.boots} />
    </G>
  );
});
