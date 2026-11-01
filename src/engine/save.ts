import { ATTR_KEYS, Attributes, Game } from './types';
import { SAVE_VERSION } from './game';

// Attributes are stored as arrays in ATTR_KEYS order, and floats keep one
// decimal. With 6,000+ players this keeps a late-game save near 2 MB.
export function serialize(game: Game): string {
  return JSON.stringify(game, (key, v) => {
    if (key === 'attrs' && v && typeof v === 'object' && !Array.isArray(v)) return ATTR_KEYS.map((k) => Math.round((v as Attributes)[k] * 10) / 10);
    if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 100) / 100;
    return v;
  });
}

export function deserialize(text: string): Game | null {
  try {
    const g = JSON.parse(text, (key, v) => {
      if (key === 'attrs' && Array.isArray(v)) {
        const out = {} as Attributes;
        ATTR_KEYS.forEach((k, i) => (out[k] = v[i]));
        return out;
      }
      return v;
    }) as Game;
    if (!g || typeof g !== 'object' || !g.world || g.version !== SAVE_VERSION) return null;
    return g;
  } catch {
    return null;
  }
}
