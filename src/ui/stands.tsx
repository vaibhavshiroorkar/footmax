import React, { memo, useMemo } from 'react';
import { Circle, Defs, Ellipse, G, Line, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Ground } from '../engine/ground';
import { Rng } from '../engine/rng';
import { PL, PW } from './pitchSim';

// The ground around the live pitch, drawn in metres inside the pitch's own
// SVG. Static for a match, so it is memoised and costs nothing per frame.
// Each row of fans is one dashed line per colour, so a full stadium is a few
// dozen SVG elements, not thousands of dots.

// How far the drawing reaches past the touchlines and past the goal lines.
export const SIDE = 5.5;
export const END = 6.5;

const SEAT = 0.62;
const HEAD = 0.48;
const ROW = 0.7;
const CONCRETE = '#161d2a';
const BANK = '#2d5530';
const NEUTRAL = ['#2c3442', '#d8cfc0'];

interface Band {
  // A row runs from a to b along x (horizontal) or y (vertical) at `at`.
  vertical: boolean;
  from: number;
  to: number;
  rows: number[];
  end: 'left' | 'right' | null;
}

function bandsFor(g: Ground): Band[] {
  const rowsBetween = (outer: number, inner: number) => {
    const out: number[] = [];
    const dir = Math.sign(inner - outer);
    for (let v = outer + dir * 0.45; dir > 0 ? v < inner - 0.2 : v > inner + 0.2; v += dir * ROW) out.push(v);
    return out;
  };
  if (g.stands === 'rail') {
    return [
      { vertical: false, from: 2, to: PL - 2, rows: [-2.2], end: null },
      { vertical: false, from: 2, to: PL - 2, rows: [PW + 2.2], end: null },
    ];
  }
  const top = rowsBetween(-SIDE, -1.7);
  const bottom = rowsBetween(PW + SIDE, PW + 1.7);
  if (g.stands === 'main') return [{ vertical: false, from: 18, to: PL - 18, rows: top, end: null }];
  const wide = g.stands === 'bowl';
  const left = rowsBetween(-END, -3.3);
  const right = rowsBetween(PL + END, PL + 3.3);
  return [
    { vertical: false, from: wide ? -END + 0.4 : 0, to: wide ? PL + END - 0.4 : PL, rows: top, end: null },
    { vertical: false, from: wide ? -END + 0.4 : 0, to: wide ? PL + END - 0.4 : PL, rows: bottom, end: null },
    { vertical: true, from: wide ? -SIDE + 0.4 : 0, to: wide ? PW + SIDE - 0.4 : PW, rows: left, end: 'left' },
    { vertical: true, from: wide ? -SIDE + 0.4 : 0, to: wide ? PW + SIDE - 0.4 : PW, rows: right, end: 'right' },
  ];
}

// Each row becomes a dash pattern per colour: a zero-length dash, then the
// gap to the first head, then head, gap, head...
function dashes(spans: number[], from: number): string {
  const out = [0];
  let at = from;
  for (const s of spans) {
    out.push(s - at, HEAD);
    at = s + HEAD;
  }
  out.push(1000);
  return out.map((v) => Math.max(0, v).toFixed(2)).join(' ');
}

interface FanLine {
  key: string;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dash: string;
}

function crowd(g: Ground): FanLine[] {
  const rng = new Rng(g.seed ^ 0x5bd1e995);
  const bands = bandsFor(g);
  const total = bands.reduce((s, b) => s + b.rows.length * (b.to - b.from), 0);
  const share = g.attendance ? g.awayFans / g.attendance : 0;
  // Segregated away end from the professional game up: a block at one end,
  // sized to the away allocation, with a strip of empty seats beside it.
  const endRows = bands.filter((b) => b.end === 'left').reduce((s, b) => s + b.rows.length, 0);
  const segregated = !g.neutral && g.level >= 2 && endRows > 0;
  const span = segregated ? Math.min(PW, Math.max(4, (share * total) / endRows)) : 0;
  const block = { from: PW - span, to: PW + SIDE };
  const density = g.stands === 'rail' ? Math.min(0.85, Math.max(0.05, g.attendance / 500)) : g.attendance / g.capacity;
  const lines: FanLine[] = [];
  bands.forEach((b, bi) => {
    b.rows.forEach((at, ri) => {
      const spans = new Map<string, number[]>();
      for (let s = b.from; s + HEAD < b.to; s += SEAT) {
        // Where along the pitch this seat is, for the neutral split.
        const along = b.vertical ? (b.end === 'left' ? 0 : PL) : s;
        const awayBlock = segregated && b.end === 'left' && s >= block.from && s <= block.to;
        const gap = segregated && b.end === 'left' && s >= block.from - 1.2 && s < block.from;
        if (gap) continue;
        const away = g.neutral ? along > PL / 2 : segregated ? awayBlock : rng.chance(share);
        if (!rng.chance(awayBlock ? 0.92 : density)) continue;
        const kit = away ? g.away : g.home;
        const roll = rng.next();
        const color = roll < 0.5 ? kit[0] : roll < 0.7 ? kit[1] : roll < 0.88 ? NEUTRAL[0] : NEUTRAL[1];
        const list = spans.get(color) ?? [];
        list.push(s);
        spans.set(color, list);
      }
      for (const [color, list] of spans) {
        lines.push({
          key: `${bi}-${ri}-${color}`,
          color,
          x1: b.vertical ? at : b.from,
          y1: b.vertical ? b.from : at,
          x2: b.vertical ? at : b.to,
          y2: b.vertical ? b.to : at,
          dash: dashes(list, b.from),
        });
      }
    });
  });
  return lines;
}

// Worn grass where the most feet land: both goalmouths and the centre.
function wear(g: Ground) {
  if (g.grass.wear <= 0) return null;
  const o = g.grass.wear * 0.45;
  const rng = new Rng(g.seed);
  const patches = Array.from({ length: Math.round(g.grass.wear * 6) }, () => ({ x: rng.range(20, PL - 20), y: rng.range(10, PW - 10), r: rng.range(1.5, 3.5) }));
  return (
    <G>
      <Ellipse cx={4.5} cy={PW / 2} rx={5} ry={4} fill="#8b7a4c" fillOpacity={o} />
      <Ellipse cx={PL - 4.5} cy={PW / 2} rx={5} ry={4} fill="#8b7a4c" fillOpacity={o} />
      <Ellipse cx={PL / 2} cy={PW / 2} rx={4} ry={3} fill="#8b7a4c" fillOpacity={o * 0.8} />
      {patches.map((p, i) => (
        <Ellipse key={i} cx={p.x} cy={p.y} rx={p.r} ry={p.r * 0.7} fill="#8b7a4c" fillOpacity={o * 0.5} />
      ))}
    </G>
  );
}

// The grass, the surround, the stands and the crowd. Pitch markings go on top.
export const GroundArt = memo(function GroundArt({ ground: g }: { ground: Ground }) {
  const lines = useMemo(() => crowd(g), [g]);
  const rail = g.stands === 'rail';
  const stripe = g.grass.mowing;
  const pylons = [
    [-END + 0.9, -SIDE + 0.9],
    [PL + END - 0.9, -SIDE + 0.9],
    [-END + 0.9, PW + SIDE - 0.9],
    [PL + END - 0.9, PW + SIDE - 0.9],
  ];
  return (
    <G>
      <Defs>
        <RadialGradient id="flood" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#fff8dc" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#fff8dc" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={-END} y={-SIDE} width={PL + 2 * END} height={PW + 2 * SIDE} fill={rail ? BANK : CONCRETE} />
      {/* Seats in the home colours under the crowd, at the bigger grounds. */}
      {!rail && <Rect x={-END} y={-SIDE} width={PL + 2 * END} height={PW + 2 * SIDE} fill={g.home[0]} fillOpacity={g.level >= 3 ? 0.16 : 0.07} />}
      {/* A grass verge around the playing area. */}
      <Rect x={-3.2} y={-1.6} width={PL + 6.4} height={PW + 3.2} fill={g.grass.b} />
      {Array.from({ length: 10 }, (_, i) => (
        <Rect key={i} x={i * 10.5} y={0} width={10.5} height={PW} fill={stripe === 'none' || i % 2 === 0 ? g.grass.a : g.grass.b} />
      ))}
      {stripe === 'checks' &&
        Array.from({ length: 4 }, (_, i) => <Rect key={`c${i}`} x={0} y={i * 17 + 8.5} width={PL} height={8.5} fill="#ffffff" fillOpacity={0.045} />)}
      {wear(g)}
      {/* Advertising boards from the professional game up; a white rail below that. */}
      {g.level >= 2 ? (
        <G>
          <Rect x={0} y={-1.45} width={PL} height={0.45} fill="#0d121c" />
          <Rect x={0} y={PW + 1} width={PL} height={0.45} fill="#0d121c" />
          <Rect x={0} y={-1.45} width={PL} height={0.12} fill={g.home[0]} fillOpacity={0.8} />
          <Rect x={0} y={PW + 1.33} width={PL} height={0.12} fill={g.home[0]} fillOpacity={0.8} />
        </G>
      ) : (
        <G>
          <Line x1={1} y1={-1.5} x2={PL - 1} y2={-1.5} stroke="#e6e6e6" strokeOpacity={0.55} strokeWidth={0.18} />
          <Line x1={1} y1={PW + 1.5} x2={PL - 1} y2={PW + 1.5} stroke="#e6e6e6" strokeOpacity={0.55} strokeWidth={0.18} />
        </G>
      )}
      {lines.map((l) => (
        <Line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth={0.5} strokeDasharray={l.dash} />
      ))}
      {g.lights &&
        pylons.map(([x, y], i) => (
          <G key={`l${i}`}>
            <Circle cx={x} cy={y} r={16} fill="url(#flood)" />
            <Rect x={x - 0.7} y={y - 0.7} width={1.4} height={1.4} fill="#f5f2e6" stroke="#5b6475" strokeWidth={0.2} />
          </G>
        ))}
    </G>
  );
});
