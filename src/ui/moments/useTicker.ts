import { useEffect, useRef, useState } from 'react';

// Re-renders every animation frame while active and returns seconds since
// the ticker (re)started. Mini-games drive their motion from this value.
// A new resetKey reads as 0 straight away. The time is stored with the key
// it belongs to, so the first render of a new phase never sees the last
// phase's clock (that once made the power bar read full and auto-shoot).
export function useTicker(active: boolean, resetKey: unknown = 0): number {
  const [tick, setTick] = useState<{ key: unknown; t: number }>({ key: resetKey, t: 0 });
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    start.current = null;
    let frame: number;
    const loop = (now: number) => {
      if (start.current === null) start.current = now;
      setTick({ key: resetKey, t: (now - start.current) / 1000 });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active, resetKey]);
  return tick.key === resetKey ? tick.t : 0;
}
