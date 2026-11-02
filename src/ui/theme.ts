import { Position } from '../engine/types';

// Night match under floodlights. Dark-mode rules from the research:
// - The background is a deep slate navy, never pure black (pure black
//   makes white text smear).
// - Text is a soft off-white, never pure white, which vibrates on dark.
// - The pitch-green accent is a slightly softened lime, so it does not
//   shimmer, and it is used only for the thing to do.
// - Warm gold carries rewards and big moments.
// - Green and red never carry meaning alone; an icon or a lightness
//   difference goes with them.
// "text" and "onBg" are the same; both names stay for older screens.
export const colors = {
  bg: '#0f1522',
  bgElev: '#1a2233',
  card: '#151c2b',
  cardAlt: '#1c2536',
  border: '#263042',
  borderStrong: '#36435a',
  text: '#e9edf4',
  muted: '#9aa5b8',
  faint: '#7d889c',
  onBg: '#e9edf4',
  onBgMuted: '#9aa5b8',
  white: '#ffffff',
  accent: '#b6e35a',
  accentDark: '#93c33a',
  green: '#4cc98a',
  teal: '#3cc7b6',
  gold: '#f4b942',
  orange: '#f59a52',
  red: '#ef5a5a',
  blue: '#5aa2f5',
  purple: '#a48cf2',
  pink: '#ef7aaa',
  pitch: '#2b8a4b',
  pitchDark: '#257d43',
  pitchLine: '#ffffff',
  // Printed-programme moments: cream paper and its ink.
  paper: '#efe7d3',
  paperInk: '#1b1a17',
  // Text on the accent and other light fills.
  ink: '#0f1522',
};

// Kept for screens that still fill shapes with two tones. Close tones, no neon.
export const gradients = {
  sky: ['#121a29', '#0f1522', '#0c111c'] as const,
  primary: ['#c2ea6c', '#b6e35a'] as const,
  gold: ['#f8c75e', '#eeaa2c'] as const,
  danger: ['#f36d6d', '#e44848'] as const,
  purple: ['#b3a0f6', '#9479ea'] as const,
  blue: ['#6db0f8', '#4b93ea'] as const,
  orange: ['#f8ab6c', '#ef8a3c'] as const,
  pink: ['#f390bb', '#e8679b'] as const,
  card: ['#18202f', '#151c2b'] as const,
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

// Dark ink on light fills (lime, gold, paper), white on everything else.
export function onColor(hex: string): string {
  // 0.3 keeps dark ink on the lime accent and gold, where it reads best.
  return luminance(hex) > 0.3 ? colors.ink : '#ffffff';
}

// A club colour that shows up on the dark background. White kits use the
// trim, and black kits are lifted so they do not vanish.
export function teamColor(c: [string, string]): string {
  const white = (h: string) => luminance(h) > 0.85;
  let base = white(c[0]) ? c[1] : c[0];
  if (white(base)) return colors.blue;
  if (luminance(base) < 0.02) base = white(c[1]) || luminance(c[1]) < 0.02 ? '#56627a' : c[1];
  return base;
}
