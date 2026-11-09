import AsyncStorage from '@react-native-async-storage/async-storage';
import { dropOrphanSlots, readChunked, writeChunked } from '../../src/state/storage';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const big = (n: number, ch: string) => ch.repeat(n);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('chunked storage', () => {
  it('round-trips a value larger than one chunk', async () => {
    const text = big(950_000, 'a') + 'end';
    await writeChunked('k', text);
    expect(await readChunked('k')).toBe(text);
  });

  it('keeps a readable copy when two writes overlap', async () => {
    // An autosave and a background save can start before the other ends.
    // Each used to delete the other's chunks as stale.
    const a = writeChunked('k', big(500_000, 'a'));
    const b = writeChunked('k', big(500_000, 'b'));
    await Promise.all([a, b]);
    expect(await readChunked('k')).toBe(big(500_000, 'b'));
  });

  it('removes the old copy after a smaller write', async () => {
    await writeChunked('k', big(900_000, 'a'));
    await writeChunked('k', 'small');
    expect(await readChunked('k')).toBe('small');
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('k:'));
    expect(keys).toHaveLength(2); // the pointer and one chunk
  });

  it('keeps the old save readable when storage fills up mid-write', async () => {
    await writeChunked('k', big(500_000, 'a'));
    const real = AsyncStorage.multiSet;
    // Simulate a quota error after the first new chunk lands.
    jest.spyOn(AsyncStorage, 'multiSet').mockImplementationOnce(async (pairs) => {
      await real(pairs.slice(0, 1));
      throw new Error('QuotaExceededError');
    });
    await expect(writeChunked('k', big(900_000, 'b'))).rejects.toThrow('Quota');
    expect(await readChunked('k')).toBe(big(500_000, 'a'));
    // The half-written copy does not linger.
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('k:'));
    expect(keys).toHaveLength(3);
  });

  it('still reads values in the old bare-count format', async () => {
    await AsyncStorage.multiSet([
      ['old:parts', '2'],
      ['old:0', 'hello '],
      ['old:1', 'world'],
    ]);
    expect(await readChunked('old')).toBe('hello world');
  });

  it('drops slot data that no index entry points at', async () => {
    await writeChunked('footmax-slot-keep', 'a');
    await writeChunked('footmax-slot-gone', 'b');
    await dropOrphanSlots(['keep']);
    expect(await readChunked('footmax-slot-keep')).toBe('a');
    expect(await readChunked('footmax-slot-gone')).toBeNull();
  });
});
