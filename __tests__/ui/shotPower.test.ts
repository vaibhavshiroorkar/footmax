import { powerColor, powerStops, shotHeight, wallSpan } from '../../src/ui/moments/shotPower';
import { colors } from '../../src/ui/theme';

const bands = { low: 0.38, mid: 0.6, high: 0.76 };
const steps = Array.from({ length: 201 }, (_, i) => i / 200);
const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('the power bar colour', () => {
  const stops = powerStops(bands);

  it('runs from blue to red', () => {
    expect(powerColor(0, stops)).toBe(colors.blue);
    expect(powerColor(1, stops)).toBe(colors.red);
  });

  it('never jumps from one point to the next', () => {
    for (let i = 1; i < steps.length; i++) {
      const a = channels(powerColor(steps[i - 1], stops));
      const b = channels(powerColor(steps[i], stops));
      for (let c = 0; c < 3; c++) expect(Math.abs(a[c] - b[c])).toBeLessThan(12);
    }
  });

  it('is a different colour at each part of the bar', () => {
    const seen = new Set(steps.map((p) => powerColor(p, stops)));
    expect(seen.size).toBeGreaterThan(120);
  });
});

describe('how high a shot goes', () => {
  it('rises with power and never steps', () => {
    for (let i = 1; i < steps.length; i++) {
      const a = shotHeight(steps[i - 1], 'driven', bands);
      const b = shotHeight(steps[i], 'driven', bands);
      expect(b).toBeGreaterThan(a);
      expect(b - a).toBeLessThan(0.03);
    }
  });

  it('is under the bar at high and over it soon after', () => {
    expect(shotHeight(0.76, 'driven', bands)).toBeLessThan(0.85);
    expect(shotHeight(0.8, 'driven', bands)).toBeLessThan(1);
    expect(shotHeight(0.84, 'driven', bands)).toBeGreaterThan(1.05);
  });

  it('keeps a low shot down whatever the power', () => {
    expect(shotHeight(1, 'low', bands)).toBeLessThan(0.2);
  });
});

describe('a driven free kick', () => {
  it('lifts over more of the wall the harder it is hit', () => {
    expect(wallSpan('driven', 0.5, bands)).toEqual([0, 0.3]);
    const mid = wallSpan('driven', 0.68, bands)!;
    expect(mid[1]).toBeGreaterThan(0.1);
    expect(mid[1]).toBeLessThan(0.2);
    expect(wallSpan('driven', 0.8, bands)).toBeNull();
  });
});
