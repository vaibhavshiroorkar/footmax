import { Position } from '../engine/types';

// Dark premium look: near-black navy background, glassy cards with hairline
// borders, one lime accent, condensed headings. "text" and "onBg" are the
// same now; both names stay so older screens keep working.
export const colors = {
  bg: '#0a0e17',
  bgElev: '#171e2e',
  card: '#111725',
  cardAlt: '#182033',
  border: '#222b3f',
  borderStrong: '#323d57',
  text: '#f1f4fa',
  muted: '#8b95ad',
  faint: '#596380',
  onBg: '#f1f4fa',
  onBgMuted: '#8b95ad',
  white: '#ffffff',
  accent: '#c4f03b',
  accentDark: '#a9d92b',
  teal: '#2dd4bf',
  gold: '#fbbf24',
  orange: '#fb923c',
  red: '#ff5470',
  blue: '#5b8cff',
  purple: '#a78bfa',
  pink: '#f472b6',
  pitch: '#1e8a45',
  pitchDark: '#197a3c',
  pitchLine: '#ffffff',
  // Text that sits on the lime accent or other light fills.
  ink: '#0a0e17',
};

export const gradients = {
  sky: ['#0f1628', '#0a0e17', '#080b12'] as const,
  primary: ['#d4ff4f', '#b4e436'] as const,
  gold: ['#ffd45c', '#f5a524'] as const,
  danger: ['#ff6b81', '#e8364f'] as const,
  purple: ['#b39dff', '#8b6cf6'] as const,
  blue: ['#6c9bff', '#3d6ff0'] as const,
  orange: ['#ffb070', '#f97316'] as const,
  pink: ['#f9a8d4', '#ec4899'] as const,
  card: ['#151c2c', '#111725'] as const,
};

export const fonts = {
  display: 'BarlowCondensed_700Bold',
  displayBold: 'BarlowCondensed_600SemiBold',
  displayMedium: 'BarlowCondensed_500Medium',
  body: 'Inter_500Medium',
  medium: 'Inter_600SemiBold',
  semibold: 'Inter_700Bold',
  bold: 'Inter_800ExtraBold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };

export function ratingColor(v: number): string {
  if (v >= 85) return '#38bdf8';
  if (v >= 80) return colors.accent;
  if (v >= 70) return '#4ade80';
  if (v >= 60) return '#facc15';
  if (v >= 50) return colors.orange;
  return colors.red;
}

export function matchRatingColor(r: number): string {
  if (r >= 8) return colors.accent;
  if (r >= 7) return '#4ade80';
  if (r >= 6) return '#facc15';
  return colors.red;
}

export const POSITION_COLORS: Record<Position, string> = {
  GK: colors.orange,
  DEF: colors.blue,
  MID: colors.accentDark,
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

// Dark ink on light fills (lime, gold), white on everything else.
export function onColor(hex: string): string {
  return luminance(hex) > 0.4 ? colors.ink : '#ffffff';
}

// A club colour that shows up on the dark background. White kits use the
// trim, and black kits are lifted so they do not vanish.
export function teamColor(c: [string, string]): string {
  const white = (h: string) => luminance(h) > 0.85;
  let base = white(c[0]) ? c[1] : c[0];
  if (white(base)) return colors.blue;
  if (luminance(base) < 0.02) base = white(c[1]) || luminance(c[1]) < 0.02 ? '#4a5470' : c[1];
  return base;
}
