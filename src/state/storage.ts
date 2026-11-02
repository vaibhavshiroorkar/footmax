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

// The ":parts" key points at the current copy as "<generation>:<count>".
// A write puts the new copy under a fresh generation and only then moves the
// pointer, so running out of space halfway leaves the old copy readable.
// Values written before this change use a bare count with chunks at
// "<key>:<i>"; reads still accept that.
export async function writeChunked(key: string, text: string): Promise<void> {
  const parts = Math.max(1, Math.ceil(text.length / CHUNK));
  const gen = `g${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const pairs: [string, string][] = [];
  for (let i = 0; i < parts; i++) pairs.push([`${key}:${gen}:${i}`, text.slice(i * CHUNK, (i + 1) * CHUNK)]);
  try {
    await AsyncStorage.multiSet(pairs);
  } catch (e) {
    // Free what was written so the failed attempt does not eat the quota.
    await AsyncStorage.multiRemove(pairs.map(([k]) => k)).catch(() => {});
    throw e;
  }
  await AsyncStorage.setItem(`${key}:parts`, `${gen}:${parts}`);
  const all = await AsyncStorage.getAllKeys();
  const stale = all.filter((k) => k.startsWith(`${key}:`) && k !== `${key}:parts` && !k.startsWith(`${key}:${gen}:`));
  if (stale.length) await AsyncStorage.multiRemove(stale);
}

export async function readChunked(key: string): Promise<string | null> {
  const pointer = await AsyncStorage.getItem(`${key}:parts`);
  if (!pointer) return null;
  const sep = pointer.lastIndexOf(':');
  const prefix = sep >= 0 ? `${key}:${pointer.slice(0, sep)}:` : `${key}:`;
  const parts = Number(sep >= 0 ? pointer.slice(sep + 1) : pointer);
  if (!parts) return null;
  const keys = Array.from({ length: parts }, (_, i) => `${prefix}${i}`);
  const values = await AsyncStorage.multiGet(keys);
  if (values.some(([, v]) => v === null)) return null;
  return values.map(([, v]) => v).join('');
}

export async function deleteChunked(key: string): Promise<void> {
  const all = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(all.filter((k) => k.startsWith(`${key}:`)));
}

const SLOT_PREFIX = 'footmax-slot-';
const slotKey = (id: string) => `${SLOT_PREFIX}${id}`;

export const writeSlot = (id: string, text: string) => writeChunked(slotKey(id), compress(text));
// Stores a save that is already compressed, such as one from the cloud.
export const writeSlotRaw = (id: string, raw: string) => writeChunked(slotKey(id), raw);
export async function readSlot(id: string): Promise<string | null> {
  const raw = await readChunked(slotKey(id));
  return raw === null ? null : decompress(raw);
}
export const deleteSlotData = (id: string) => deleteChunked(slotKey(id));
// The compressed text as stored, for save files people export and import.
export const readSlotRaw = (id: string) => readChunked(slotKey(id));

// A crash between writing a slot and writing the index leaves slot data no
// save points at. It only wastes quota, so it is cleared on launch.
export async function dropOrphanSlots(known: string[]): Promise<void> {
  const keep = new Set(known.map(slotKey));
  const all = await AsyncStorage.getAllKeys();
  const orphans = all.filter((k) => k.startsWith(SLOT_PREFIX) && !keep.has(k.slice(0, k.indexOf(':'))));
  if (orphans.length) await AsyncStorage.multiRemove(orphans);
}
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
