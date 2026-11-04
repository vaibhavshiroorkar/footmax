// The line under the pitch. Play makes a new caption every half second or so,
// too fast to read, so each one holds for a minimum time. Small lines wait
// their turn and go stale; a goal or a red card cuts straight in.

export const CAPTION_HOLD = 1.6;
const STALE = 2.4;

const URGENT = /^GOAL|NO GOAL|Red card|VAR|Your (moment|call)/;
const NOTABLE = /shoots|header|curl|drills|saved|tipped|blocked|misses|Corner|corner|Free kick|free kick|brought down|booked|injured|offside|Offside|Half time|Kick off/;

export function captionRank(text: string): 0 | 1 | 2 {
  return URGENT.test(text) ? 2 : NOTABLE.test(text) ? 1 : 0;
}

export class CaptionQueue {
  text = '';
  private since = -Infinity;
  private offered = '';
  private next: { text: string; rank: number; at: number } | null = null;

  // Hands in the pitch's current caption. now is in seconds.
  offer(text: string, now: number) {
    if (text === this.offered) return;
    this.offered = text;
    const rank = captionRank(text);
    if (rank === 2) {
      this.next = null;
      this.show(text, now);
    } else if (!this.next || rank >= this.next.rank) this.next = { text, rank, at: now };
  }

  // The caption to show at this moment.
  read(now: number): string {
    if (this.next && now - this.since >= CAPTION_HOLD) {
      if (now - this.next.at <= STALE) this.show(this.next.text, now);
      this.next = null;
    }
    return this.text;
  }

  private show(text: string, now: number) {
    this.text = text;
    this.since = now;
  }
}
