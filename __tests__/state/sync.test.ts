import { resolveSync, needsDownload, CloudRow } from '../../src/state/syncMerge';
import { SlotMeta } from '../../src/state/slots';

const U = 'user-1';

function meta(id: string, extra: Partial<SlotMeta> = {}): SlotMeta {
  return { id, mode: 'career', title: `Save ${id}`, detail: '', when: '', updatedAt: 1, ...extra };
}

function row(id: string, revision: number, title = `Cloud ${id}`): CloudRow {
  return { slot_id: id, revision, meta: meta(id, { title }) };
}

describe('cloud sync merge', () => {
  it('lists a cloud save this device has never seen as cloud-only', () => {
    const { slots } = resolveSync([], [row('aaaa1', 3)], U);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ id: 'aaaa1', owner: U, cloudOnly: true, cloudRev: 3 });
    expect(needsDownload(slots[0])).toBe(true);
  });

  it('takes a newer cloud copy when nothing changed here', () => {
    const local = meta('aaaa1', { owner: U, cloudRev: 2, localRev: 5, syncedLocalRev: 5 });
    const { slots } = resolveSync([local], [row('aaaa1', 4, 'Newer')], U);
    expect(slots[0]).toMatchObject({ title: 'Newer', remoteRev: 4, cloudRev: 2 });
    expect(slots[0].conflict).toBeFalsy();
    expect(needsDownload(slots[0])).toBe(true);
  });

  it('flags a conflict when both sides changed', () => {
    const local = meta('aaaa1', { owner: U, cloudRev: 2, localRev: 6, syncedLocalRev: 5 });
    const { slots } = resolveSync([local], [row('aaaa1', 3)], U);
    expect(slots[0].conflict).toBe(true);
    expect(needsDownload(slots[0])).toBe(false);
  });

  it('leaves an up-to-date slot alone', () => {
    const local = meta('aaaa1', { owner: U, cloudRev: 3, localRev: 5, syncedLocalRev: 5 });
    const { slots } = resolveSync([local], [row('aaaa1', 3)], U);
    expect(slots[0]).toBe(local);
  });

  it('drops a slot deleted on another device, unless it changed here', () => {
    const clean = meta('aaaa1', { owner: U, cloudRev: 2, localRev: 4, syncedLocalRev: 4 });
    const edited = meta('bbbb2', { owner: U, cloudRev: 2, localRev: 5, syncedLocalRev: 4 });
    const { slots, gone } = resolveSync([clean, edited], [], U);
    expect(gone).toEqual(['aaaa1']);
    expect(slots.map((s) => s.id)).toEqual(['bbbb2']);
    expect(slots[0].cloudRev).toBeUndefined();
  });

  it('never touches guest saves or saves of another account', () => {
    const guest = meta('gggg1');
    const other = meta('oooo1', { owner: 'someone-else', cloudRev: 1 });
    const { slots, gone } = resolveSync([guest, other], [], U);
    expect(gone).toEqual([]);
    expect(slots).toEqual([guest, other]);
  });
});
