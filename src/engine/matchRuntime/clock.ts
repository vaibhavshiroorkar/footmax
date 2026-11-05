export const FIXED_STEP = 1 / 60;
export const MAX_STEPS = 32;

export class FixedClock {
  private pending = 0;

  get pendingSeconds(): number {
    return this.pending;
  }

  reset(): void {
    this.pending = 0;
  }

  advance(seconds: number, tick: (dt: number) => void): number {
    if (!Number.isFinite(seconds) || seconds < 0) return 0;
    this.pending += seconds;
    let steps = 0;
    while (this.pending + 1e-12 >= FIXED_STEP && steps < MAX_STEPS) {
      this.pending -= FIXED_STEP;
      if (Math.abs(this.pending) < 1e-12) this.pending = 0;
      steps++;
      // A tick can reset the clock when a decision or period interrupts play.
      tick(FIXED_STEP);
    }
    return steps;
  }
}
