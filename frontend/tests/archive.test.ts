import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState } from '../src/domain/seed.ts';
import { applyCommand } from '../src/domain/commands.ts';
import { availability } from '../src/domain/calendar.ts';
test('archive unpacked trip without inventing packing history; release reservation', () => {
  const s = demoState(),
    trip = s.trips.demo1;
  const command = { type: 'archiveReturned' as const, tripId: trip.id, expected: trip.version };
  const next = applyCommand(s, command, 'archive', new Date().toISOString());
  assert.equal(next.trips.demo1.status, 'closed');
  assert.equal(next.trips.demo1.items[0].packed, 0);
  assert.equal(next.trips.demo1.items[0].returned, 0);
  assert.equal(s.trips.demo1.status, 'planned');
  assert.equal(availability(next, 'screen', trip.start, trip.end).available, 10);
  assert.deepEqual(applyCommand(next, command, 'archive', new Date().toISOString()), next);
  assert.throws(() => applyCommand(next, command, 'other', new Date().toISOString()));
});
test('manual archive handles all open states, legacy rows and partial serialized returns', () => {
  for (const status of ['draft', 'planned', 'packed', 'out', 'returning'] as const) {
    const s = demoState(),
      trip = s.trips.demo1;
    trip.status = status;
    trip.packingUnknown = true;
    trip.start = '';
    trip.end = '';
    const row = trip.items[0];
    row.type = 'legacy';
    row.packed = 2;
    row.returned = 1;
    row.unitIds = ['screen-1', 'screen-2'];
    row.returnedUnitIds = ['screen-1'];
    const next = applyCommand(
      s,
      { type: 'archiveReturned', tripId: trip.id, expected: trip.version },
      'archive',
      new Date().toISOString(),
    );
    const archived = next.trips.demo1;
    assert.equal(archived.status, 'closed');
    assert.equal(archived.items[0].returned, 2);
    assert.deepEqual(archived.items[0].returnedUnitIds, ['screen-1', 'screen-2']);
    assert.equal(archived.manualClosure?.previousReturns[0].returned, 1);
    assert.equal(archived.manualClosure?.previousStatus, status);
    assert.equal(next.products.screen.units['screen-1'].condition, 'ready');
  }
});
