import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalRepository } from '../src/data/repository.ts';
import { demoState } from '../src/domain/seed.ts';
import { parseBackup } from '../src/domain/backup.ts';
import type { Trip } from '../src/domain/model.ts';
test('two local connections cannot reserve the same last stock simultaneously', async () => {
  const name = crypto.randomUUID();
  const a = new LocalRepository(name),
    b = new LocalRepository(name);
  try {
    const state = demoState();
    state.trips = {};
    await a.importLocal(state, { source: 'test' });
    const make = (id: string): Trip => ({
      id,
      name: id,
      start: '2026-09-10',
      end: '2026-09-10',
      status: 'planned',
      contact: '',
      notes: '',
      version: 0,
      imported: false,
      packingUnknown: false,
      items: [
        {
          id: 'row',
          type: 'inventory',
          productId: 'screen',
          name: 'Screen',
          quantity: 10,
          note: '',
          packed: 0,
          returned: 0,
          unitIds: [],
          returnedUnitIds: [],
          serialSnapshots: [],
        },
      ],
    });
    const results = await Promise.allSettled([
      a.dispatch({ type: 'trip', trip: make('a'), expected: 0 }),
      b.dispatch({ type: 'trip', trip: make('b'), expected: 0 }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
    const parsed = parseBackup(await a.backup());
    assert.equal(Object.keys(parsed.state.trips).length, 1);
    const backup = await b.backup();
    assert.deepEqual(parseBackup(backup), parsed);
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
test('backup import round-trip preserves domain data and original legacy source', async () => {
  const repo = new LocalRepository(crypto.randomUUID());
  try {
    const state = demoState(),
      raw = { inventory: { legacy: { notes: 'Original source' } } };
    await repo.importLocal(state, raw);
    const restored = parseBackup(await repo.backup());
    assert.deepEqual(restored, { state, source: raw });
    assert.throws(() =>
      parseBackup({ format: 'av-arsenal-backup', version: 2, state: { schemaVersion: 2 } }),
    );
  } finally {
    await repo.dispose();
  }
});
