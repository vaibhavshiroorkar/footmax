import { colors } from '../theme';
import { ShotShape } from '../../engine/match';

// Where the power bar's feel changes: soft below low, placed around mid, and past
// high the ball starts to climb out of the goal. Nothing steps at these points.
export type Bands = { low: number; mid: number; high: number };
export type PowerStops = { at: number; color: string }[];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// The bar's colours, from a soft blue through the sweet spot to red.
export function powerStops(b: Bands): PowerStops {
  return [
    { at: 0, color: colors.blue },
    { at: (b.low + b.mid) / 2, color: colors.green },
    { at: (b.mid + b.high) / 2, color: colors.gold },
    { at: Math.min(0.99, b.high + 0.05), color: colors.red },
    { at: 1, color: colors.red },
  ];
}

// The colour at any point of the bar, blended between its stops.
export function powerColor(p: number, stops: PowerStops): string {
  const v = clamp01(p);
  const i = Math.max(1, stops.findIndex((s) => s.at >= v));
  const a = stops[i - 1];
  const b = stops[i];
  const k = b.at > a.at ? clamp01((v - a.at) / (b.at - a.at)) : 1;
  const from = rgb(a.color);
  const to = rgb(b.color);
  return `#${from.map((c, n) => Math.round(c + (to[n] - c) * k).toString(16).padStart(2, '0')).join('')}`;
}

// How high it arrives, as a share of the bar. It rises with power all the way, so
// just past high is a shot under the bar and a little more clears it.
export function shotHeight(power: number, shape: ShotShape, b: Bands): number {
  if (shape === 'low') return 0.12;
  if (power <= b.high) return 0.18 + 0.62 * (power / b.high);
  return 0.8 + ((power - b.high) / (1 - b.high));
}

// The part of the wall (from its left end, as shares of the goal) a free kick hits.
// A curler goes round its ends, and a driven shot lifts over more of it as it gets
// harder.
export function wallSpan(shape: ShotShape, power: number, b: Bands): [number, number] | null {
  if (shape === 'curl') return [0.06, 0.24];
  if (shape === 'low') return [0, 0.3];
  const over = clamp01((power - b.mid) / (b.high - b.mid));
  return over >= 1 ? null : [0, 0.3 * (1 - over)];
}
