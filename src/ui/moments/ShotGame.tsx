import React, { memo, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTicker } from './useTicker';
import { Bands, powerColor, powerStops, shotHeight, wallSpan } from './shotPower';
import { KeeperFigure, OutfieldFigure } from './Keeper';
import { RigFigure, useLooks } from '../rig/Figure';
import { kick } from '../rig/poses';
import { ShotShape } from '../../engine/match';
import { ShotEnd, ShotRun, ballSpeed, coverageShare, flyShot, powerStray } from '../../engine/contact';
import { T } from '../kit';
import { alpha, colors, fonts } from '../theme';
import { Football } from '../football';

type Kind = 'shot' | 'penalty' | 'freekick';
export type ShotOutcome = 'goal' | 'save' | 'miss';
// Where the shot is from. Each looks and plays differently.
export type ShotView = 'box' | 'outside' | 'oneonone';

const W = 300;
const H = 170;
const GOALS: Record<ShotView, { x: number; y: number; w: number; h: number }> = {
  box: { x: 30, y: 16, w: 240, h: 90 },
  // From distance the goal is smaller and there are bodies in the way.
  outside: { x: 70, y: 22, w: 160, h: 60 },
  // One on one: the keeper is out at you and fills more of the goal.
  oneonone: { x: 22, y: 12, w: 256, h: 96 },
};
// Where the power bar's feel changes, as shares of the bar. The bar shows no
// bands: these only place its colours and the physics (see shotPower.ts).
const LOW = 0.38;
const MID = 0.6;
const HIGH = 0.76;
// Half the width of goal a blocking defender covers, when the pitch does
// not say (see Lane).
const BLOCK_HALF = 0.055;
// The power bar speeds up as it fills (power = time share ^ EASE), so it crawls
// through the blue and whips through the gold. Stopping it there takes a sharp tap.
const EASE = 1.7;

// Two taps: the first stops the aim marker, the second the power bar. Then
// the ball flies and what you see is what counts: out of the keeper's reach
// and on target is a goal, inside his reach is a save, too wide or too much
// power misses.
// shooting and weakFoot widen or narrow how far a shot strays from the aim.
// range: 0 at the edge of the box, 1 from a long way out.
// defenders: the men in the way on the live pitch (PitchSim.laneDefenders).
// A shot into one is blocked, and onDone names him so the pitch shows it.
// Every player can pick how to strike it (see SHAPES): driven, curled or low.
// angle: where he stands across the goal (-1 out to his left, 1 to his
// right, see PitchSim.shotAngle); the ball starts from there.
// foot: the foot he strikes it with, which sets where he stands, how he swings
// and which way a curler bends best.
// edge: how much of the keeper's reach the shooter takes away (see contact.ts).
// scene and kits: the keeper, wall and team-mates as the pitch has them, in
// the colours of this match (see PitchSim.shotScene).
// onPass: give it to a team-mate instead, before the aim is set.
// fake and curler: techniques from the skill tree (see skillTree.ts).
export function ShotGame({ kind, composure, shooting = 60, weakFoot = false, finesse = 0, keeper = 60, view = 'box', chip = false, range = 0, defenders, angle = 0, fake = false, curler = false, edge = 0, foot = 'R', scene, kits, onPass, onDone }: { kind: Kind; composure: number; shooting?: number; weakFoot?: boolean; finesse?: number; keeper?: number; view?: ShotView; chip?: boolean; range?: number; defenders?: Lane[]; angle?: number; fake?: boolean; curler?: boolean; edge?: number; foot?: 'L' | 'R'; scene?: ShotScene; kits?: { own: string; opp: string; keeper: string }; onPass?: () => void; onDone: (q: number, text: string, outcome: ShotOutcome, played: { aim: number; blocker?: string; shape: ShotShape; over?: boolean; wall?: boolean; end?: ShotEnd }) => void }) {
  const GOAL = kind === 'shot' ? GOALS[view] : GOALS.box;
  const outside = kind === 'shot' && view === 'outside';
  const oneOnOne = kind === 'shot' && view === 'oneonone';
  // Finesse Shot pushes back where too high starts.
  const bands: Bands = { low: LOW, mid: MID, high: Math.min(0.95, HIGH + 0.03 * finesse) };
  const stops = powerStops(bands);
  const [phase, setPhase] = useState<'aim' | 'power' | 'flight' | 'done'>('aim');
  const [aim, setAim] = useState(0.5);
  const [shape, setShape] = useState<ShotShape>('driven');
  // Fake shot: the keeper bites toward where you seemed to aim, once, and is
  // off balance for the rest of the shot.
  const [faked, setFaked] = useState<number | null>(null);
  const shapes = kind === 'penalty' ? [] : SHAPES;
  // x is where the ball actually goes: the aim plus any stray.
  // stop: the ball never reaches the goal because a defender or the wall
  // was in the way.
  const [shot, setShot] = useState<{ power: number; outcome: ShotOutcome; text: string; q: number; diveTo: number; blockAt: number; x: number; parry: number; stop?: 'block' | 'wall'; blocker?: number; run?: ShotRun; height: number; dur: number } | null>(null);
  const [setup] = useState(() => ({
    // On the line for a penalty; otherwise where the pitch has him.
    // At a free kick the wall takes one side and he takes the other.
    keeper: kind === 'penalty' ? 0.5 : kind === 'freekick' ? (angle <= 0 ? 0.66 : 0.34) : scene?.keeper ?? 0.32 + Math.random() * 0.36,
    kit: kits?.keeper ?? '#22c55e',
    wall: angle <= 0 ? 0.04 : 0.66,
    offset: Math.random() * Math.PI * 2,
    blockers: [0.25 + Math.random() * 0.2, 0.55 + Math.random() * 0.2].map((x) => ({ x, speed: 0.8 + Math.random() * 0.8, phase: Math.random() * 6 })),
    jitter: [0, 1, 2].map(() => ({ speed: 0.9 + Math.random() * 0.8, phase: Math.random() * 6 })),
    // Two normal draws, used for the stray and for where a parry goes.
    stray: Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random()),
    parry: Math.random() < 0.5 ? -1 : 1,
    dive: Math.random() < 0.5 ? -1 : 1,
    // A penalty keeper stays up the middle now and then, and otherwise goes this far.
    stays: Math.random() < 0.15,
    goes: 0.2 + Math.random() * 0.16,
    // How this ball flies: bend on a curler, swerve on a driven shot, and
    // its arc. Random each time, so no two shots look the same.
    bend: 40 + Math.random() * 38,
    swerve: (Math.random() - 0.5) * 26,
    arc: 0.7 + Math.random() * 0.7,
  }));
  const t = useTicker(phase !== 'done', phase);
  const looks = useLooks();
  const speed = 2.6 + (1 - composure / 99) * 2.6;
  // How far the keeper can get across, as a share of the goal's width. Out
  // at your feet in a one on one he covers more of it.
  // Open play: he comes off his line while you aim, which narrows the
  // angle. Locking the aim freezes him where he got to.
  const [rushAt, setRushAt] = useState<number | null>(null);
  const rushing = kind === 'shot' && !outside;
  const rush = rushing ? Math.min(1, (rushAt ?? (phase === 'aim' ? t : 0)) / (oneOnOne ? 1.1 : 1.9)) : 0;
  const fooled = faked !== null;
  const kpos = !fooled ? setup.keeper : clamp(setup.keeper + Math.sign(faked - setup.keeper || 1) * 0.22);
  // 0 for a top shooter, near 1 for a poor one, and only from distance.
  const longWeak = kind === 'shot' && (outside || range > 0) ? (1 - shooting / 99) * (0.6 + range * 0.6) : 0;
  // How far out he is, and how long a shot of this power takes to get there.
  const metres = kind === 'penalty' ? 11 : kind === 'freekick' ? 24 : outside ? 19 + range * 24 : oneOnOne ? 9 : 14;
  // Stray grows exponentially with distance, as the chance of a goal falls.
  const longStray = Math.exp(0.05 * Math.max(0, metres - 20));
  const flightAt = (p: number) => metres / (ballSpeed(p) * (shape === 'curl' ? 0.88 : shape === 'low' ? 0.95 : 1) * (1 - longWeak * 0.3));
  // The goal he can cover for that shot: the bar under him shows the truth.
  const reachAt = (p: number) => coverageShare(keeper, flightAt(p), rush) * (fooled ? 0.82 : 1) * (1 - edge);
  const reach = reachAt(bands.mid);
  // The men in the way. From the live pitch when it says, shuffling a little
  // as they close you down. Without it, from distance: one defender from the
  // edge of the box, two from far out.
  const blockers: Blocker[] =
    kind !== 'shot' || oneOnOne
      ? []
      : defenders
        ? defenders.map((d, i) => ({ ...d, ...setup.jitter[i % 3], amp: 0.03 }))
        : outside
          ? (range > 0.55 ? setup.blockers : setup.blockers.slice(0, 1)).map((b) => ({ ...b, half: BLOCK_HALF, near: 0.4, amp: 0.14 }))
          : [];

  const aimX = phase === 'aim' ? 0.5 + 0.62 * Math.sin(t * speed + setup.offset) : aim;
  // Power climbs fast once the aim is set; wait too long and he shoots at
  // full power, which flies over the bar.
  // Seconds for the bar to fill: a good finisher gets a touch more time.
  const RISE = 0.62 + (shooting / 99) * 0.38;
  const power = phase === 'power' ? Math.min(1, t / RISE) ** EASE : shot?.power ?? 0;
  // In open play a defender closes in the whole time: while you pick a spot and
  // while you wind up. He puts you off as he gets near.
  const aimLimit = kind === 'shot' ? 2.4 + (composure / 99) * 1.2 : Infinity;
  const elapsed = phase === 'aim' ? t : phase === 'power' ? (rushAt ?? 0) + t : shot?.blockAt ?? 0;
  const pressure = aimLimit === Infinity || !blockers.length ? 0 : Math.min(1, elapsed / aimLimit);

  // The man closing you down heads for the line of the shot.
  const target = 0.5 + angle * 0.3;

  const fire = (struck: number) => {
    let power = struck;
    {
      // No shot goes exactly where it was aimed. Better finishers stray less;
      // the weaker foot, distance and an overhit ball stray more.
      // A low shot cannot go over: struck too hard it drags wide instead.
      const drag = shape === 'low' ? Math.max(0, (power - bands.high) / (1 - bands.high)) : 0;
      // Harder is faster but less true, and a man in your face makes it worse.
      const spread = 0.015 + (1 - (composure + shooting) / 198) * 0.15 + longWeak * 0.1 + (weakFoot ? 0.05 : 0) + (outside ? 0.015 : 0) + range * 0.04 + powerStray(power) + pressure * 0.05 + (shape === 'curl' ? 0.012 : 0) + drag * 0.16;
      const x = aim + setup.stray * spread * longStray;
      const strayed = Math.abs(x - aim) > 0.06;
      if (drag > 0) power = bands.high;
      // Into a defender's body: blocked. A curler passes him wide of where it
      // ends up, so it can bend round him; a low one is easier to block.
      const hit = blockers.findIndex((b, i) => Math.abs(blockerX(b, elapsed, i === 0 ? pressure : 0, target) - (shape === 'curl' ? x + curlSide(x) * (curler ? 0.22 : 0.14) * b.near : x)) < b.half * (shape === 'low' ? 1.3 : 1));
      const blocked = hit >= 0;
      const lob = oneOnOne && chip && power > bands.high && power <= bands.high + 0.1;
      const span = wallSpan(shape, power, bands);
      const wall = kind === 'freekick' && !!span && x >= setup.wall + span[0] && x <= setup.wall + span[1];
      // Hit too hard it clears the bar; a low one stays down whatever the power.
      const height = shotHeight(power, shape, bands);
      // The keeper's sums use the real flight; the picture runs a little quicker.
      const dur = Math.max(0.3, Math.min(0.95, flightAt(power) * 0.72));
      // A penalty keeper picks a side on the kick, or stays up the middle.
      const guess = kind === 'penalty' ? (setup.stays ? 0.5 : 0.5 + setup.dive * setup.goes) : undefined;
      const run = blocked || wall || lob ? undefined : flyShot({ aim: x, height, flight: flightAt(power), keeper: { at: kpos, skill: keeper, rush, fooled, guess, edge }, curl: shape === 'curl' ? (curler ? 2 : 1.5) : 1, rand: Math.random });
      const r = blocked
        ? { outcome: 'miss' as ShotOutcome, text: 'Blocked by a defender!', q: 0.08, diveTo: kpos }
        : wall
          ? { outcome: 'miss' as ShotOutcome, text: 'Straight into the wall.', q: 0.08, diveTo: kpos }
          : lob
            ? { outcome: 'goal' as ShotOutcome, text: 'Chipped over him! Sublime.', q: 1, diveTo: kpos }
            : { outcome: run!.outcome as ShotOutcome, text: lineFor(run!, kind, power, bands), q: run!.outcome === 'goal' ? 0.8 + 0.2 * Math.min(1, power / bands.mid) : run!.outcome === 'save' ? 0.4 : 0.05, diveTo: run!.keeperTo };
      if (run?.end === 'wide' && strayed) r.text = weakFoot ? 'Sliced it with the weaker foot. Wide!' : 'It drifted wide of the post!';
      setShot({ power, blockAt: elapsed, x, parry: setup.parry, stop: blocked ? 'block' : wall ? 'wall' : undefined, blocker: blocked ? hit : undefined, run, height, dur, ...r });
      setPhase('flight');
    }
  };

  const tap = () => {
    if (phase === 'aim') {
      setAim(aimX);
      setRushAt(t);
      setPhase('power');
    } else if (phase === 'power') fire(power);
  };

  // Out of time: tackled while aiming, or the power maxes out and he shoots.
  const timedOut = useRef(false);
  const tackled = () => {
    setShot({ power: 0.5, blockAt: elapsed, x: aimX, parry: setup.parry, stop: 'block', outcome: 'miss', text: 'Too slow! A defender nicks it off you.', q: 0.05, diveTo: kpos, height: 0.3, dur: 0.6 });
    setPhase('flight');
  };
  useEffect(() => {
    if (timedOut.current) return;
    // Deferred a tick so the state change happens outside the render pass.
    if (phase === 'aim' && t > aimLimit) {
      timedOut.current = true;
      setTimeout(tackled, 0);
    } else if (phase === 'power' && t >= RISE) {
      timedOut.current = true;
      setTimeout(() => fire(1), 0);
    }
  });

  // When the ball lands, show the result for a moment, then report it.
  const sent = useRef(false);
  useEffect(() => {
    if (phase === 'flight' && shot && t >= shot.dur && !sent.current) {
      sent.current = true;
      setTimeout(() => onDone(shot.q, shot.text, shot.outcome, { aim: shot.x, blocker: shot.blocker !== undefined ? blockers[shot.blocker]?.id : undefined, shape, over: shot.outcome === 'miss' && !shot.stop && shot.power > bands.high, wall: shot.stop === 'wall', end: shot.run?.end }), 1200);
    }
  });

  const px = (x: number) => GOAL.x + x * GOAL.w;
  const dur = shot?.dur ?? 0.6;
  const k = phase === 'flight' && shot ? Math.min(1, t / dur) : 0;
  const landed = k >= 1;
  // After the ball arrives: a parry off the keeper, or on out of play.
  // A touch ends the ball's flight there, and it goes where he sent it.
  const end = shot?.run?.end;
  const tc = shot?.run?.touch?.t ?? 1;
  const after = phase === 'flight' && shot ? Math.min(1, Math.max(0, (t - dur * tc) / 0.55)) : 0;
  const over = end === 'over';
  const wide = end === 'wide';
  // A blocked shot hits the defender's body; a wall shot hits the wall.
  const hitMan = shot?.blocker !== undefined ? blockers[shot.blocker] : undefined;
  const stopY = shot?.stop === 'block' ? (hitMan ? manAt(hitMan, GOAL).ground - manAt(hitMan, GOAL).h * 0.6 : GOAL.y + GOAL.h + 30) : shot?.stop === 'wall' ? GOAL.y + GOAL.h - 24 : null;
  const low = shape === 'low';
  const targetY = stopY ?? (over ? GOAL.y - 14 : GOAL.y + GOAL.h * (1 - (shot?.height ?? 0.4) * 0.94));
  const endX = shot ? px(shot.x) : px(aim);
  // Where the ball is at kk (0 at the boot, 1 at the goal). A curler starts
  // out wide and bends back in; a driven shot rises a little; a low one
  // skims the grass.
  // He stands to one side of the ball, by the foot he strikes it with.
  const fromX = 150 + angle * 105;
  const striker = weakFoot ? (foot === 'R' ? 'L' : 'R') : foot;
  const standX = fromX + (striker === 'R' ? -13 : 13);
  // Back as he charges, through the ball as he strikes it.
  const swing = phase === 'flight' ? Math.min(1, t / 0.28) : phase === 'power' ? -power : 0;
  const pathAt = (kk: number) => {
    // A right foot bends it best toward the left of goal, and a left foot the other way.
    const natural = (striker === 'R') === (shot ? shot.x < 0.5 : false) ? 1.2 : 0.8;
    const bendX = !shot ? 0 : shape === 'curl' ? curlSide(shot.x) * setup.bend * (curler ? 1.3 : 1) * natural : shape === 'low' ? setup.swerve * 0.3 : setup.swerve;
    const x = (1 - kk) * (1 - kk) * fromX + 2 * (1 - kk) * kk * ((fromX + endX) / 2 + bendX) + kk * kk * endX;
    const y = H - 12 + (targetY - (H - 12)) * (low ? 1 - (1 - kk) * (1 - kk) : kk) - Math.sin(Math.PI * kk) * (low ? 2 : shape === 'curl' ? 14 : 9) * setup.arc;
    return { x, y, r: 10.5 - 4 * kk };
  };
  const at0 = pathAt(Math.min(k, tc));
  let ballX = at0.x;
  let ballY = at0.y;
  let ballR = at0.r;
  // Spin: the seam turns as it flies, faster on a curler.
  const spin = (t * (shape === 'curl' ? 1500 : 900)) % 360;
  if (after > 0 && shot) {
    const out = shot.x >= 0.5 ? 1 : -1;
    if (shot.stop) {
      // Off the body and away: back toward you and to the side.
      ballX = at0.x + shot.parry * 55 * after;
      ballY = at0.y + 40 * after - Math.sin(Math.PI * after) * 16;
      ballR = 5 + 2 * after;
    } else if (end === 'held') {
      // Gathered: it stays in his gloves.
      ballR = at0.r;
    } else if (end === 'parry') {
      // Pushed back out into play: a live ball.
      ballX = at0.x + shot.parry * 70 * after;
      ballY = at0.y + (H - 30 - at0.y) * after - Math.sin(Math.PI * after) * 22;
      ballR = at0.r + 2.5 * after;
    } else if (end === 'tipRound') {
      ballX = at0.x + out * 62 * after;
      ballY = at0.y - 3 * after;
      ballR = at0.r - 1 * after;
    } else if (end === 'tipOver') {
      ballY = at0.y - 40 * after;
      ballR = at0.r - 1 * after;
    } else if (end === 'inOffHand') {
      // A touch, but not enough: on into the net.
      ballX = at0.x + out * 10 * after;
      ballY = at0.y + 8 * after;
    } else if (end === 'post' || end === 'bar') {
      // Off the woodwork and back into play.
      ballX = at0.x - out * (end === 'post' ? 46 : 16) * after;
      ballY = at0.y + (H - 40 - at0.y) * after - Math.sin(Math.PI * after) * 14;
      ballR = at0.r + 2 * after;
    } else if (end === 'inOffPost') {
      ballX = at0.x - out * 16 * after;
      ballY = at0.y + 6 * after;
    } else if (shot.outcome === 'miss') {
      // On past the post or over the bar, into the crowd.
      ballX = at0.x + (wide ? (shot.x < 0.5 ? -40 : 40) : 0) * after;
      ballY = at0.y - (over ? 14 : 6) * after;
      ballR = 4.5 - 1.5 * after;
    } else {
      // In the net: it drops into the back of it.
      ballY = at0.y + 8 * after;
    }
  }
  // He sets off late, and his body goes where the model says. On a touch the
  // figure is placed so the glove meets the ball, and IK does the rest; with
  // no touch his hand stops at full stretch, short of it.
  const limb = shot?.run?.touch?.limb;
  const keeperH = (oneOnOne ? 74 : outside ? 44 : 58) + rush * 14;
  const hs = keeperH / 60;
  const launch = shot?.run?.launch ?? 0;
  const ease = shot ? Math.min(1, Math.max(0, (k - launch) / Math.max(0.05, tc - launch))) : 0;
  const hit = pathAt(tc);
  const going = shot ? Math.sign(hit.x - px(kpos)) || setup.dive : 0;
  const toPx = !shot?.run ? px(kpos) : limb ? hit.x - going * (limb === 'body' ? 0 : 30 * hs) : px(shot.diveTo);
  const keeperPx = px(kpos) + (toPx - px(kpos)) * ease;
  const stretch = limb === 'body' ? 0.2 : limb === 'hand' ? 0.7 : limb === 'fingers' ? 1 : Math.min(1, Math.abs(toPx - px(kpos)) / 40 + 0.4);
  const diveAmount = shot?.run ? ease * stretch * going : 0;
  const keeperGround = GOAL.y + GOAL.h + (oneOnOne ? 22 : 0) + rush * 22;
  const gloves = shot?.run && diveAmount !== 0 ? { x: (hit.x - keeperPx) / hs, y: (hit.y - keeperGround) / hs } : undefined;

  return (
    <View>
      {shapes.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, alignSelf: 'stretch' }}>
          {shapes.map((sh) => {
            const on = shape === sh.id;
            const locked = phase === 'flight' || phase === 'done';
            return (
              <Pressable
                key={sh.id}
                disabled={locked}
                onPress={() => setShape(sh.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${sh.label} shot`}
                style={{ flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? alpha(colors.accent, 0.16) : colors.bgElev, opacity: locked && !on ? 0.4 : 1 }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: on ? colors.accent : colors.muted }}>{sh.label.toUpperCase()}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 9.5, color: colors.faint }} numberOfLines={1}>
                  {sh.hint}
                </Text>
              </Pressable>
            );
          })}
          {fake && kind === 'shot' && (
            <Pressable
              disabled={phase !== 'aim' || faked !== null}
              onPress={() => setFaked(aimX)}
              accessibilityRole="button"
              accessibilityLabel="Fake shot"
              style={({ pressed }) => ({ flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.purple, backgroundColor: pressed ? alpha(colors.purple, 0.2) : alpha(colors.purple, 0.08), opacity: phase === 'aim' && faked === null ? 1 : 0.35 })}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: colors.purple }}>FAKE</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 9.5, color: colors.faint }} numberOfLines={1}>
                Sell him
              </Text>
            </Pressable>
          )}
          {onPass && kind === 'shot' && (
            <Pressable
              disabled={phase !== 'aim'}
              onPress={onPass}
              accessibilityRole="button"
              accessibilityLabel="Pass instead"
              style={({ pressed }) => ({ flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.blue, backgroundColor: pressed ? alpha(colors.blue, 0.2) : alpha(colors.blue, 0.08), opacity: phase === 'aim' ? 1 : 0.35 })}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: colors.blue }}>PASS</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 9.5, color: colors.faint }} numberOfLines={1}>
                Find a mate
              </Text>
            </Pressable>
          )}
        </View>
      )}
      <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={phase === 'aim' ? 'Lock aim' : 'Strike it'}>
        <View style={{ alignItems: 'center' }}>
          <Svg width="100%" height={190} viewBox={`0 0 ${W} ${H}`}>
            <GoalFrame x={GOAL.x} y={GOAL.y} w={GOAL.w} h={GOAL.h} />
            {/* The keeper's reach before you shoot, so the gap is readable. */}
            {phase !== 'flight' && <Rect x={px(Math.max(0, kpos - (phase === 'power' ? reachAt(power) : reach)))} y={GOAL.y + GOAL.h - 4} width={GOAL.w * Math.min(1, (phase === 'power' ? reachAt(power) : reach) * 2)} height={4} fill="#ffffff" opacity={0.25} />}
            {outside && <Rect x={0} y={GOAL.y + GOAL.h + 22} width={W} height={2} fill={colors.pitchLine} opacity={0.6} />}
            {kind === 'shot' && (scene?.mates ?? []).map((mate) => {
              const m = manAt({ x: mate.x, half: 0.06, near: mate.near, speed: 0, phase: 0, amp: 0 }, GOAL);
              return <OutfieldFigure key={mate.id} x={sx(mate.x, GOAL)} ground={m.ground} h={m.h} kit={kits?.own} stride={t * 8} back />;
            })}
            {[...blockers].map((b, i) => ({ b, i })).sort((p, q) => p.b.near - q.b.near).map(({ b, i }) => {
              // The nearest man closes you down: he gets bigger as he gets near.
              const closing = i === 0 ? pressure : 0;
              const m = manAt({ ...b, near: Math.min(0.95, b.near + (1 - b.near) * closing * 0.7) }, GOAL);
              const cx = sx(blockerX(b, elapsed, closing, target), GOAL);
              const still = closing > 0.85 || phase === 'flight';
              return <OutfieldFigure key={b.id ?? i} x={cx} ground={m.ground} h={m.h} span={m.w} kit={kits?.opp} stride={still ? undefined : elapsed * 9 + i} />;
            })}
            {kind === 'freekick' &&
              [0, 1, 2, 3].map((i) => (
                <OutfieldFigure key={i} x={px(setup.wall + 0.0375 + i * 0.075)} ground={GOAL.y + GOAL.h + 2} h={50} span={GOAL.w * 0.075} kit={kits?.opp} jump={phase === 'flight' ? Math.sin(Math.min(1, k * 1.5) * Math.PI) : 0} />
              ))}
            <KeeperFigure x={keeperPx} ground={keeperGround} h={keeperH} dive={diveAmount} kit={setup.kit} reach={gloves} />
            {phase !== 'flight' && (
              <>
                <Circle cx={px(aimX)} cy={GOAL.y + GOAL.h / 2} r={9} stroke="#ffffff" strokeWidth={3} fill={phase === 'aim' ? 'none' : '#ffffff'} />
                <Line x1={px(aimX)} y1={GOAL.y + 8} x2={px(aimX)} y2={GOAL.y + GOAL.h - 8} stroke="#ffffff88" strokeWidth={1} />
              </>
            )}
            <RigFigure x={standX} ground={H - 3} h={52} pose={kick(striker, swing)} back kit={looks.own} skin={looks.me?.skin} hair={looks.me ? looks.me.hair : undefined} boots={looks.me?.boots} />
            {phase !== 'flight' && <Football cx={fromX} cy={H - 12} r={10.5} />}
            {phase === 'flight' && (
              <>
                <Ellipse cx={ballX} cy={Math.min(H - 6, H - 8 + (GOAL.y + GOAL.h - (H - 8)) * k)} rx={ballR} ry={ballR * 0.4} fill="#000000" opacity={0.25} />
                {/* A short trail behind the ball while it flies. */}
                {k < 1 &&
                  [0.05, 0.1, 0.15].map((d, i) => {
                    const g = pathAt(Math.max(0, k - d));
                    return <Circle key={i} cx={g.x} cy={g.y} r={g.r * (0.85 - i * 0.15)} fill="#ffffff" opacity={0.28 - i * 0.08} />;
                  })}
                <Football cx={ballX} cy={ballY} r={ballR} rot={spin} />
              </>
            )}
          </Svg>
          {landed && shot && (
            <View pointerEvents="none" style={{ position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 44, color: shot.outcome === 'goal' ? colors.accent : '#ffffff', letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 }}>
                {shot.outcome === 'goal' ? 'GOAL!' : shot.outcome === 'save' ? 'SAVED' : over ? 'OVER!' : 'MISSED'}
              </Text>
            </View>
          )}
          {/* One bar under the goal: first the time to aim, then the power. */}
          <View style={{ width: '100%', height: 30, marginTop: 8, justifyContent: 'center' }}>
            {phase === 'aim' ? (
              <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1, color: colors.muted }}>{aimLimit < Infinity ? '1. AIM  |  DEFENDER CLOSING' : '1. AIM'}</Text>
                <View style={{ height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: 'hidden' }}>
                  {aimLimit < Infinity && <View style={{ width: `${Math.max(0, 1 - t / aimLimit) * 100}%`, height: 6, backgroundColor: t / aimLimit > 0.7 ? colors.red : colors.gold }} />}
                </View>
              </View>
            ) : (
              <View style={{ gap: 3 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1, color: powerColor(power, stops) }}>2. POWER  |  {Math.round((metres / flightAt(power)) * 3.6)} KM/H</Text>
                <View style={{ height: 18, borderRadius: 6, overflow: 'hidden' }}>
                  <LinearGradient colors={stops.map((s) => s.color) as [string, string, ...string[]]} locations={stops.map((s) => s.at) as [number, number, ...number[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
                  {/* The part still to come stays dim, so the colour builds as it rises. */}
                  <View style={{ position: 'absolute', left: `${power * 100}%`, right: 0, top: 0, bottom: 0, backgroundColor: alpha(colors.bg, 0.72) }} />
                  <View style={{ position: 'absolute', left: `${power * 100}%`, top: -2, bottom: -2, width: 4, marginLeft: -2, borderRadius: 2, backgroundColor: '#ffffff' }} />
                </View>
              </View>
            )}
          </View>
          <T bold style={{ marginTop: 10, minHeight: 44, textAlign: 'center' }}>
            {phase === 'aim'
              ? outside
                ? 'Tap to aim: past the defender, away from the keeper.'
                : oneOnOne
                  ? `He is rushing out. Be quick!${chip ? ' Stop the bar just as it turns red to chip him.' : ''}`
                  : blockers.length
                    ? 'Tap to aim past the defender. The keeper comes out if you wait.'
                    : rushing ? 'Tap to aim. He comes off his line if you wait.' : 'Tap to aim.'
              : phase === 'power'
                ? 'Tap to strike. Harder is faster, but wilder.'
                : landed
                  ? shot?.text
                  : ' '}
          </T>
        </View>
      </Pressable>
    </View>
  );
}

// The grass, net and posts. Memoised: they never change during a shot, and
// the game redraws every frame.
const GoalFrame = memo(function GoalFrame({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <>
      <Rect x={0} y={0} width={W} height={H} fill={colors.pitch} />
      {Array.from({ length: 13 }, (_, i) => (
        <Line key={`v${i}`} x1={x + (i * w) / 12} y1={y} x2={x + (i * w) / 12} y2={y + h} stroke="#ffffff22" strokeWidth={1} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <Line key={`h${i}`} x1={x} y1={y + (i * h) / 5} x2={x + w} y2={y + (i * h) / 5} stroke="#ffffff22" strokeWidth={1} />
      ))}
      <Rect x={x} y={y} width={w} height={h} stroke="#ffffff" strokeWidth={4} fill="none" />
      <Line x1={0} y1={y + h} x2={W} y2={y + h} stroke={colors.pitchLine} strokeWidth={2} />
    </>
  );
});

// A man in the way, as the live pitch reports him (see
// PitchSim.laneDefenders), plus how he shuffles while you aim.
export type Lane = { id: string; x: number; half: number; near: number };
export type ShotScene = { keeper: number; out: number; mates: { id: string; x: number; near: number }[] };
type Blocker = Omit<Lane, 'id'> & { id?: string; speed: number; phase: number; amp: number };

// A defender's position across the goal at time t. closing runs from 0 to 1 as he
// moves over toward target, the line of the shot.
function blockerX(b: Blocker, t: number, closing = 0, target = 0.5): number {
  return b.x + (target - b.x) * closing * 0.75 + b.amp * Math.sin(t * b.speed + b.phase);
}

// Where a place across the goal sits on screen. Past the posts it squeezes in, so
// men wide of the goal stand at the side of the picture, not off it.
function sx(x: number, goal: { x: number; w: number }): number {
  if (x >= 0 && x <= 1) return goal.x + x * goal.w;
  const past = x < 0 ? -x : x - 1;
  const room = Math.min(goal.x, W - goal.x - goal.w) - 26;
  const out = room * (1 - Math.exp(-past * 2.5));
  return x < 0 ? goal.x - out : goal.x + goal.w + out;
}


// How big and how low to draw him: the nearer the shooter, the bigger and
// the further down the screen. His width is exactly the goal he hides, so a
// shot that looks past him is past him.
function manAt(b: Blocker, goal: { y: number; h: number; w: number }): { w: number; h: number; ground: number } {
  const w = Math.max(8, b.half * 2 * goal.w);
  const base = goal.y + goal.h + 26;
  return { w, h: Math.min(w * 2.2, 54), ground: base + b.near * Math.max(0, H - 24 - base) };
}

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}

// What happened, in a line under the goal.
function lineFor(run: ShotRun, kind: Kind, power: number, b: Bands): string {
  switch (run.end) {
    case 'net':
      return kind === 'penalty' ? (power >= b.low ? 'Sent the keeper the wrong way!' : 'Rolled in. Cheeky!') : 'Beat him all ends up!';
    case 'inOffHand':
      return 'He gets a hand to it, but it still goes in!';
    case 'inOffPost':
      return 'In off the post!';
    case 'held':
      return power < b.low ? 'Too soft. Easy save.' : 'Straight into his gloves.';
    case 'parry':
      return 'Parried away!';
    case 'tipRound':
      return 'Fingertips! Round the post.';
    case 'tipOver':
      return 'Tipped over the bar!';
    case 'post':
      return 'Off the post!';
    case 'bar':
      return 'Off the bar!';
    case 'over':
      return 'Blazed over the bar!';
    default:
      return 'Wide of the post!';
  }
}

// How to strike it. Free for everyone; each trades one thing for another.
const SHAPES: { id: ShotShape; label: string; hint: string }[] = [
  { id: 'driven', label: 'Driven', hint: 'Hard and true' },
  { id: 'curl', label: 'Curl', hint: 'Bends round them' },
  { id: 'low', label: 'Low', hint: 'Skims the grass' },
];

// A curler is aimed outside the post and bends back in, so on its way it is
// further out than where it ends up: to the right of a right-side target.
function curlSide(x: number): number {
  return x >= 0.5 ? 1 : -1;
}
