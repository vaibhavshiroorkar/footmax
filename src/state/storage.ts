import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SlotMeta } from './slots';
import { compress, decompress } from './compress';

// Android's AsyncStorage struggles with single values over ~2MB. Saves are
// compressed now, but data packs are not, so big values are still split
// across several keys.
const CHUNK = 400_000;
// Single save from before slots existed; moved into a slot on first load.
export const LEGACY_SAVE_KEY = 'footmax-save';
export const PACK_KEY = 'footmax-pack';
// The slot list is small and read on every launch, so the title screen can
// show every save without loading any of them.
const INDEX_KEY = 'footmax-slots';
const LAST_KEY = 'footmax-last-slot';

export async function writeChunked(key: string, text: string): Promise<void> {
  const parts = Math.ceil(text.length / CHUNK);
  const pairs: [string, string][] = [[`${key}:parts`, String(parts)]];
  for (let i = 0; i < parts; i++) pairs.push([`${key}:${i}`, text.slice(i * CHUNK, (i + 1) * CHUNK)]);
  await AsyncStorage.multiSet(pairs);
  // A smaller save leaves old chunks behind; drop them.
  const all = await AsyncStorage.getAllKeys();
  const stale = all.filter((k) => k.startsWith(`${key}:`) && k !== `${key}:parts` && Number(k.slice(key.length + 1)) >= parts);
  if (stale.length) await AsyncStorage.multiRemove(stale);
}

export async function readChunked(key: string): Promise<string | null> {
  const parts = Number(await AsyncStorage.getItem(`${key}:parts`));
  if (!parts) return null;
  const keys = Array.from({ length: parts }, (_, i) => `${key}:${i}`);
  const values = await AsyncStorage.multiGet(keys);
  if (values.some(([, v]) => v === null)) return null;
  return values.map(([, v]) => v).join('');
}

export async function deleteChunked(key: string): Promise<void> {
  const all = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(all.filter((k) => k.startsWith(`${key}:`)));
}

const slotKey = (id: string) => `footmax-slot-${id}`;

export const writeSlot = (id: string, text: string) => writeChunked(slotKey(id), compress(text));
export async function readSlot(id: string): Promise<string | null> {
  const raw = await readChunked(slotKey(id));
  return raw === null ? null : decompress(raw);
}
export const deleteSlotData = (id: string) => deleteChunked(slotKey(id));
export const readLegacySave = () => readChunked(LEGACY_SAVE_KEY);
export const deleteLegacySave = () => deleteChunked(LEGACY_SAVE_KEY);

export async function readIndex(): Promise<SlotMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as SlotMeta[]) : [];
  } catch {
    return [];
  }
}

export const writeIndex = (slots: SlotMeta[]) => AsyncStorage.setItem(INDEX_KEY, JSON.stringify(slots));
export const readLastSlot = () => AsyncStorage.getItem(LAST_KEY);
export const writeLastSlot = (id: string) => AsyncStorage.setItem(LAST_KEY, id);
