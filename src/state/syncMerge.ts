import { SlotMeta, displayMeta, isDirty } from './slots';

export interface CloudRow {
  slot_id: string;
  meta: SlotMeta;
  revision: number;
}

// Merges the account's cloud rows into this device's slot list. Pure, so the
// rules are easy to test:
// - a cloud save this device has never seen is listed as cloud-only;
// - a newer cloud copy replaces an unchanged local one (downloaded on open);
// - if both changed since the last sync, the slot is marked as a conflict;
// - a synced slot whose row is gone was deleted on another device, unless it
//   changed here since, in which case it is uploaded again.
export function resolveSync(local: SlotMeta[], rows: CloudRow[], user: string): { slots: SlotMeta[]; gone: string[] } {
  const remaining = new Map(rows.map((r) => [r.slot_id, r]));
  const slots: SlotMeta[] = [];
  const gone: string[] = [];
  for (const m of local) {
    if (m.owner !== user) {
      slots.push(m);
      continue;
    }
    const r = remaining.get(m.id);
    remaining.delete(m.id);
    if (!r) {
      if (m.cloudOnly || (m.cloudRev && !isDirty(m))) gone.push(m.id);
      else slots.push({ ...m, cloudRev: undefined, remoteRev: undefined, conflict: false });
      continue;
    }
    if (r.revision <= (m.cloudRev ?? 0)) {
      slots.push(m);
      continue;
    }
    if (m.cloudOnly) slots.push({ ...m, ...displayMeta(r.meta), id: m.id, cloudRev: r.revision, remoteRev: r.revision });
    else if (isDirty(m)) slots.push({ ...m, conflict: true, remoteRev: r.revision });
    else slots.push({ ...m, ...displayMeta(r.meta), id: m.id, remoteRev: r.revision });
  }
  for (const r of remaining.values()) {
    slots.push({ ...displayMeta(r.meta), id: r.slot_id, owner: user, cloudOnly: true, cloudRev: r.revision, remoteRev: r.revision, localRev: 0, syncedLocalRev: 0 });
  }
  return { slots, gone };
}

// True when opening this slot should fetch the cloud copy first.
export function needsDownload(m: SlotMeta): boolean {
  return !!m.cloudOnly || (!m.conflict && !!m.remoteRev && m.remoteRev > (m.cloudRev ?? 0));
}
