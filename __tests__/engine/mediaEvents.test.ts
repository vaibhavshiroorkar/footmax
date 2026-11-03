import { newCareerGame } from '../../src/engine/game';
import { addMessage } from '../../src/engine/inbox';
import { respond } from '../../src/engine/offers';
import { pickMediaEvent } from '../../src/engine/mediaEvents';
import { Rng } from '../../src/engine/rng';

describe('media events', () => {
  it('does not repeat the last few events', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 7 });
    game.inbox = [];
    const rng = new Rng(3);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const e = pickMediaEvent(game, rng)!;
      expect(e).not.toBeNull();
      ids.push(e.id);
      addMessage(game, 'media', e.title, e.body, { type: 'media', event: e.id, choices: e.choices });
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('applies the answer the event offers', () => {
    const game = newCareerGame({ firstName: 'A', lastName: 'B', nationId: 'ENG', role: 'ST', seed: 8 });
    game.inbox = [];
    const before = game.career!.fame;
    const msg = addMessage(game, 'media', 'Podcast', 'Your story', { type: 'media', event: 'idol', choices: [{ id: 'bold', label: 'Bold' }] });
    const text = respond(game, msg.id, 'bold');
    expect(text).toContain('Big words');
    expect(game.career!.fame).toBeGreaterThan(before);
  });
});
