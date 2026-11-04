import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { useTicker } from '../moments/useTicker';
import { Football } from '../football';
import { KeeperFigure } from '../moments/Keeper';
import { Person, RefereeFigure, useLooks } from '../rig/Figure';
import { point, run as runPose, spread } from '../rig/poses';
import { colors, fonts } from '../theme';
import { motionReduced } from '../../state/settings';

const W = 300;
const H = 190;
const LENGTH = 2.6;

export type SetPiece = 'penalty' | 'freekick' | 'corner';

const ease = (v: number) => Math.max(0, Math.min(1, v));

// The short scene before a set piece: the players take their places as the
// laws say, then the user takes over with no clock on the decision.
export function SetPieceIntro({ kind, line, wall = 4, onDone }: { kind: SetPiece; line: string; wall?: number; onDone: () => void }) {
  const looks = useLooks();
  const t = useTicker(true);
  const k = ease(t / (LENGTH - 0.6));
  const sent = useRef(false);
  const finish = () => {
    if (sent.current) return;
    sent.current = true;
    onDone();
  };
  useEffect(() => {
    if (t >= (motionReduced() ? 0.9 : LENGTH)) setTimeout(finish, 0);
  });
  const walking = k < 1;

  return (
    <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Skip the scene">
      <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.pitch }}>
        <Svg width="100%" height={210} viewBox={`0 0 ${W} ${H}`}>
          <Rect x={0} y={0} width={W} height={H} fill={colors.pitch} />
          {kind === 'corner' ? (
            <>
              {/* The box from the corner: the flag near us, the goal across. */}
              <Rect x={70} y={14} width={160} height={30} stroke="#ffffff" strokeWidth={3} fill="#ffffff10" />
              <Line x1={0} y1={44} x2={W} y2={44} stroke={colors.pitchLine} strokeWidth={2} />
              <Rect x={36} y={44} width={228} height={92} stroke={colors.pitchLine} strokeWidth={1.5} fill="none" />
              <KeeperFigure x={150} ground={44} h={40} kit={looks.oppKeeper} />
              {[80, 108, 136, 164, 192, 220].map((x, i) => (
                <React.Fragment key={x}>
                  <Person side="opp" x={x + Math.sin(t * 3 + i) * 3} y={78 + (i % 2) * 22} h={38} />
                  <Person side="own" x={x + 9 + Math.sin(t * 4 + i * 2) * 5} y={82 + (i % 2) * 22} h={38} />
                </React.Fragment>
              ))}
              <Path d="M 12 180 L 12 150 L 26 156 L 12 162" stroke="#facc15" strokeWidth={2} fill="#facc15" />
              <Person side="own" x={34} y={160} h={40} />
              <Football cx={20} cy={180} r={5} />
            </>
          ) : (
            <>
              <Rect x={70} y={14} width={160} height={52} stroke="#ffffff" strokeWidth={3} fill="#ffffff10" />
              <Line x1={0} y1={66} x2={W} y2={66} stroke={colors.pitchLine} strokeWidth={2} />
              <KeeperFigure x={150} ground={66} h={46} kit={looks.oppKeeper} />
              {kind === 'penalty' ? (
                <>
                  {/* Out of the box they go, and wait on its edge. */}
                  <Line x1={0} y1={128} x2={W} y2={128} stroke={colors.pitchLine} strokeWidth={2} />
                  {[20, 52, 84, 216, 248, 280].map((x, i) => (
                    <Person key={x} side={i % 2 ? 'own' : 'opp'} x={x} y={150 - (1 - k) * 60} h={36} pose={walking ? runPose(t * 9 + i) : undefined} />
                  ))}
                  <RefereeFigure x={232} ground={126} h={46} pose={point(-1)} />
                  <Football cx={150} cy={140} r={5.5} />
                  <Person side="own" me x={150} y={158 + (1 - k) * 8} h={46} />
                </>
              ) : (
                <>
                  {/* The wall forms at 9.15 m while the referee marks it. */}
                  {Array.from({ length: wall }, (_, i) => (
                    <Person key={i} side="opp" x={118 + i * 22 + (1 - k) * (i < 2 ? -90 : 90)} y={100} h={46} pose={walking ? runPose(t * 10 + i) : spread(14)} />
                  ))}
                  <Line x1={100} y1={132} x2={100 + k * 110} y2={132} stroke="#ffffff" strokeWidth={2} strokeDasharray="2 3" />
                  <RefereeFigure x={100 + k * 110} ground={138} h={44} />
                  <Football cx={150} cy={172} r={6} />
                  <Person side="own" me x={126} y={158} h={46} />
                </>
              )}
            </>
          )}
        </Svg>
      </View>
      <View style={{ paddingVertical: 8, gap: 2 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text, textAlign: 'center' }} numberOfLines={1}>
          {line}
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textAlign: 'center' }}>Tap to skip</Text>
      </View>
    </Pressable>
  );
}
