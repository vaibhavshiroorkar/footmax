import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { soundOn, useSettings } from '../state/settings';

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
  // The referee, built by scripts/makeRefVoice.py.
  'ref-penalty': require('../../assets/sounds/ref-penalty.wav'),
  'ref-freekick': require('../../assets/sounds/ref-freekick.wav'),
  'ref-corner': require('../../assets/sounds/ref-corner.wav'),
  'ref-offside': require('../../assets/sounds/ref-offside.wav'),
  'ref-playon': require('../../assets/sounds/ref-playon.wav'),
  'ref-goalkick': require('../../assets/sounds/ref-goalkick.wav'),
  'ref-nogoal': require('../../assets/sounds/ref-nogoal.wav'),
  'ref-handball': require('../../assets/sounds/ref-handball.wav'),
  'ref-off': require('../../assets/sounds/ref-off.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

type Slot = { player: AudioPlayer; pending: boolean; revision: number; started: number };
const pools = new Map<SoundName, Slot[]>();
let mode: Promise<void> | null = null;
let voice: { name: SoundName; slot: Slot } | null = null;

function setMode() {
  // Effects mix with the user's music and play with the ringer off.
  mode ??= setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch((error) => {
    mode = null;
    throw error;
  });
  return mode;
}

const enabled = (name: SoundName) => soundOn() && (!name.startsWith('ref-') || useSettings.getState().refVoice);
const stop = (slot: Slot) => {
  slot.revision++;
  slot.pending = false;
  slot.player.pause();
};

export function playSound(name: SoundName, volume = 1): void {
  if (!enabled(name)) return;
  try {
    const spoken = name.startsWith('ref-');
    if (spoken && voice) {
      const current = voice.slot;
      if (voice.name === name && (current.pending || current.player.playing || Date.now() - current.started < 750)) return;
      stop(current);
    }
    let pool = pools.get(name);
    if (!pool) {
      pool = [];
      pools.set(name, pool);
    }
    let slot = pool.find((x) => !x.pending && !x.player.playing);
    if (!slot && pool.length < (spoken ? 1 : 3)) {
      slot = { player: createAudioPlayer(SOURCES[name]), pending: false, revision: 0, started: -Infinity };
      pool.push(slot);
    }
    if (!slot) return;
    slot.pending = true;
    const reserved = slot;
    const revision = ++reserved.revision;
    if (spoken) voice = { name, slot: reserved };
    void (async () => {
      try {
        await setMode();
        if (reserved.revision !== revision || !enabled(name)) return;
        reserved.player.loop = false;
        reserved.player.volume = volume;
        await reserved.player.seekTo(0);
        if (reserved.revision !== revision || !enabled(name)) return;
        reserved.player.play();
        reserved.started = Date.now();
      } catch {
        // A rejected load or seek must release the slot for the next sound.
      } finally {
        if (reserved.revision === revision) reserved.pending = false;
      }
    })();
  } catch {
    // Sound is a nicety: a browser that blocks audio must not break the game.
  }
}

let crowdLoop: AudioPlayer | null = null;

// The murmur of the crowd under a live match. volume follows the size of
// the crowd (see ground.ts).
export function crowdAmbience(on: boolean, volume = 0.35): void {
  try {
    if (on && soundOn()) {
      void setMode().catch(() => {});
      if (!crowdLoop) {
        crowdLoop = createAudioPlayer(SOURCES.crowd);
        crowdLoop.loop = true;
      }
      crowdLoop.volume = volume;
      if (!crowdLoop.playing) crowdLoop.play();
    } else {
      crowdLoop?.pause();
      if (voice) stop(voice.slot);
      voice = null;
    }
  } catch {
    // See playSound.
  }
}

useSettings.subscribe((settings) => {
  try {
    for (const [name, pool] of pools) {
      if (!settings.sound || (name.startsWith('ref-') && !settings.refVoice)) pool.forEach(stop);
    }
    if (!settings.sound) crowdLoop?.pause();
    if (!settings.sound || !settings.refVoice) voice = null;
  } catch {
    // Native playback may already have been released during app shutdown.
  }
});
