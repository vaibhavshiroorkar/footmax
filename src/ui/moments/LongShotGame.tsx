import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { useTicker } from './useTicker';
import { ShotOutcome } from './ShotGame';
import { T } from '../kit';
import { alpha, colors, fonts } from '../theme';
import { Football } from '../football';
import { RigFigure, useLooks } from '../rig/Figure';
import { ready } from '../rig/poses';
import { LongKind, LongRun, longShot, longWindow } from '../../engine/contact';

const W = 300;
const H = 170;
const GROUND = 132;
const GOAL_X = 268;
const FROM_X = 26;
const RISE = 1.15;

type Played = { aim: number; shape: 'driven'; over?: boolean };

// From a long way out. Side on, so you can see how far off his line the keeper
// is: that is the whole shot. Choose lob or driven, then stop the bar in a
// narrow window. The further out, the narrower it is.
export function LongShotGame({ metres, shooting, keeperOut = 2, onPass, onDone }: { metres: number; shooting: number; keeperOut?: number; onPass?: () => void; onDone: (q: number, text: string, outcome: ShotOutcome, played: Played) => void }) {
  const looks = useLooks();
  const [kind, setKind] = useState<LongKind | null>(null);
  const [run, setRun] = useState<LongRun | null>(null);
  const [setup] = useState(() => ({ at: 0.55 + Math.random() * 0.25 }));
  const [struck, setStruck] = useState(0);
  const t = useTicker(run === null ? kind !== null : true, run ? 'fly' : kind ?? 'pick');
  const sent = useRef(false);
  const half = longWindow(metres, shooting);
  const bar = kind && !run ? Math.min(1, t / RISE) : struck;

  const strike = (p: number) => {
    if (!kind || run) return;
    const r = longShot({ metres, shooting, keeperOut, kind, error: Math.abs(p - setup.at) / half, rand: Math.random });
    setStruck(p);
    setRun(r);
  };
  useEffect(() => {
    if (kind && !run && t >= RISE) setTimeout(() => strike(1), 0);
  });

  const dur = kind === 'lob' ? 2.1 : 1.5;
  const k = run ? Math.min(1, t / dur) : 0;
  useEffect(() => {
    if (run && k >= 1 && !sent.current) {
      sent.current = true;
      const text = run.outcome === 'goal' ? (metres > 45 ? 'From the halfway line! Unbelievable!' : 'What a strike!') : run.outcome === 'save' ? 'He gets back and gathers it.' : run.end === 'over' ? 'Way over the bar.' : 'Nowhere near. Wide.';
      setTimeout(() => onDone(run.outcome === 'goal' ? 1 : 0.1, text, run.outcome, { aim: run.outcome === 'miss' ? 1.25 : 0.5, shape: 'driven', over: run.end === 'over' }), 1200);
    }
  });

  // The pitch, side on: goal on the right, the keeper out from it.
  const perMetre = (GOAL_X - FROM_X) / metres;
  const keeperStart = GOAL_X - keeperOut * perMetre;
  // He turns and runs back as it comes.
  const keeperX = keeperStart + (GOAL_X - 6 - keeperStart) * k * (run?.outcome === 'save' ? 1 : 0.7);
  const peak = kind === 'lob' ? 118 : 56;
  const endY = run?.end === 'over' ? 34 : GROUND - 26;
  const short = run?.end === 'wide' ? 0.92 : 1;
  const bx = FROM_X + (GOAL_X - FROM_X) * k * short;
  const by = GROUND - 6 + (endY - (GROUND - 6)) * k - Math.sin(Math.PI * k) * peak;

  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => strike(bar)} accessibilityRole="button" accessibilityLabel="Strike it">
        <View style={{ borderRadius: 14, overflow: 'hidden' }}>
          <Svg width="100%" height={190} viewBox={`0 0 ${W} ${H}`}>
            <Rect x={0} y={0} width={W} height={H} fill="#16324f" />
            <Rect x={0} y={GROUND} width={W} height={H - GROUND} fill={colors.pitch} />
            <Line x1={0} y1={GROUND} x2={W} y2={GROUND} stroke={colors.pitchLine} strokeWidth={2} />
            {/* The goal, side on. */}
            <Path d={`M ${GOAL_X} ${GROUND} L ${GOAL_X} ${GROUND - 34} L ${GOAL_X + 16} ${GROUND - 30} L ${GOAL_X + 16} ${GROUND}`} stroke="#ffffff" strokeWidth={3} fill="#ffffff14" />
            <RigFigure x={keeperX} ground={GROUND} h={34} pose={ready()} kit={looks.oppKeeper} gloves />
            <RigFigure x={FROM_X} ground={GROUND} h={40} kit={looks.own} skin={looks.me?.skin} hair={looks.me ? looks.me.hair : undefined} />
            {run ? <Football cx={bx} cy={by} r={5} rot={k * 900} /> : <Football cx={FROM_X + 9} cy={GROUND - 5} r={5} />}
          </Svg>
          <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#ffffff' }}>{Math.round(metres)} M</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: keeperOut > 6 ? colors.accent : '#ffffffaa' }}>{keeperOut > 6 ? `KEEPER ${Math.round(keeperOut)} M OFF HIS LINE` : 'KEEPER ON HIS LINE'}</Text>
          </View>
        </View>
      </Pressable>
      {kind === null ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {([
            ['lob', 'Lob him', 'Over his head'],
            ['driven', 'Drive it', 'Low and hard'],
          ] as const).map(([id, label, hint]) => (
            <Pressable key={id} onPress={() => setKind(id)} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.accent, backgroundColor: alpha(colors.accent, 0.1) }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.accent }}>{label}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.muted }}>{hint}</Text>
            </Pressable>
          ))}
          {onPass && (
            <Pressable onPress={onPass} accessibilityRole="button" accessibilityLabel="Pass instead" style={{ flex: 1, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.blue, backgroundColor: alpha(colors.blue, 0.1) }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.blue }}>Pass</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.muted }}>Think again</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={{ height: 22, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.bg }}>
          <View style={{ position: 'absolute', left: `${(setup.at - half) * 100}%`, width: `${half * 200}%`, top: 0, bottom: 0, backgroundColor: colors.accent }} />
          <View style={{ position: 'absolute', left: `${bar * 100}%`, top: -2, bottom: -2, width: 4, marginLeft: -2, borderRadius: 2, backgroundColor: '#ffffff' }} />
        </View>
      )}
      <T bold style={{ textAlign: 'center', minHeight: 22 }}>
        {run && k >= 1 ? (run.outcome === 'goal' ? 'GOAL!' : run.outcome === 'save' ? 'Saved.' : 'Missed.') : kind === null ? 'A shot from here? Read the keeper.' : run ? ' ' : 'Tap in the green.'}
      </T>
    </View>
  );
}
