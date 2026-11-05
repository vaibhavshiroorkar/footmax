jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()), getItem: jest.fn(() => Promise.resolve(null)),
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../../src/state/settings';

it('restores the referee voice preference after restarting the app', async () => {
  useSettings.getState().set({ refVoice: false });
  const saved = jest.mocked(AsyncStorage.setItem).mock.calls.at(-1)![1];
  useSettings.setState({ refVoice: true });
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(saved);
  await useSettings.getState().load();
  expect(useSettings.getState().refVoice).toBe(false);
});
