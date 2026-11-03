import { PL, PW, PitchSim } from '../../src/ui/pitchSim';

// A VAR check holds play; a goal that stands counts after it, a goal that is
// ruled out never reaches the scoreboard.
function play(v: 'stands' | 'overturned') {
  const sim = new PitchSim();
  sim.sync([
    { id: 'me', side: 'home', spot: { depth: 0.8, lat: 0.5 }, pos: 'FWD', pace: 70, name: 'Me' },
    { id: 'gk', side: 'away', spot: { depth: 0, lat: 0.5 }, pos: 'GK', pace: 50, name: 'Keeper' },
  ]);
  Object.assign(sim.bodies.get('me')!, { x: PW / 2, y: PL - 12 });
  Object.assign(sim.bodies.get('gk')!, { x: PW / 2, y: PL - 0.7 });
  sim.ball.owner = 'me';
  Object.assign(sim.ball, { x: PW / 2, y: PL - 12 });
  let goals = 0;
  let sawCheck = false;
  let callouts: string[] = [];
  sim.setHooks({ onGoal: () => goals++ });
  sim.enqueue([
    { x: 0.5, y: (PL - 12) / PL, carrier: 'me', side: 'home', act: 'start' },
    { x: 0.5, y: 0.99, carrier: null, side: v === 'stands' ? 'home' : 'away', act: 'goal', aim: 0.1, var: v, varReason: 'Offside in the build-up', restart: v === 'overturned' ? 'freekick' : undefined },
  ]);
  for (let i = 0; i < 1500; i++) {
    sim.update(1 / 60);
    if (sim.varCheck) sawCheck = true;
    if (sim.callout && callouts[callouts.length - 1] !== sim.callout.text) callouts = [...callouts, sim.callout.text];
  }
  return { goals, sawCheck, callouts };
}

describe('VAR on the pitch', () => {
  it('a goal that stands counts after the check', () => {
    const r = play('stands');
    expect(r.sawCheck).toBe(true);
    expect(r.callouts).toEqual(['VAR CHECK', 'GOAL!']);
    expect(r.goals).toBe(1);
  });

  it('a goal ruled out never counts', () => {
    const r = play('overturned');
    expect(r.sawCheck).toBe(true);
    expect(r.callouts).toEqual(['VAR CHECK', 'NO GOAL']);
    expect(r.goals).toBe(0);
  });
});
