import React from 'react';
import { Player, ATTR_KEYS } from '../engine/types';
import { ATTR_LABELS, weightsFor } from '../engine/player';
import { StatBar } from './kit';
import { ratingColor } from './theme';

// Shows the attributes that matter for the position first.
export function AttributeList({ p }: { p: Player }) {
  const w = weightsFor(p);
  const keys = ATTR_KEYS.filter((k) => k !== 'goalkeeping' || p.position === 'GK').sort((a, b) => (w[b] ?? 0) - (w[a] ?? 0));
  return (
    <>
      {keys.map((k) => (
        <StatBar key={k} label={`${ATTR_LABELS[k]}${(w[k] ?? 0) >= 0.15 ? ' (key)' : ''}`} value={p.attrs[k]} max={99} color={ratingColor(p.attrs[k])} />
      ))}
    </>
  );
}

export function potentialLabel(p: Player, ovr: number): string {
  const room = p.potential - ovr;
  if (p.age >= 29 || room <= 1) return 'At his peak';
  if (p.potential >= 88) return 'World class prospect';
  if (p.potential >= 80) return 'Future star';
  if (p.potential >= 70) return 'Solid pro';
  return 'Squad player';
}
