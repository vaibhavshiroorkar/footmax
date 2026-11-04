import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Ellipse, Line, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { KeeperFigure } from './Keeper';
import { ShotOutcome } from './ShotGame';
import { T } from '../kit';
import { alpha, colors, fonts } from '../theme';
import { Football } from '../football';
import { Person, useLooks } from '../rig/Figure';
import { jump as jumpPose, run as runPose } from '../rig/poses';
import { ShotEnd, ShotRun, flyShot, judgeHeader } from '../../engine/contact';

const W = 300;
const H = 170;
const GOAL = { x: 60, y: 10, w: 180, h: 62 };
// Where a run ends, across the picture.
const LANES = [108, 150, 192];
const LANE_NAMES = ['Near post', 'Penalty spot', 'Far post'];
const SWING = 1.75;

type Played = { aim: number; shape: 'driven'; over?: boolean; end?: ShotEnd };

// A header in three parts. Pick your run while the ball is in the air. Then one
// tap does the rest: when you tap times the jump, and where you tap on the goal
// aims it. A marker goes up with you, so a poor jump loses him the ball.
export function HeaderGame({ air, from = 'cross', keeper = 60, onDone }: { air: number; from?: 'cross' | 'corner'; keeper?: number; onDone: (q: number, text: string, outcome: ShotOutcome, played: Played) => void }) {
  const looks = useLooks();
  const [setup] = useState(() => ({ lane: [0, 1, 1, 2][Math.floor(Math.random() * 4)], left: Math.random() < 0.5, marker: 0.35 + Math.random() * 0.35 }));
  const [lane, setLane] = useState<number | null>(null);
  const [hit, setHit] = useState<{ at: number; aim: number; text: string; q: number; outcome: ShotOutcome; run?: ShotRun; end?: ShotEnd } | null>(null);
  const t = useTicker(true);
  const sent = useRef(false);
  const boxWidth = useRef(W);
  const k = Math.min(1.25, t / SWING);
  const window = 0.05 + (Math.max(0, Math.min(99, air)) / 99) * 0.08;
  const myLane = lane ?? 1;
  const myX = LANES[myLane];
  const targetX = LANES[setup.lane];
  // The ball, from the flag or the wing to head height.
  const startX = setup.left ? 8 : W - 8;
  const swingAt = (kk: number) => ({ x: startX + (targetX - startX) * kk, y: (from === 'corner' ? 18 : 62) + (98 - (from === 'corner' ? 18 : 62)) * kk - Math.sin(Math.PI * kk) * 34 });

  const finish = (q: number, text: string, outcome: ShotOutcome, played: Played) => {
    if (sent.current) return;
    sent.current = true;
    setTimeout(() => onDone(q, text, outcome, played), 1500);
  };

  const tap = (px: number) => {
    if (hit || lane === null) return;
    const aim = px < W / 3 ? 0.2 : px > (2 * W) / 3 ? 0.8 : 0.5;
    const r = judgeHeader({ timing: Math.abs(k - 1), window, rightLane: lane === setup.lane, air, marker: setup.marker, rand: Math.random });
    if (!r.contact) {
      setHit({ at: t, aim, text: r.text, q: 0.08, outcome: 'miss' });
      return finish(0.08, r.text, 'miss', { aim: 1.2, shape: 'driven', over: true });
    }
    const stray = (Math.random() - 0.5) * (1 - r.quality) * 0.5;
    const placed = aim + stray;
    const run = flyShot({ aim: placed, height: 0.2 + Math.random() * 0.5 + (1 - r.quality) * 0.5, flight: 0.5 + (1 - r.quality) * 0.25, keeper: { at: 0.5, skill: keeper }, rand: Math.random });
    const text = run.outcome === 'goal' ? 'Bullet header! In!' : run.outcome === 'save' ? 'He gets to it!' : run.end === 'post' || run.end === 'bar' ? 'Off the woodwork!' : 'Over the bar.';
    setHit({ at: t, aim: placed, text, q: r.quality, outcome: run.outcome, run, end: run.end });
    finish(run.outcome === 'goal' ? Math.max(0.7, r.quality) : r.quality * 0.5, text, run.outcome, { aim: placed, shape: 'driven', over: run.end === 'over', end: run.end });
  };

  // No tap at all: the ball goes by.
  useEffect(() => {
    if (!hit && k >= 1.2) {
      const text = lane === null ? 'You never moved. It goes through.' : 'Too late. It flies past you.';
      setTimeout(() => {
        setHit({ at: t, aim: 0.5, text, q: 0.05, outcome: 'miss' });
        finish(0.05, text, 'miss', { aim: 1.2, shape: 'driven', over: true });
      }, 0);
    }
  });

  const since = hit ? t - hit.at : 0;
  const up = hit ? Math.max(0, Math.sin(Math.min(1, since / 0.5) * Math.PI)) : 0;
  const flight = hit?.run ? Math.min(1, since / 0.45) : 0;
  const before = swingAt(Math.min(k, 1.2));
  const goalX = GOAL.x + (hit?.aim ?? 0.5) * GOAL.w;
  const goalY = GOAL.y + GOAL.h * 0.5;
  const bx = hit?.run ? before.x + (goalX - before.x) * flight : before.x;
  const by = hit?.run ? before.y + (goalY - before.y) * flight : before.y;
  const going = hit?.run ? Math.sign((hit.run.keeperTo ?? 0.5) - 0.5) : 0;
  const keeperX = GOAL.x + GOAL.w * (0.5 + ((hit?.run?.keeperTo ?? 0.5) - 0.5) * flight);
  const running = lane !== null && !hit;
  const near = hit ? myX : lane === null ? 150 : 150 + (myX - 150) * Math.min(1, k * 1.8);

  return (
    <View style={{ gap: 6 }}>
      <Pressable onPressIn={(e) => tap((e.nativeEvent.locationX / Math.max(1, boxWidth.current)) * W)} onLayout={(e) => (boxWidth.current = e.nativeEvent.layout.width)} accessibilityRole="button" accessibilityLabel="Jump and head it. Tap left, middle or right of the goal to aim.">
        <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.pitch }}>
          <Svg width="100%" height={190} viewBox={`0 0 ${W} ${H}`}>
            <Rect x={0} y={0} width={W} height={H} fill={colors.pitch} />
            <Rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} stroke="#ffffff" strokeWidth={3} fill="#ffffff10" />
            <Line x1={0} y1={GOAL.y + GOAL.h} x2={W} y2={GOAL.y + GOAL.h} stroke={colors.pitchLine} strokeWidth={2} />
            {lane !== null && !hit && (
              <>
                <Line x1={W / 3} y1={GOAL.y} x2={W / 3} y2={GOAL.y + GOAL.h} stroke="#ffffff33" strokeDasharray="3 4" />
                <Line x1={(2 * W) / 3} y1={GOAL.y} x2={(2 * W) / 3} y2={GOAL.y + GOAL.h} stroke="#ffffff33" strokeDasharray="3 4" />
              </>
            )}
            <KeeperFigure x={keeperX} ground={GOAL.y + GOAL.h} h={50} dive={going * flight * 0.8} kit={looks.oppKeeper} />
            {/* The ball's shadow runs to where it will drop: read it. */}
            {!hit && <Ellipse cx={startX + (targetX - startX) * Math.min(1, k * 1.08)} cy={140} rx={7} ry={2.6} fill="#00000055" />}
            <Person side="opp" x={near + 13} y={118} h={62} pose={hit && !hit.run ? jumpPose(0.9) : undefined} lift={hit && !hit.run ? up * 16 : 0} />
            <Person side="own" me x={near} y={120} h={64} pose={hit ? jumpPose(1) : running ? runPose(t * 12) : undefined} lift={up * 18} />
            <Football cx={bx} cy={by} r={8 - flight * 2.5} rot={(bx + by) * 7} />
          </Svg>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 6, opacity: lane === null && !hit ? 1 : 0.35 }}>
        {LANE_NAMES.map((name, i) => (
          <Pressable key={name} disabled={lane !== null || !!hit} onPress={() => setLane(i)} accessibilityRole="button" accessibilityLabel={name} style={{ flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: lane === i ? colors.accent : colors.border, backgroundColor: lane === i ? alpha(colors.accent, 0.16) : colors.bgElev }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.5, color: lane === i ? colors.accent : colors.text }}>{name.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <T bold style={{ textAlign: 'center', minHeight: 40 }}>
        {hit ? hit.text : lane === null ? (from === 'corner' ? 'It is coming in. Read the shadow and pick your run.' : 'The cross is coming. Pick your run.') : 'Tap the goal as it drops: left, middle or right.'}
      </T>
    </View>
  );
}
