import { Position } from '../engine/types';

// Floodlit matchday: a green-black night pitch, warm chalk text and one
// flare-orange accent for the thing to do. See DESIGN.md. "text" and
// "onBg" are the same; both names stay so older screens keep working.
export const colors = {
  bg: '#0e1310',
  bgElev: '#1a211d',
  card: '#151b17',
  cardAlt: '#1d2520',
  border: '#28322c',
  borderStrong: '#3b4840',
  text: '#f2eee3',
  muted: '#a7ad9f',
  faint: '#8a9284',
  onBg: '#f2eee3',
  onBgMuted: '#a7ad9f',
  white: '#ffffff',
  accent: '#ff7a2f',
  accentDark: '#e5601a',
  green: '#3fcf7c',
  teal: '#2ec4b6',
  gold: '#ffc83d',
  orange: '#ffa24d',
  red: '#f0524d',
  blue: '#4fa3ff',
  purple: '#a98cff',
  pink: '#ff6fa8',
  pitch: '#2a8c48',
  pitchDark: '#237c3f',
  pitchLine: '#ffffff',
  // Printed-programme moments: cream paper and its ink.
  paper: '#f3ead6',
  paperInk: '#1d1a15',
  // Text on the accent and other light fills.
  ink: '#16120d',
};

// Kept for screens that still fill shapes with two tones. Flat-ish on
// purpose: no neon.
export const gradients = {
  sky: ['#111814', '#0e1310', '#0b0f0d'] as const,
  primary: ['#ff8a45', '#ff7a2f'] as const,
  gold: ['#ffd25c', '#f5b71f'] as const,
  danger: ['#f5665f', '#e2463f'] as const,
  purple: ['#b39dff', '#9475f2'] as const,
  blue: ['#64b0ff', '#3f92ec'] as const,
  orange: ['#ffb36b', '#f7913a'] as const,
  pink: ['#ff8ab9', '#f05a97'] as const,
  card: ['#18201b', '#151b17'] as const,
};

// Big Shoulders Display for titles and numbers, Rubik for reading.
export const fonts = {
  display: 'BigShouldersDisplay_800ExtraBold',
  displayBold: 'BigShouldersDisplay_700Bold',
  displayMedium: 'BigShouldersDisplay_600SemiBold',
  body: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
  bold: 'Rubik_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 6, md: 10, lg: 12, pill: 999 };

// Ratings read like a heat scale: red is poor, green good, blue elite.
export function ratingColor(v: number): string {
  if (v >= 85) return colors.blue;
  if (v >= 75) return colors.green;
  if (v >= 65) return '#a6d94a';
  if (v >= 55) return colors.gold;
  if (v >= 45) return colors.orange;
  return colors.red;
}

export function matchRatingColor(r: number): string {
  if (r >= 8) return colors.blue;
  if (r >= 7) return colors.green;
  if (r >= 6) return colors.gold;
  return colors.red;
}

export const POSITION_COLORS: Record<Position, string> = {
  GK: colors.orange,
  DEF: colors.blue,
  MID: colors.green,
  FWD: colors.red,
};

// Mixes a hex colour toward black (amount < 0) or white (amount > 0).
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const c = (n >> shift) & 255;
    const t = amount < 0 ? 0 : 255;
    return Math.round(c + (t - c) * Math.abs(amount));
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

export function alpha(hex: string, a: number): string {
  return `${hex}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

// Dark ink on light fills (orange, gold, paper), white on everything else.
export function onColor(hex: string): string {
  // 0.3 puts dark ink on the orange accent, which reads far better than white.
  return luminance(hex) > 0.3 ? colors.ink : '#ffffff';
}

// A club colour that shows up on the dark background. White kits use the
// trim, and black kits are lifted so they do not vanish.
export function teamColor(c: [string, string]): string {
  const white = (h: string) => luminance(h) > 0.85;
  let base = white(c[0]) ? c[1] : c[0];
  if (white(base)) return colors.blue;
  if (luminance(base) < 0.02) base = white(c[1]) || luminance(c[1]) < 0.02 ? '#56635a' : c[1];
  return base;
}
