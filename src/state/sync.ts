import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { useStore } from './store';
import { readSlotRaw, writeSlotRaw } from './storage';
import { MAX_SLOTS, SlotMeta, displayMeta, isDirty } from './slots';
import { needsDownload, resolveSync } from './syncMerge';

// Cloud saves. The device is the source of truth while playing; the cloud
// gets a copy a few seconds after each save, and other devices pull it.
//
// Each cloud save is a row in `saves` (summary + revision) plus a file at
// <user>/<slot>-<revision>.fmx. A push uploads the new file, then moves the
// row from the revision this device last saw to the next one. If another
// device moved it first, the update matches no row: that is a conflict, and
// the player picks which copy to keep.

const PUSH_DELAY = 15_000;
const BUCKET = 'saves';

interface SyncState {
  busy: boolean;
  offline: boolean;
  error: string | null;
  lastSync: number | null;
  // Saves on this device that belong to no account, offered for upload.
  guestSlots: string[];
}

export const useSync = create<SyncState>(() => ({ busy: false, offline: false, error: null, lastSync: null, guestSlots: [] }));

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let started = false;

const uid = () => useAuth.getState().session?.user.id ?? null;
const slot = (id: string) => useStore.getState().slots.find((s) => s.id === id);
const patch = (id: string, p: Partial<SlotMeta>) => useStore.getState().patchSlots((all) => all.map((s) => (s.id === id ? { ...s, ...p } : s)));
const filePath = (user: string, id: string, rev: number) => `${user}/${id}-${rev}.fmx`;

function netError(e: unknown): boolean {
  const m = String((e as { message?: string })?.message ?? e).toLowerCase();
  return m.includes('fetch') || m.includes('network') || m.includes('failed to');
}

function failed(e: unknown) {
  if (netError(e)) useSync.setState({ offline: true, busy: false });
  else useSync.setState({ error: String((e as { message?: string })?.message ?? e), busy: false });
}

export async function pushSlot(id: string): Promise<void> {
  const user = uid();
  const m = slot(id);
  if (!supabase || !user || !m || m.owner !== user || m.cloudOnly || m.conflict) return;
  if (!isDirty(m) && m.cloudRev) return;
  const raw = await readSlotRaw(id);
  if (!raw) return;
  // Changes saved during the upload stay dirty and go up next time.
  const sentLocalRev = m.localRev ?? 0;
  const next = (m.cloudRev ?? 0) + 1;
  useSync.setState({ busy: true, error: null });
  try {
    const up = await supabase.storage.from(BUCKET).upload(filePath(user, id, next), raw, { contentType: 'application/octet-stream', upsert: true });
    if (up.error) throw up.error;
    const row = { meta: displayMeta(m), revision: next, updated_at: new Date().toISOString() };
    let moved: boolean;
    if (m.cloudRev) {
      const { data, error } = await supabase.from('saves').update(row).eq('user_id', user).eq('slot_id', id).eq('revision', m.cloudRev).select('slot_id');
      if (error) throw error;
      moved = (data?.length ?? 0) > 0;
    } else {
      const { error } = await supabase.from('saves').insert({ user_id: user, slot_id: id, ...row });
      if (error?.code === 'P0001') {
        await supabase.storage.from(BUCKET).remove([filePath(user, id, next)]);
        useSync.setState({ busy: false, error: `Your account already has ${MAX_SLOTS} cloud saves. Delete one to sync this save.` });
        return;
      }
      if (error && error.code !== '23505') throw error;
      moved = !error;
    }
    if (!moved) {
      // Another device got there first. Keep both copies and ask.
      await supabase.storage.from(BUCKET).remove([filePath(user, id, next)]);
      await patch(id, { conflict: true });
      useSync.setState({ busy: false });
      return;
    }
    if (m.cloudRev) await supabase.storage.from(BUCKET).remove([filePath(user, id, m.cloudRev)]);
    await publishBoard(user, { ...m });
    await patch(id, { cloudRev: next, remoteRev: undefined, syncedLocalRev: sentLocalRev });
    useSync.setState({ busy: false, offline: false, lastSync: Date.now() });
  } catch (e) {
    failed(e);
  }
}

// Leaderboard row for this save. The database hides it if the profile is
// private, so it is written either way.
async function publishBoard(user: string, m: SlotMeta) {
  const b = m.board;
  if (!supabase || !b) return;
  const { error } = await supabase.from('leaderboard').upsert({
    user_id: user,
    slot_id: m.id,
    mode: b.mode,
    name: b.name.slice(0, 60) || 'Unnamed',
    club: b.club?.slice(0, 60) ?? null,
    look: m.look ?? null,
    peak_ovr: b.peakOvr,
    apps: b.apps,
    goals: b.goals,
    assists: b.assists,
    seasons: b.seasons,
    ballon_dors: b.ballonDors,
    trophies: b.trophies,
    league_titles: b.leagueTitles,
    retired: b.retired,
    updated_at: new Date().toISOString(),
  });
  // A rejected row (numbers out of range) must not block the save itself.
  if (error) console.warn('Leaderboard update failed', error.message);
}

export function schedulePush(id: string, delay = PUSH_DELAY) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      pushSlot(id);
    }, delay),
  );
}

// Sends everything waiting, e.g. when the app goes to the background.
export function flushPushes() {
  for (const [id, t] of timers) {
    clearTimeout(t);
    timers.delete(id);
    pushSlot(id);
  }
}

export async function pullAll(): Promise<void> {
  const user = uid();
  if (!supabase || !user) return;
  useSync.setState({ busy: true, error: null });
  const { data, error } = await supabase.from('saves').select('slot_id, meta, revision');
  if (error) return failed(error);
  const rows = (data ?? []) as { slot_id: string; meta: SlotMeta; revision: number }[];
  const removed: string[] = [];
  await useStore.getState().patchSlots((all) => {
    const { slots, gone } = resolveSync(all, rows, user);
    removed.push(...gone);
    return slots;
  });
  // The open game may have been deleted or moved on by another device.
  const open = useStore.getState().slotId;
  if (removed.includes(open ?? '')) useStore.setState({ game: null, slotId: null });
  const current = open ? slot(open) : undefined;
  if (current && needsDownload(current)) await downloadSlot(current.id);
  useSync.setState({ busy: false, offline: false, lastSync: Date.now() });
  for (const m of useStore.getState().slots) if (m.owner === user && isDirty(m) && !m.conflict && !m.cloudOnly) pushSlot(m.id);
  refreshGuestSlots();
}

// Brings the cloud copy down to this device (a save from another device, or
// "keep the cloud copy" in a conflict).
export async function downloadSlot(id: string): Promise<string | null> {
  const user = uid();
  const m = slot(id);
  if (!supabase || !user || !m) return 'Sign in to open cloud saves.';
  const rev = m.remoteRev ?? m.cloudRev;
  if (!rev) return 'This save is not in the cloud.';
  useSync.setState({ busy: true });
  const { data, error } = await supabase.storage.from(BUCKET).download(filePath(user, id, rev));
  if (error || !data) {
    failed(error ?? 'download failed');
    return 'Could not download this save. Check your connection and try again.';
  }
  const raw = await data.text();
  await writeSlotRaw(id, raw);
  const local = (m.localRev ?? 0) + 1;
  await patch(id, { cloudOnly: false, conflict: false, cloudRev: rev, remoteRev: undefined, localRev: local, syncedLocalRev: local });
  useSync.setState({ busy: false, lastSync: Date.now() });
  if (useStore.getState().slotId === id) await useStore.getState().loadSlot(id, true);
  return null;
}

// Conflict choice: overwrite the cloud with this device's copy.
export async function keepThisDevice(id: string): Promise<void> {
  const user = uid();
  if (!supabase || !user) return;
  const { data } = await supabase.from('saves').select('revision').eq('slot_id', id).maybeSingle();
  await patch(id, { conflict: false, cloudRev: (data as { revision: number } | null)?.revision, remoteRev: undefined, syncedLocalRev: 0 });
  await pushSlot(id);
}

async function deleteRemote(user: string, id: string) {
  if (!supabase) return;
  const { data: files } = await supabase.storage.from(BUCKET).list(user, { search: `${id}-` });
  if (files?.length) await supabase.storage.from(BUCKET).remove(files.map((f) => `${user}/${f.name}`));
  await supabase.from('leaderboard').delete().eq('user_id', user).eq('slot_id', id);
  await supabase.from('saves').delete().eq('user_id', user).eq('slot_id', id);
}

function refreshGuestSlots() {
  const guest = useStore.getState().slots.filter((s) => !s.owner).map((s) => s.id);
  useSync.setState({ guestSlots: uid() ? guest : [] });
}

// First sign-in on a device: adopt its guest saves into the account.
export async function uploadGuestSlots(ids: string[]): Promise<string | null> {
  const user = uid();
  if (!user) return 'Sign in first.';
  const cloudCount = useStore.getState().slots.filter((s) => s.owner === user).length;
  const room = Math.max(0, MAX_SLOTS - cloudCount);
  const take = ids.slice(0, room);
  await useStore.getState().patchSlots((all) => all.map((s) => (take.includes(s.id) ? { ...s, owner: user, syncedLocalRev: 0, localRev: Math.max(1, s.localRev ?? 0) } : s)));
  refreshGuestSlots();
  for (const id of take) await pushSlot(id);
  return take.length < ids.length ? `Only ${take.length} fitted: an account holds ${MAX_SLOTS} cloud saves.` : null;
}

export function dismissGuestSlots() {
  useSync.setState({ guestSlots: [] });
}

// Wires sync to sign-in, local saves, deletions and the app going idle.
export function startSync() {
  if (started || !supabase) return;
  started = true;
  let user: string | null = null;
  const onAuth = () => {
    const next = uid();
    if (next === user) return;
    user = next;
    useStore.getState().setDefaultOwner(next);
    if (next) pullAll();
    else useSync.setState({ guestSlots: [] });
  };
  useAuth.subscribe(onAuth);
  onAuth();

  useStore.subscribe((s, prev) => {
    const me = uid();
    if (!me) return;
    if (s.lastSaved !== prev.lastSaved && s.slotId) {
      const m = s.slots.find((x) => x.id === s.slotId);
      if (m?.owner === me) schedulePush(m.id);
    }
    // A deleted slot that was in the cloud goes from the cloud too.
    if (s.slots !== prev.slots) {
      for (const old of prev.slots) {
        if (old.owner === me && old.cloudRev && !s.slots.some((x) => x.id === old.id)) deleteRemote(me, old.id);
      }
      // A slot started while signed in syncs right away.
      for (const m of s.slots) if (m.owner === me && !m.cloudRev && !prev.slots.some((x) => x.id === m.id)) schedulePush(m.id, 2_000);
    }
  });

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushPushes());
    window.addEventListener('online', () => {
      useSync.setState({ offline: false });
      if (uid()) pullAll();
    });
    window.addEventListener('offline', () => useSync.setState({ offline: true }));
  } else {
    AppState.addEventListener('change', (state) => {
      if (state === 'background') flushPushes();
      if (state === 'active' && uid()) pullAll();
    });
  }
}
