import fs from 'fs';
import path from 'path';
import { CELEBRATIONS } from '../../src/engine/creation';
import { celebrate } from '../../src/ui/rig/poses';
import { solve } from '../../src/ui/rig/skeleton';
import { PL, PW, PitchSim } from '../../src/ui/pitchSim';

const setup = () => {
  const sim = new PitchSim();
  sim.sync([
    { id: 'me', side: 'home', spot: { depth: 0.8, lat: 0.5 }, pos: 'FWD', pace: 70, name: 'Me' },
    { id: 'cb', side: 'away', spot: { depth: 0.2, lat: 0.5 }, pos: 'DEF', pace: 70, name: 'Stopper' },
    { id: 'gk', side: 'away', spot: { depth: 0.02, lat: 0.5 }, pos: 'GK', pace: 50, name: 'Keeper' },
  ]);
  sim.layout = 'play';
  Object.assign(sim.bodies.get('me')!, { x: PW / 2, y: PL - 20 });
  Object.assign(sim.bodies.get('cb')!, { x: PW / 2 + 1, y: PL - 19 });
  Object.assign(sim.ball, { x: PW / 2, y: PL - 20, owner: 'me' });
  sim.attacking = 'home';
  return sim;
};

describe('the referee on the stage', () => {
  it('signals and shouts each call', () => {
    for (const [restart, text, voice] of [['penalty', 'PENALTY!', 'ref-penalty'], ['freekick', 'FREE KICK', 'ref-freekick']] as const) {
      const sim = setup();
      const sounds: string[] = [];
      sim.setHooks({ onSound: (n) => sounds.push(n) });
      sim.enqueue([{ x: 0.5, y: 1 - 20 / PL, carrier: 'cb', side: 'home', act: 'foul', other: 'me', restart }]);
      let seen = false;
      for (let f = 0; f < 200 && !seen; f++) {
        sim.update(1 / 30);
        if (sim.callout?.text === text) seen = true;
      }
      expect(seen).toBe(true);
      expect(sim.callout?.signal).toBeDefined();
      expect(sounds).toContain(voice);
    }
  });

  it('has a voice file for every call', () => {
    const dir = path.join(__dirname, '../../assets/sounds');
    for (const n of ['penalty', 'freekick', 'corner', 'offside', 'playon', 'goalkick', 'nogoal', 'handball', 'off']) {
      expect(fs.statSync(path.join(dir, `ref-${n}.wav`)).size).toBeGreaterThan(5000);
    }
  });
});

describe('celebrations', () => {
  it.each(CELEBRATIONS.map((c) => c.id))('%s is a real pose at every moment', (id) => {
    for (let t = 0; t < 3; t += 0.1) {
      const { pose, lift } = celebrate(id, t);
      const s = solve(pose);
      expect(Number.isFinite(s.armL.end.x + s.armR.end.y + s.legL.end.x + lift)).toBe(true);
    }
  });

  it('names the scorer on the goal scene', () => {
    const sim = setup();
    sim.setCelebration('me', 'robot');
    sim.enqueue([{ x: 0.5, y: 1, carrier: null, side: 'home', act: 'goal', aim: 0.2 }]);
    let scorer: string | null | undefined;
    for (let f = 0; f < 200 && scorer === undefined; f++) {
      sim.update(1 / 30);
      if (sim.callout?.tone === 'goal') scorer = sim.callout.scorer;
    }
    expect(scorer).toBe('me');
    expect(sim.callout?.style).toBe('robot');
  });
});
