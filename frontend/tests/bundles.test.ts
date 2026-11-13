import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState } from '../src/domain/seed.ts';
import { applyCommand, type Command } from '../src/domain/commands.ts';
import { bundleRows, held } from '../src/domain/bundles.ts';
import { availability, addDays, today } from '../src/domain/calendar.ts';
import { hydrate, LocalRepository } from '../src/data/repository.ts';
import { parseBackup } from '../src/domain/backup.ts';
import 'fake-indexeddb/auto';
import type { State } from '../src/domain/model.ts';
const run = (s: State, c: Command) =>
  applyCommand(s, c, crypto.randomUUID(), new Date().toISOString());
function fixture() {
  const s = demoState();
  for (const id of ['demo1', 'demo2']) {
    const t = s.trips[id];
    t.start = t.end = today();
    t.items = [t.items[0]];
    t.items[0].quantity = 2;
  }
  return run(s, { type: 'bundleCreate', id: 'b', name: 'Messuauto', tripIds: ['demo1', 'demo2'] });
}
const operation = (s: State, action: string, extra: Record<string, unknown> = {}) =>
  run(s, {
    type: 'bundle',
    id: 'b',
    expected: s.bundles!.b.version,
    action,
    productId: 'screen',
    ...extra,
  } as Command);
test('bundle totals preserve separate trips and do not duplicate calendar reservations', () => {
  const s = fixture();
  assert.equal(bundleRows(s, s.bundles!.b)[0].quantity, 4);
  assert.equal(availability(s, 'screen', today(), today()).reserved, 4);
  assert.equal(s.trips.demo1.items[0].packed, 0);
  assert.throws(() =>
    run(s, { type: 'bundleCreate', id: 'c', name: 'toinen', tripIds: ['demo1', 'demo2'] }),
  );
  const before = demoState();
  assert.throws(
    () =>
      run(before, {
        type: 'bundleCreate',
        id: 'c',
        name: 'peräkkäiset',
        tripIds: ['demo1', 'demo2'],
      }),
    /yhteinen/,
  );
});
test('load serial once, assign atomically, correct customer and preserve exact history', () => {
  let s = fixture();
  s = operation(s, 'load', { unitId: 'screen-1' });
  assert.throws(() => operation(s, 'load', { unitId: 'screen-1' }), /jo pakattu/);
  assert.equal(held(s, 'screen'), 1);
  s = operation(s, 'assign', {
    unitId: 'screen-1',
    tripId: 'demo1',
    itemId: s.trips.demo1.items[0].id,
    tripVersion: s.trips.demo1.version,
  });
  assert.equal(held(s, 'screen'), 0);
  assert.deepEqual(s.trips.demo1.items[0].serialSnapshots, ['AV-TV-001']);
  s = operation(s, 'unassign', {
    unitId: 'screen-1',
    tripId: 'demo1',
    itemId: s.trips.demo1.items[0].id,
    tripVersion: s.trips.demo1.version,
  });
  s = operation(s, 'assign', {
    unitId: 'screen-1',
    tripId: 'demo2',
    itemId: s.trips.demo2.items[0].id,
    tripVersion: s.trips.demo2.version,
  });
  assert.equal(s.trips.demo1.items[0].packed, 0);
  assert.equal(s.trips.demo2.items[0].packed, 1);
});
test('count-based loading allows later QR identification after departure and normal return', () => {
  let s = operation(fixture(), 'load', { quantity: 4 });
  s = operation(s, 'depart');
  assert.equal(s.trips.demo1.status, 'out');
  s = operation(s, 'assign', {
    unitId: 'screen-1',
    tripId: 'demo1',
    itemId: s.trips.demo1.items[0].id,
    tripVersion: s.trips.demo1.version,
  });
  assert.equal(held(s, 'screen'), 3);
  assert.throws(
    () =>
      operation(s, 'assign', {
        unitId: 'screen-1',
        tripId: 'demo2',
        itemId: s.trips.demo2.items[0].id,
        tripVersion: s.trips.demo2.version,
      }),
    /jo kohdistettu/,
  );
  s = run(s, {
    type: 'return',
    tripId: 'demo1',
    itemId: s.trips.demo1.items[0].id,
    unitId: 'screen-1',
    damaged: false,
    expected: s.trips.demo1.version,
  });
  assert.equal(s.trips.demo1.items[0].returned, 1);
  assert.throws(
    () =>
      operation(s, 'assign', {
        quantity: 1,
        tripId: 'demo1',
        itemId: s.trips.demo1.items[0].id,
        tripVersion: s.trips.demo1.version,
      }),
    /palautuksen/,
  );
});
test('bundle supports overpacking while rejecting stale allocation', () => {
  let s = operation(fixture(), 'load', { quantity: 4 });
  s = operation(s, 'load', { quantity: 1 });
  assert.equal(held(s, 'screen'), 5);
  assert.throws(
    () =>
      operation(s, 'assign', {
        quantity: 1,
        tripId: 'demo1',
        itemId: s.trips.demo1.items[0].id,
        tripVersion: 0,
      }),
    /muuttui/,
  );
  assert.throws(
    () =>
      run(s, {
        type: 'bundle',
        id: 'b',
        action: 'unload',
        quantity: 1,
        productId: 'screen',
        expected: 0,
      }),
    /muuttui/,
  );
  s = operation(s, 'assign', {
    quantity: 3,
    tripId: 'demo1',
    itemId: s.trips.demo1.items[0].id,
    tripVersion: s.trips.demo1.version,
  });
  assert.equal(s.trips.demo1.items[0].packed, 3);
});
test('held serials cannot be packed by another trip and capacity counts all holdings', () => {
  let s = operation(fixture(), 'load', { unitId: 'screen-1' });
  assert.throws(
    () =>
      run(s, {
        type: 'pack',
        tripId: 'demo1',
        itemId: s.trips.demo1.items[0].id,
        unitId: 'screen-1',
        expected: s.trips.demo1.version,
      }),
    /pakkausnipussa/,
  );
  s.products.screen.units = Object.fromEntries(Object.entries(s.products.screen.units).slice(0, 2));
  assert.throws(() => operation(s, 'load', { quantity: 2 }), /Fyysisesti/);
});
test('membership and archive are protected until unallocated load is handled', () => {
  let s = operation(fixture(), 'load', { quantity: 1 });
  s = run(s, { type: 'trip', trip: s.trips.demo1, expected: s.trips.demo1.version });
  assert.throws(
    () => run(s, { type: 'archiveReturned', tripId: 'demo1', expected: s.trips.demo1.version }),
    /kohdistamaton/,
  );
  assert.throws(() => operation(s, 'close'), /Kohdista/);
  assert.throws(() => operation(s, 'depart'), /koko kalusto/);
  s = operation(s, 'unload', { quantity: 1 });
  s = operation(s, 'close');
  assert.equal(s.bundles!.b.closed, true);
  assert.equal(s.trips.demo1.status, 'planned');
});
test('overdue unallocated stock blocks future availability without double reservation today', () => {
  const s = operation(fixture(), 'load', { quantity: 2 });
  assert.equal(availability(s, 'screen', today(), today()).reserved, 4);
  for (const id of ['demo1', 'demo2']) s.trips[id].start = s.trips[id].end = addDays(today(), -1);
  assert.equal(availability(s, 'screen', today(), today()).reserved, 2);
});
test('Firebase empty-array hydration and backup preserve bundles and worktime', () => {
  const s = operation(fixture(), 'load', { quantity: 1 });
  s.worktime = { people: { x: { name: 'Testi' } }, records: {} };
  const raw = structuredClone(s);
  delete (raw.bundles!.b.holding.screen as Partial<{ unitIds: string[] }>).unitIds;
  const hydrated = hydrate(raw);
  assert.deepEqual(hydrated.bundles!.b.holding.screen.unitIds, []);
  assert.deepEqual(
    parseBackup({ format: 'av-arsenal-backup', version: 2, state: hydrated }).state,
    hydrated,
  );
  hydrated.bundles!.b.holding.screen.quantity = -1;
  assert.throws(
    () => parseBackup({ format: 'av-arsenal-backup', version: 2, state: hydrated }),
    /pakkausmäärä/,
  );
});
test('two repository connections cannot load the same serial concurrently', async () => {
  const name = 'bundle-test-' + crypto.randomUUID();
  const a = new LocalRepository(name),
    b = new LocalRepository(name);
  try {
    await a.importLocal(fixture(), null);
    const c: Command = {
      type: 'bundle',
      id: 'b',
      expected: 1,
      action: 'load',
      productId: 'screen',
      unitId: 'screen-1',
    };
    const results = await Promise.allSettled([a.dispatch(c), b.dispatch(c)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
