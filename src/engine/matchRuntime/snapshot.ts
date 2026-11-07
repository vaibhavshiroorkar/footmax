import type { Active, Body, PitchSim } from './pitch';
import type { PlayStep } from '../play';
import type { ShotState } from './shot';

// Captured values are detached from the runtime. A camera can keep a frame
// without live movement changing it, or mutate its copy without moving players.
export interface PitchSnapshot {
  revision: number;
  clock: number;
  randomState: number;
  players: Body[];
  ball: PitchSim['ball'];
  referee: PitchSim['ref'];
  layout: PitchSim['layout'];
  kickoffSide: PitchSim['kickoffSide'];
  attacking: PitchSim['attacking'];
  holding: boolean;
  interaction: { id: string; revision: number } | null;
  physicalShot: ShotState | null;
  action: Active | null;
  queue: PlayStep[];
  setPiece: PitchSim['setPiece'];
  offsideLine: PitchSim['offsideLine'];
  celebration: PitchSim['celebrate'];
  varCheck: PitchSim['varCheck'];
  callout: PitchSim['callout'];
  focus: PitchSim['focus'];
}
