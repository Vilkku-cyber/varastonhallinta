import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, type State, type Trip } from '../src/domain/model.ts';
import { availability } from '../src/domain/calendar.ts';
import { applyCommand, type Command } from '../src/domain/commands.ts';
import { item, demoState } from '../src/domain/seed.ts';
import { panelPlan } from '../src/domain/planner.ts';
import { importLegacy, legacyDay } from '../src/domain/importLegacy.ts';
const now = '2026-09-09';
const at = now + 'T12:00:00Z';
function fixture() {
  const s = emptyState();
  s.products.p = {
    id: 'p',
    name: 'Näyttö',
    category: 'TV',
    total: 10,
    maintenance: 0,
    tracking: 'quantity',
    units: {},
    notes: '',
    dimensions: '',
    weight: '',
    retired: false,
    review: false,
    version: 1,
  };
  return s;
}
function trip(id: string, start: string, end = start, n = 6): Trip {
  return {
    id,
    name: id,
    start,
    end,
    items: [item('p', 'Näyttö', n)],
    contact: '',
    notes: '',
    status: 'planned',
    version: 1,
    imported: false,
    packingUnknown: false,
  };
}
function run(s: State, c: Command, id: string = crypto.randomUUID()) {
  return applyCommand(s, c, id, at, now);
}
test('consecutive dates reuse stock; peak load instead of sum across days', () => {
  const s = fixture();
  s.trips.a = trip('a', now);
  s.trips.b = trip('b', '2026-09-10');
  assert.equal(availability(s, 'p', now, '2026-09-10', '', now).available, 4);
  assert.equal(availability(s, 'p', '2026-09-11', '2026-09-11', '', now).available, 10);
});
test('same date overlaps and editing excludes the previous reservation', () => {
  const s = fixture();
  s.trips.a = trip('a', now);
  assert.equal(availability(s, 'p', now, now, 'a', now).available, 10);
  assert.throws(
    () => run(s, { type: 'trip', trip: trip('b', now, now, 5), expected: 0 }),
    /vapaana 4/,
  );
});
test('whole multi-product trip rejected without mutation', () => {
  const s = fixture();
  s.trips.a = trip('a', now);
  const before = JSON.stringify(s);
  const t = trip('b', now, now, 6);
  t.items.push({ ...item('p', 'Näyttö', 1), id: 'other' });
  assert.throws(() => run(s, { type: 'trip', trip: t, expected: 0 }));
  assert.equal(JSON.stringify(s), before);
});
test('packed upcoming loan does not block next planned day; overdue unreturned does', () => {
  const s = fixture();
  s.trips.a = trip('a', now);
  s.trips.a.items[0].packed = 6;
  assert.equal(availability(s, 'p', '2026-09-10', '2026-09-10', '', now).available, 10);
  assert.equal(availability(s, 'p', '2026-09-10', '2026-09-10', '', '2026-09-10').available, 4);
  s.trips.a.items[0].returned = 2;
  assert.equal(availability(s, 'p', '2026-09-10', '2026-09-10', '', '2026-09-10').available, 6);
});
test('closed, cancelled and custom items do not reserve stock', () => {
  const s = fixture();
  for (const st of ['closed', 'cancelled', 'draft'] as const) {
    s.trips[st] = { ...trip(st, now), status: st };
  }
  s.trips.custom = { ...trip('custom', now), items: [{ ...item('p', 'Muu', 10), type: 'custom' }] };
  assert.equal(availability(s, 'p', now, now, '', now).available, 10);
});
test('stale form and duplicate command IDs are handled', () => {
  const s = fixture();
  const c: Command = { type: 'trip', trip: trip('a', now), expected: 0 };
  const saved = run(s, c, 'same');
  assert.deepEqual(run(saved, c, 'same'), saved);
  assert.throws(
    () => run(saved, { ...c, trip: { ...c.trip, name: 'changed' } }, 'same'),
    /Komentotunnus/,
  );
  assert.throws(() => run(saved, c), /toisella laitteella/);
});
test('serial duplicate scan, competing trip, unpack and return damage', () => {
  let s = fixture();
  s.products.p.tracking = 'serial';
  for (let n = 1; n <= 10; n++)
    s.products.p.units['u' + n] = { id: 'u' + n, serial: 'S' + n, condition: 'ready', notes: '' };
  s.trips.a = trip('a', now, now, 1);
  s.trips.b = trip('b', '2026-09-10', '2026-09-10', 1);
  const pack = (tripId: string): Command => ({
    type: 'pack',
    tripId,
    itemId: 'row-p',
    unitId: 'u1',
    expected: s.trips[tripId].version,
  });
  s = run(s, pack('a'));
  s = run(s, pack('a'));
  assert.equal(s.trips.a.items[0].packed, 1);
  assert.throws(() => run(s, pack('b')), /jo pakattu/);
  for (const status of ['packed', 'out'] as const)
    s = run(s, { type: 'status', tripId: 'a', status, expected: s.trips.a.version });
  s = run(s, {
    type: 'return',
    tripId: 'a',
    itemId: 'row-p',
    unitId: 'u1',
    damaged: true,
    expected: s.trips.a.version,
  });
  assert.equal(s.products.p.units.u1.condition, 'maintenance');
  assert.equal(s.trips.a.items[0].returned, 1);
  s = run(s, { type: 'status', tripId: 'a', status: 'closed', expected: s.trips.a.version });
  assert.equal(s.trips.a.status, 'closed');
});
test('quantity return is partial and closing before completion is rejected', () => {
  let s = fixture();
  s.trips.a = trip('a', now, now, 2);
  s = run(s, { type: 'pack', tripId: 'a', itemId: 'row-p', quantity: 2, expected: 1 });
  for (const status of ['packed', 'out'] as const)
    s = run(s, { type: 'status', tripId: 'a', status, expected: s.trips.a.version });
  s = run(s, {
    type: 'return',
    tripId: 'a',
    itemId: 'row-p',
    quantity: 1,
    damaged: false,
    expected: s.trips.a.version,
  });
  assert.throws(
    () => run(s, { type: 'status', tripId: 'a', status: 'closed', expected: s.trips.a.version }),
    /Kaikkia/,
  );
});
test('Pintaled long and half sections round correctly across multiple rows', () => {
  assert.deepEqual(
    [panelPlan(1000, 250, 1000, 250, true).long, panelPlan(1000, 250, 1000, 250, true).half],
    [1, 0],
  );
  const a = panelPlan(1500, 250, 1000, 250, true);
  assert.deepEqual([a.long, a.half], [1, 1]);
  const b = panelPlan(2500, 500, 1000, 250, true);
  assert.deepEqual([b.long, b.half], [4, 2]);
  assert.throws(() => panelPlan(0, 500));
  assert.throws(() => panelPlan(NaN, 500));
});
test('legacy UTC midnight converts to Helsinki day; sparse arrays keep locations', () => {
  assert.equal(legacyDay('2026-09-08T21:00:00.000Z'), now);
  const raw = {
    inventory: { p: { name: 'TV', available: 1 }, loose: { shelfLocation: 'A12' } },
    shelves: {
      A: { aisles: [null, { levels: [null, null, { products: { p: {}, loose: {} } }] }] },
    },
    keikat: {
      t: {
        name: 'Old',
        startDate: now,
        endDate: now,
        items: [{ id: 'p', quantity: 1 }],
        packedItems: { 'manual-TV': { name: 'TV', quantity: 1 } },
      },
    },
  };
  const before = JSON.stringify(raw);
  const s = importLegacy(raw);
  assert.equal(Object.values(s.locations)[0].level, '2');
  assert.equal(s.trips.t.items[0].productId, 'p');
  assert.equal(s.trips.t.items[1].type, 'legacy');
  assert.equal(Object.keys(s.placements).length, 2);
  assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(importLegacy(raw), s);
});
test('demo state serial capacities match totals', () => {
  const s = demoState();
  for (const p of Object.values(s.products))
    if (p.tracking === 'serial') assert.equal(p.total, Object.keys(p.units).length);
});
