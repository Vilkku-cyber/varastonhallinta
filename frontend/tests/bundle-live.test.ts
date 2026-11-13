import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState } from '../src/domain/seed.ts';
import { applyCommand, type Command } from '../src/domain/commands.ts';
import { bundleRows } from '../src/domain/bundles.ts';
import { availability, today } from '../src/domain/calendar.ts';
import type { State } from '../src/domain/model.ts';
const run = (s: State, c: Command) =>
  applyCommand(s, c, crypto.randomUUID(), '2026-11-13T10:00:00Z');
function fixture() {
  let s = demoState();
  for (const id of ['demo1', 'demo2']) {
    const t = s.trips[id];
    t.start = t.end = today();
    t.items = [t.items[0]];
    t.items[0].quantity = 2;
  }
  s = run(s, { type: 'bundleCreate', id: 'b', name: 'Auto', tripIds: ['demo1', 'demo2'] });
  return run(s, {
    type: 'bundle',
    id: 'b',
    expected: 1,
    action: 'load',
    productId: 'screen',
    quantity: 6,
  });
}
test('live demand increases and decreases without changing packed quantities or losing extra stock reservations', () => {
  let s = fixture();
  let t = structuredClone(s.trips.demo1);
  t.items[0].quantity = 4;
  s = run(s, { type: 'trip', trip: t, expected: t.version });
  assert.equal(bundleRows(s, s.bundles!.b)[0].quantity, 6);
  assert.equal(s.bundles!.b.holding.screen.quantity, 6);
  t = structuredClone(s.trips.demo1);
  t.items[0].quantity = 1;
  s = run(s, { type: 'trip', trip: t, expected: t.version });
  assert.equal(bundleRows(s, s.bundles!.b)[0].quantity, 3);
  assert.equal(s.bundles!.b.holding.screen.quantity, 6);
  assert.equal(availability(s, 'screen', today(), today()).reserved, 6);
  assert.throws(
    () =>
      run(s, {
        type: 'bundle',
        id: 'b',
        expected: s.bundles!.b.version,
        action: 'load',
        productId: 'screen',
        quantity: 5,
      }),
    /Fyysisesti/,
  );
  s = run(s, { type: 'bundle', id: 'b', expected: s.bundles!.b.version, action: 'depart' });
  assert.equal(s.trips.demo1.status, 'out');
});
test('lowering or removing an allocated row preserves serials and returns as zero-demand extra', () => {
  let s = fixture();
  s = run(s, {
    type: 'bundle',
    id: 'b',
    expected: s.bundles!.b.version,
    action: 'assign',
    productId: 'screen',
    unitId: 'screen-1',
    tripId: 'demo1',
    itemId: s.trips.demo1.items[0].id,
    tripVersion: s.trips.demo1.version,
  });
  const t = structuredClone(s.trips.demo1);
  t.items = [];
  s = run(s, { type: 'trip', trip: t, expected: t.version });
  assert.equal(s.trips.demo1.items[0].quantity, 0);
  assert.equal(s.trips.demo1.items[0].packed, 1);
  assert.deepEqual(s.trips.demo1.items[0].unitIds, ['screen-1']);
  assert.equal(availability(s, 'screen', today(), today()).reserved, 6);
  const t2 = structuredClone(s.trips.demo2);
  t2.items = [];
  s = run(s, { type: 'trip', trip: t2, expected: t2.version });
  assert.equal(bundleRows(s, s.bundles!.b)[0].quantity, 0);
  assert.equal(bundleRows(s, s.bundles!.b)[0].holding, 5);
});
test('removed unallocated products remain visible and can be unloaded', () => {
  let s = fixture();
  for (const id of ['demo1', 'demo2']) {
    const t = structuredClone(s.trips[id]);
    t.items = [];
    s = run(s, { type: 'trip', trip: t, expected: t.version });
  }
  assert.equal(bundleRows(s, s.bundles!.b)[0].quantity, 0);
  assert.equal(bundleRows(s, s.bundles!.b)[0].holding, 6);
  s = run(s, {
    type: 'bundle',
    id: 'b',
    expected: s.bundles!.b.version,
    action: 'unload',
    productId: 'screen',
    quantity: 6,
  });
  assert.equal(s.bundles!.b.holding.screen.quantity, 0);
});
