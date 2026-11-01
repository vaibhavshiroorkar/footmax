import { useEffect, useRef, useState } from 'react';

// Re-renders every animation frame while active and returns seconds since
// the ticker (re)started. Mini-games drive their motion from this value.
export function useTicker(active: boolean, resetKey: unknown = 0): number {
  const [t, setT] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    start.current = null;
    let frame: number;
    const loop = (now: number) => {
      if (start.current === null) start.current = now;
      setT((now - start.current) / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active, resetKey]);
  return t;
}
