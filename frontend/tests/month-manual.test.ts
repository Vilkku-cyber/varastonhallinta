import test from 'node:test';
import assert from 'node:assert/strict';
import { monthDays, shiftMonth } from '../src/domain/month.ts';
import { demoState } from '../src/domain/seed.ts';
import { applyCommand, type Command } from '../src/domain/commands.ts';
import type { State } from '../src/domain/model.ts';
const run = (s: State, c: Command) =>
  applyCommand(s, c, crypto.randomUUID(), new Date().toISOString());
test('all month grids start on Monday across year and leap-day boundaries', () => {
  for (const day of ['2026-09-09', '2026-02-01', '2024-02-29', '2027-01-01']) {
    const dates = monthDays(day);
    assert.equal(dates.length, 42);
    assert.equal(new Date(dates[0]).getUTCDay(), 1);
    assert.equal(new Set(dates).size, 42);
  }
  assert.equal(shiftMonth('2026-12-31', 1), '2027-01-01');
  assert.ok(monthDays('2024-02-01').includes('2024-02-29'));
});
test('mixed manual and identified packing preserves counts through scan and return', () => {
  let s = demoState();
  s.trips.demo1.items = [s.trips.demo1.items[0]];
  const id = 'demo1',
    row = s.trips[id].items[0].id;
  const pack = (extra: object) => {
    s = run(s, {
      type: 'pack',
      tripId: id,
      itemId: row,
      expected: s.trips[id].version,
      ...extra,
    } as Command);
  };
  pack({ quantity: 2 });
  assert.equal(s.trips[id].items[0].packed, 2);
  assert.deepEqual(s.trips[id].items[0].unitIds, []);
  pack({ unitId: 'screen-1' });
  assert.equal(s.trips[id].items[0].packed, 3);
  assert.throws(() => pack({ quantity: 0 }));
  pack({ quantity: 6 });
  s = run(s, { type: 'status', tripId: id, status: 'packed', expected: s.trips[id].version });
  s = run(s, { type: 'status', tripId: id, status: 'out', expected: s.trips[id].version });
  s = run(s, {
    type: 'return',
    tripId: id,
    itemId: row,
    quantity: 2,
    damaged: false,
    expected: s.trips[id].version,
  });
  s = run(s, {
    type: 'return',
    tripId: id,
    itemId: row,
    unitId: 'screen-1',
    damaged: false,
    expected: s.trips[id].version,
  });
  assert.equal(s.trips[id].items[0].returned, 3);
  assert.throws(() =>
    run(s, {
      type: 'return',
      tripId: id,
      itemId: row,
      quantity: 4,
      damaged: false,
      expected: s.trips[id].version,
    }),
  );
});
test('manual serialized packing cannot exceed physical capacity or plan', () => {
  let s = demoState();
  const t = s.trips.demo1;
  const row = t.items[0].id;
  assert.throws(() =>
    run(s, { type: 'pack', tripId: t.id, itemId: row, quantity: 7, expected: t.version }),
  );
  s = run(s, { type: 'pack', tripId: t.id, itemId: row, quantity: 6, expected: t.version });
  const other = s.trips.demo2;
  assert.throws(
    () =>
      run(s, {
        type: 'pack',
        tripId: other.id,
        itemId: other.items[0].id,
        quantity: 6,
        expected: other.version,
      }),
    /vapaata/,
  );
});
