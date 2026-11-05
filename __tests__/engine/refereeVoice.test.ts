import { PitchSim, RefCall } from '../../src/engine/matchRuntime/pitch';

function match() {
  const sim = new PitchSim(10);
  sim.sync([
    { id: 'a', side: 'home', name: 'A', pos: 'MID', pace: 70, spot: { depth: 0.5, lat: 0.5 } },
    { id: 'b', side: 'away', name: 'B', pos: 'MID', pace: 70, spot: { depth: 0.5, lat: 0.5 } },
  ]);
  sim.layout = 'play';
  const calls: RefCall[] = [];
  sim.setHooks({ onSound: (name) => { if (name.startsWith('ref-')) calls.push(name as RefCall); } });
  return { sim, calls };
}

it('announces a free kick that opens without a preceding foul animation', () => {
  const { sim, calls } = match();
  sim.enqueue([{ act: 'start', restart: 'freekick', side: 'home', carrier: 'a', x: 0.5, y: 0.5 }]);
  for (let i = 0; i < 500; i++) sim.update(1 / 60);
  expect(calls).toEqual(['ref-freekick']);
});

it('does not repeat a free-kick call after the foul and booking', () => {
  const { sim, calls } = match();
  sim.enqueue([
    { act: 'foul', restart: 'freekick', side: 'home', carrier: 'b', other: 'a', x: 0.5, y: 0.5 },
    { act: 'card', card: 'yellow', side: 'away', carrier: 'b', x: 0.5, y: 0.5 },
    { act: 'start', restart: 'freekick', side: 'home', carrier: 'a', x: 0.5, y: 0.5 },
  ]);
  for (let i = 0; i < 1000; i++) sim.update(1 / 60);
  expect(calls).toEqual(['ref-freekick']);
});
