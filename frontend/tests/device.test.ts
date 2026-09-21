import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState } from '../src/domain/seed.ts';
import { findDevices, deviceTrips } from '../src/domain/device.ts';
import { applyCommand } from '../src/domain/commands.ts';
import { capacity } from '../src/domain/calendar.ts';

test('QR lookup is exact, trims whitespace and exposes ambiguous serials', () => {
  const s = demoState();
  assert.equal(findDevices(s, ' AV-TV-001\n')[0].unit.id, 'screen-1');
  assert.equal(findDevices(s, 'AV-TV').length, 0);
  assert.equal(findDevices(s, '').length, 0);
  s.products.screen.units['screen-2'].serial = 'AV-TV-001';
  assert.equal(findDevices(s, 'AV-TV-001').length, 2);
});

test('device history distinguishes model reservations from identified units and includes archive', () => {
  const s = demoState();
  const unit = s.products.screen.units['screen-1'];
  s.trips.demo1.items[0].unitIds = [unit.id];
  let rows = deviceTrips(s, 'screen', unit);
  assert.equal(rows.find((r) => r.trip.id === 'demo1')?.outstanding, true);
  assert.equal(rows.find((r) => r.trip.id === 'demo2')?.identified, false);
  s.trips.demo1.status = 'closed';
  s.trips.demo1.items[0].unitIds = [];
  s.trips.demo1.items[0].serialSnapshots = [unit.serial];
  rows = deviceTrips(s, 'screen', unit);
  assert.equal(rows.find((r) => r.trip.id === 'demo1')?.identified, true);
  assert.equal(rows.find((r) => r.trip.id === 'demo1')?.outstanding, false);
});

test('damage update preserves loan, reduces capacity, rejects stale writes and prevents packing', () => {
  let s = demoState();
  const command = {
    type: 'unitCondition' as const,
    productId: 'screen',
    unitId: 'screen-1',
    condition: 'maintenance' as const,
    notes: 'Näytössä naarmu',
    expected: 1,
  };
  s.trips.demo1.items[0].unitIds = ['screen-1'];
  s.trips.demo1.items[0].packed = 1;
  const before = structuredClone(s.trips);
  s = applyCommand(s, command, 'damage', '2026-09-21T10:00:00Z');
  assert.deepEqual(s.trips, before);
  assert.equal(capacity(s.products.screen), 9);
  assert.equal(s.products.screen.units['screen-1'].notes, 'Näytössä naarmu');
  assert.throws(() => applyCommand(s, command, 'stale', 'now'), /muuttui/);
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: 'pack',
          tripId: 'demo2',
          itemId: s.trips.demo2.items[0].id,
          unitId: 'screen-1',
          expected: s.trips.demo2.version,
        },
        'pack',
        'now',
      ),
    /huollossa/,
  );
  s = applyCommand(s, { ...command, expected: 2, condition: 'ready' }, 'repair', 'now');
  assert.equal(capacity(s.products.screen), 10);
  assert.deepEqual(s.trips, before);
});
