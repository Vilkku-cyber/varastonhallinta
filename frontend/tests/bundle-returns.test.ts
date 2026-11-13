import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState } from '../src/domain/seed.ts';
import { applyCommand, type Command } from '../src/domain/commands.ts';
import type { State } from '../src/domain/model.ts';
const run = (s: State, c: Command) =>
  applyCommand(s, c, crypto.randomUUID(), '2026-11-13T10:00:00Z');
function fixture() {
  let s = demoState();
  for (const id of ['demo1', 'demo2']) {
    const t = s.trips[id];
    t.start = t.end = s.trips.demo1.start;
    t.items = [t.items[0]];
    t.items[0].quantity = 2;
  }
  s = run(s, { type: 'bundleCreate', id: 'b', name: 'Auto', tripIds: ['demo1', 'demo2'] });
  s = run(s, {
    type: 'bundle',
    id: 'b',
    expected: 1,
    action: 'load',
    productId: 'screen',
    quantity: 4,
  });
  s = run(s, { type: 'bundle', id: 'b', expected: 2, action: 'depart' });
  for (const [tripId, unitId] of [
    ['demo1', 'screen-1'],
    ['demo2', 'screen-2'],
  ])
    s = run(s, {
      type: 'bundle',
      id: 'b',
      expected: s.bundles!.b.version,
      action: 'assign',
      productId: 'screen',
      unitId,
      tripId,
      itemId: s.trips[tripId].items[0].id,
      tripVersion: s.trips[tripId].version,
    });
  return s;
}
const ret = (s: State, unitId: string, damaged = false) =>
  run(s, {
    type: 'bundle',
    id: 'b',
    expected: s.bundles!.b.version,
    action: 'returnUnit',
    productId: 'screen',
    unitId,
    damaged,
  });
const all = (s: State): Command => ({
  type: 'bundle',
  id: 'b',
  expected: s.bundles!.b.version,
  action: 'returnAll',
  tripVersions: Object.fromEntries(s.bundles!.b.tripIds.map((id) => [id, s.trips[id].version])),
});
test('serial return chooses correct customer, preserves history and rejects duplicate or unrelated unit', () => {
  let s = fixture();
  s = ret(s, 'screen-2', true);
  assert.equal(s.trips.demo1.items[0].returned, 0);
  assert.equal(s.trips.demo2.items[0].returned, 1);
  assert.deepEqual(s.trips.demo2.items[0].unitIds, ['screen-2']);
  assert.deepEqual(s.trips.demo2.items[0].returnedUnitIds, ['screen-2']);
  assert.equal(s.products.screen.units['screen-2'].condition, 'maintenance');
  assert.throws(() => ret(s, 'screen-2'), /jo palautettu/);
  assert.throws(() => ret(s, 'screen-9'), /kohdistettu/);
});
test('bulk return handles remaining customers and holding without inventing packing or repairing damaged units', () => {
  let s = ret(fixture(), 'screen-2', true);
  s = run(s, all(s));
  for (const id of ['demo1', 'demo2']) {
    assert.equal(s.trips[id].status, 'closed');
    assert.equal(s.trips[id].items[0].packed, 1);
    assert.equal(s.trips[id].items[0].returned, 1);
  }
  assert.equal(s.bundles!.b.holding.screen.quantity, 0);
  assert.equal(s.bundles!.b.closed, true);
  assert.equal(s.products.screen.units['screen-2'].condition, 'maintenance');
});
test('bulk confirmation rejects a separately changed trip atomically', () => {
  const s = fixture(),
    command = all(s);
  const newer = run(s, {
    type: 'return',
    tripId: 'demo1',
    itemId: s.trips.demo1.items[0].id,
    unitId: 'screen-1',
    damaged: false,
    expected: s.trips.demo1.version,
  });
  assert.throws(() => run(newer, command), /muuttuivat/);
  assert.equal(newer.trips.demo2.items[0].returned, 0);
  assert.equal(newer.bundles!.b.holding.screen.quantity, 2);
});
test('anonymous return updates selected row and archives only completely returned customer', () => {
  let s = fixture();
  s = run(s, {
    type: 'bundle',
    id: 'b',
    expected: s.bundles!.b.version,
    action: 'assign',
    productId: 'screen',
    quantity: 1,
    tripId: 'demo1',
    itemId: s.trips.demo1.items[0].id,
    tripVersion: s.trips.demo1.version,
  });
  s = ret(s, 'screen-1');
  s = run(s, {
    type: 'bundle',
    id: 'b',
    expected: s.bundles!.b.version,
    action: 'returnQuantity',
    productId: 'screen',
    quantity: 1,
    tripId: 'demo1',
    itemId: s.trips.demo1.items[0].id,
    tripVersion: s.trips.demo1.version,
  });
  assert.equal(s.trips.demo1.status, 'closed');
  assert.equal(s.trips.demo2.status, 'out');
  assert.equal(s.trips.demo1.items[0].returned, 2);
});
test('unallocated identified unit returns from holding, not an arbitrary customer', () => {
  let s = fixture();
  s = run(s, {
    type: 'bundle',
    id: 'b',
    expected: s.bundles!.b.version,
    action: 'unassign',
    productId: 'screen',
    unitId: 'screen-1',
    tripId: 'demo1',
    itemId: s.trips.demo1.items[0].id,
    tripVersion: s.trips.demo1.version,
  });
  s = ret(s, 'screen-1');
  assert.equal(s.bundles!.b.holding.screen.quantity, 2);
  assert.equal(s.trips.demo1.items[0].returned, 0);
});
