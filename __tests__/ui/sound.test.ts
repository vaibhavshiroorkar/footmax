jest.mock('../../src/state/settings', () => ({
  soundOn: jest.fn(() => true),
  useSettings: { getState: jest.fn(() => ({ sound: true, refVoice: true })), subscribe: jest.fn() },
}));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn(() => Promise.resolve()) }));

import { createAudioPlayer } from 'expo-audio';
import { playSound } from '../../src/ui/sound';
import { soundOn, useSettings } from '../../src/state/settings';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('sound playback ordering', () => {
  beforeEach(() => { jest.mocked(soundOn).mockReturnValue(true); });

  it('waits for rewind and does not start the same voice twice during loading', async () => {
    let rewound!: () => void;
    const player = { playing: false, volume: 1, loop: false, pause: jest.fn(), play: jest.fn(),
      seekTo: jest.fn(() => new Promise<void>((resolve) => { rewound = resolve; })) };
    jest.mocked(createAudioPlayer).mockReturnValue(player as never);
    playSound('ref-freekick');
    playSound('ref-freekick');
    await flush();
    expect(player.seekTo).toHaveBeenCalledTimes(1);
    expect(player.play).not.toHaveBeenCalled();
    rewound();
    await flush();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('does not play a clip muted while rewind was pending', async () => {
    let rewound!: () => void;
    const player = { playing: false, volume: 1, loop: false, pause: jest.fn(), play: jest.fn(),
      seekTo: jest.fn(() => new Promise<void>((resolve) => { rewound = resolve; })) };
    jest.mocked(createAudioPlayer).mockReturnValue(player as never);
    playSound('reward');
    await flush();
    jest.mocked(soundOn).mockReturnValue(false);
    rewound();
    await flush();
    expect(player.play).not.toHaveBeenCalled();
  });

  it('releases a failed seek so the next request can play', async () => {
    const player = { playing: false, volume: 1, loop: false, pause: jest.fn(), play: jest.fn(),
      seekTo: jest.fn().mockRejectedValueOnce(new Error('not loaded')).mockResolvedValue(undefined) };
    jest.mocked(createAudioPlayer).mockReturnValue(player as never);
    playSound('tap');
    await flush();
    expect(player.play).not.toHaveBeenCalled();
    playSound('tap');
    await flush();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('cancels an old voice when a new call replaces it', async () => {
    let rewound!: () => void;
    const first = { playing: false, volume: 1, loop: false, pause: jest.fn(), play: jest.fn(),
      seekTo: jest.fn(() => new Promise<void>((resolve) => { rewound = resolve; })) };
    const second = { playing: false, volume: 1, loop: false, pause: jest.fn(), play: jest.fn(), seekTo: jest.fn().mockResolvedValue(undefined) };
    jest.mocked(createAudioPlayer).mockReturnValueOnce(first as never).mockReturnValueOnce(second as never);
    playSound('ref-corner');
    await flush();
    playSound('ref-penalty');
    await flush();
    rewound();
    await flush();
    expect(first.pause).toHaveBeenCalled();
    expect(first.play).not.toHaveBeenCalled();
    expect(second.play).toHaveBeenCalledTimes(1);
  });

  it('stops active clips as soon as sound is turned off', async () => {
    const player = { playing: false, volume: 1, loop: false, pause: jest.fn(), play: jest.fn(), seekTo: jest.fn().mockResolvedValue(undefined) };
    jest.mocked(createAudioPlayer).mockReturnValue(player as never);
    playSound('goal');
    await flush();
    const changed = jest.mocked(useSettings.subscribe).mock.calls[0][0] as (s: { sound: boolean; refVoice: boolean }) => void;
    changed({ sound: false, refVoice: true });
    expect(player.pause).toHaveBeenCalledTimes(1);
  });
});
