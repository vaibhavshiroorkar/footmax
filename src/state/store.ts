import { create } from 'zustand';
import { Game } from '../engine/types';
import { MatchState } from '../engine/match';
import { loadErrorText, loadSave, serialize } from '../engine/save';
import { DataPack } from '../data/pack';
import type { CelebrationData } from '../ui/celebration';
import { parsePackText } from '../engine/editor';
import { takeRewards } from '../engine/progress';
import { actionMessages, readyUpgrades, upgradeCount } from '../engine/alerts';
import { MAX_SLOTS, SlotMeta, newSlotId, slotMeta } from './slots';
import { PACK_KEY, deleteChunked, deleteLegacySave, deleteSlotData, dropOrphanSlots, readChunked, readIndex, readLastSlot, readLegacySave, readSlot, writeChunked, writeIndex, writeLastSlot, writeSlot } from './storage';

interface Toast {
  text: string;
  // Tapping a toast with a link opens that screen.
  href?: string;
}

interface Store {
  game: Game | null;
  // Engine functions mutate the game in place; rev tells React it changed.
  rev: number;
  ready: boolean;
  live: MatchState | null;
  liveRev: number;
  toast: Toast | null;
  // Imported data pack used for new games instead of the built-in one.
  customPack: DataPack | null;
  // Celebrations queue up; the overlay shows the first one.
  celebration: CelebrationData | null;
  queue: CelebrationData[];
  // Every save on this device, newest first, and the one being played.
  slots: SlotMeta[];
  slotId: string | null;
  lastSaved: number | null;
  // Account that new saves sync to; set by sync.ts while signed in.
  defaultOwner: string | null;
  setDefaultOwner: (id: string | null) => void;
  // Changes slot entries without loading their games (used by sync).
  patchSlots: (fn: (slots: SlotMeta[]) => SlotMeta[]) => Promise<void>;
  celebrate: (c: CelebrationData | null) => void;
  init: () => Promise<void>;
  // Starts a new game in a fresh slot. False when every slot is in use.
  startGame: (g: Game, name?: string) => boolean;
  loadSlot: (id: string, force?: boolean) => Promise<boolean>;
  deleteSlot: (id: string) => Promise<void>;
  renameSlot: (id: string, name: string) => Promise<void>;
  saveNow: () => Promise<void>;
  mutate: <T>(fn: (g: Game) => T) => T;
  setLive: (m: MatchState | null) => void;
  mutateLive: (fn: (m: MatchState, g: Game) => void) => void;
  showToast: (text: string | null, href?: string) => void;
  setCustomPack: (pack: DataPack | null) => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

const sortSlots = (slots: SlotMeta[]) => [...slots].sort((a, b) => b.updatedAt - a.updatedAt);

export const useStore = create<Store>((set, get) => {
  async function persist(): Promise<void> {
    const { game, slotId } = get();
    if (!game || !slotId) return;
    await writeSlot(slotId, serialize(game));
    // The slot may have been deleted or switched while writing.
    if (get().slotId !== slotId) return;
    // Read the entry after the write: sync may have changed it meanwhile.
    const old = get().slots.find((s) => s.id === slotId);
    // Keep the sync fields and count this as a new local revision.
    const meta: SlotMeta = { ...old, ...slotMeta(slotId, game, old?.name), localRev: (old?.localRev ?? 0) + 1 };
    const next = sortSlots([meta, ...get().slots.filter((s) => s.id !== slotId)]);
    set({ slots: next, lastSaved: Date.now() });
    await writeIndex(next);
  }

  function saveFailed(e: unknown) {
    console.warn('Save failed', e);
    get().showToast('Could not save: device storage is full. Delete an old save on the title screen.', '/');
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persist().catch(saveFailed);
    }, 600);
  }

  // Writes a pending autosave before switching away from a game.
  async function flush() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    await persist();
  }

  return {
    game: null,
    rev: 0,
    ready: false,
    live: null,
    liveRev: 0,
    toast: null,
    customPack: null,
    celebration: null,
    queue: [],
    slots: [],
    slotId: null,
    lastSaved: null,
    defaultOwner: null,
    setDefaultOwner: (defaultOwner) => set({ defaultOwner }),
    patchSlots: async (fn) => {
      const slots = sortSlots(fn(get().slots));
      set({ slots });
      await writeIndex(slots);
    },
    // null closes the current one and shows the next.
    celebrate: (c) => {
      const { celebration, queue } = get();
      if (c === null) {
        const [next, ...rest] = queue;
        set({ celebration: next ?? null, queue: rest });
      } else if (celebration) set({ queue: [...queue, c] });
      else set({ celebration: c });
    },
    init: async () => {
      if (get().ready) return;
      try {
        let slots = await readIndex();
        // Saves from before slots existed move into the first slot. The old
        // key is only removed once the save has been read and copied.
        const legacy = slots.length ? null : await readLegacySave();
        if (legacy) {
          const old = loadSave(legacy);
          if (old.ok) {
            const id = newSlotId();
            await writeSlot(id, legacy);
            slots = [slotMeta(id, old.game)];
            await writeIndex(slots);
            await writeLastSlot(id);
            await deleteLegacySave();
          }
        }
        slots = sortSlots(slots);
        await dropOrphanSlots(slots.map((s) => s.id)).catch(() => {});
        const last = await readLastSlot();
        // Open the last save played; if it cannot be read, try the others.
        const order = [...slots.filter((s) => s.id === last), ...slots.filter((s) => s.id !== last)];
        let game: Game | null = null;
        let slotId: string | null = null;
        let failed = 0;
        for (const s of order) {
          // Saves listed from the cloud have no local copy until opened.
          if (s.cloudOnly) continue;
          const text = await readSlot(s.id).catch(() => null);
          const r = text ? loadSave(text) : null;
          if (r?.ok) {
            game = r.game;
            slotId = s.id;
            break;
          }
          failed++;
        }
        const packText = await readChunked(PACK_KEY);
        const customPack = packText ? parsePackText(packText).pack ?? null : null;
        set({ game, slotId, slots, customPack, ready: true });
        if (failed) get().showToast(`${failed} saved game${failed > 1 ? 's' : ''} could not be opened.`);
      } catch (e) {
        console.warn('Load failed', e);
        set({ ready: true });
      }
      // Ask the browser not to clear our storage under pressure. Safari
      // otherwise wipes it for sites not visited in 7 days.
      if (typeof navigator !== 'undefined' && navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    },
    startGame: (game, name) => {
      if (get().slots.length >= MAX_SLOTS) return false;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      const id = newSlotId();
      const owner = get().defaultOwner ?? undefined;
      const slots = sortSlots([{ ...slotMeta(id, game, name), owner }, ...get().slots]);
      set({ game, slotId: id, slots, rev: get().rev + 1, live: null, celebration: null, queue: [] });
      writeLastSlot(id);
      persist().catch(saveFailed);
      return true;
    },
    loadSlot: async (id, force) => {
      if (!force && id === get().slotId && get().game) return true;
      await flush();
      const text = await readSlot(id).catch(() => null);
      const r = text ? loadSave(text) : null;
      if (!r?.ok) {
        get().showToast(r ? loadErrorText(r.error) : 'This save could not be read.');
        return false;
      }
      set({ game: r.game, slotId: id, rev: get().rev + 1, live: null, celebration: null, queue: [] });
      await writeLastSlot(id);
      return true;
    },
    deleteSlot: async (id) => {
      if (id === get().slotId) {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = null;
        set({ game: null, slotId: null, live: null, rev: get().rev + 1 });
      }
      await deleteSlotData(id);
      const slots = get().slots.filter((s) => s.id !== id);
      set({ slots });
      await writeIndex(slots);
    },
    renameSlot: async (id, name) => {
      const slots = get().slots.map((s) => (s.id === id ? { ...s, name: name.trim() || undefined } : s));
      set({ slots });
      await writeIndex(slots);
    },
    saveNow: async () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      await persist();
    },
    mutate: (fn) => {
      const game = get().game;
      if (!game) throw new Error('No game loaded');
      const openBefore = new Set(actionMessages(game).map((m) => m.id));
      const upgradesBefore = upgradeCount(game);
      const out = fn(game);
      set({ rev: get().rev + 1 });
      scheduleSave();
      // Objectives and milestones show on the home screen; they no longer
      // pop up. Only things the player has to act on get a notice.
      takeRewards(game);
      const fresh = actionMessages(game).filter((m) => !openBefore.has(m.id));
      if (fresh.length) {
        const text = fresh.length === 1 ? `${fresh[0].title}. Needs your answer.` : `${fresh.length} new messages need your answer.`;
        // The caller may toast the result of the tap right after this
        // returns; that toast wins and the inbox badge still shows.
        setTimeout(() => {
          if (!get().toast) get().showToast(text, '/inbox');
        }, 50);
      }
      const upgrades = upgradeCount(game);
      if (upgrades > upgradesBefore) {
        const names = readyUpgrades(game).map((s) => s.label);
        const sub = names.length ? `You can upgrade ${names.slice(0, 2).join(' and ')}${names.length > 2 ? ` and ${names.length - 2} more` : ''}.` : 'You can learn a second position.';
        get().celebrate({ title: 'Upgrade ready', sub, icon: 'sparkles', action: { label: 'Open skills', href: '/career/train?tab=skills' } });
      }
      return out;
    },
    setLive: (live) => set({ live, liveRev: get().liveRev + 1 }),
    mutateLive: (fn) => {
      const { live, game } = get();
      if (!live || !game) return;
      fn(live, game);
      set({ liveRev: get().liveRev + 1 });
    },
    showToast: (text, href) => set({ toast: text ? { text, href } : null }),
    setCustomPack: async (pack) => {
      if (pack) await writeChunked(PACK_KEY, JSON.stringify(pack));
      else await deleteChunked(PACK_KEY);
      set({ customPack: pack });
    },
  };
});

// Subscribes a component to game changes and returns the game.
export function useGame(): Game | null {
  useStore((s) => s.rev);
  return useStore((s) => s.game);
}

// Dev builds expose the store so browser tests can set up game states.
if (__DEV__ && typeof window !== 'undefined') {
  (window as unknown as { __footmax: typeof useStore }).__footmax = useStore;
}
