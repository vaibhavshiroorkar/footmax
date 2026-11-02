import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { soundOn } from '../state/settings';

// Sound effects, made by scripts/makeSounds.py. Players are created on first
// use and reused; a few copies of the short ones let them overlap (two
// quick passes).
const SOURCES = {
  kick: require('../../assets/sounds/kick.wav'),
  whistle: require('../../assets/sounds/whistle.wav'),
  'whistle-end': require('../../assets/sounds/whistle-end.wav'),
  goal: require('../../assets/sounds/goal.wav'),
  ooh: require('../../assets/sounds/ooh.wav'),
  crowd: require('../../assets/sounds/crowd.wav'),
  reward: require('../../assets/sounds/reward.wav'),
  fanfare: require('../../assets/sounds/fanfare.wav'),
  tap: require('../../assets/sounds/tap.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const pools = new Map<SoundName, AudioPlayer[]>();
let modeSet = false;

function setMode() {
  if (modeSet) return;
  modeSet = true;
  // Effects mix with the user's music and play with the ringer off.
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
}

export function playSound(name: SoundName, volume = 1): void {
  if (!soundOn()) return;
  try {
    setMode();
    let pool = pools.get(name);
    if (!pool) {
      pool = [];
      pools.set(name, pool);
    }
    let p = pool.find((x) => !x.playing);
    if (!p && pool.length < 3) {
      p = createAudioPlayer(SOURCES[name]);
      pool.push(p);
    }
    p = p ?? pool[0];
    p.volume = volume;
    p.seekTo(0);
    p.play();
  } catch {
    // Sound is a nicety: a browser that blocks audio must not break the game.
  }
}

let crowdLoop: AudioPlayer | null = null;

// The murmur of the crowd under a live match.
export function crowdAmbience(on: boolean): void {
  try {
    if (on && soundOn()) {
      setMode();
      if (!crowdLoop) {
        crowdLoop = createAudioPlayer(SOURCES.crowd);
        crowdLoop.loop = true;
        crowdLoop.volume = 0.35;
      }
      if (!crowdLoop.playing) crowdLoop.play();
    } else if (crowdLoop) crowdLoop.pause();
  } catch {
    // See playSound.
  }
}
