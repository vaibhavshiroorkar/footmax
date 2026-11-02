import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo } from 'react-native';

export type MatchSpeed = '1' | '2' | '4';

export interface Settings {
  haptics: boolean;
  // The player's choice; the OS "reduce motion" setting also counts.
  reduceMotion: boolean;
  matchSpeed: MatchSpeed;
  autoMoments: boolean;
  // First-visit tips on the career hub have been shown.
  seenTips: boolean;
}

const KEY = 'footmax-settings';
const DEFAULTS: Settings = { haptics: true, reduceMotion: false, matchSpeed: '1', autoMoments: false, seenTips: false };

interface SettingsStore extends Settings {
  osReduceMotion: boolean;
  load: () => Promise<void>;
  set: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  osReduceMotion: false,
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch {
      // Bad or missing settings fall back to the defaults.
    }
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => set({ osReduceMotion: !!on }))
      .catch(() => {});
    AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on) => set({ osReduceMotion: !!on }));
  },
  set: (patch) => {
    set(patch);
    const { haptics, reduceMotion, matchSpeed, autoMoments, seenTips } = { ...get(), ...patch };
    AsyncStorage.setItem(KEY, JSON.stringify({ haptics, reduceMotion, matchSpeed, autoMoments, seenTips })).catch(() => {});
  },
}));

// Read outside React (animations, haptics) without subscribing.
export const motionReduced = () => {
  const s = useSettings.getState();
  return s.reduceMotion || s.osReduceMotion;
};
export const hapticsOn = () => useSettings.getState().haptics;
