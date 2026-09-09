import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '../src/domain/model.ts';
import { searchWarehouse, shelfElevation } from '../src/domain/warehouse.ts';

test('shelf search preserves multiple placements and empty addresses', () => {
  const s = emptyState();
  s.locations.one = { id: 'one', shelf: 'A', aisle: '1', level: '1', direction: 'rtl' };
  s.locations.two = { id: 'two', shelf: 'B', aisle: '2', level: '3', direction: 'ltr' };
  s.locations.empty = { id: 'empty', shelf: 'C', aisle: '1', level: '1', direction: 'ltr' };
  s.placements.a = { id: 'a', locationId: 'one', productId: '', label: 'Näyttö' };
  s.placements.b = { id: 'b', locationId: 'two', productId: '', label: 'Näyttö' };
  assert.equal(searchWarehouse(s, ' NÄYTTÖ ').length, 2);
  assert.equal(searchWarehouse(s, 'a11')[0].location.id, 'one');
  assert.equal(searchWarehouse(s, 'C / 1 / 1')[0].placement, null);
  assert.equal(searchWarehouse(s, 'puuttuu').length, 0);
  assert.equal(searchWarehouse(s, '').length, 0);
});

test('elevation respects right-to-left aisle order and highest level first', () => {
  const s = emptyState();
  for (const aisle of ['1', '2', '10'])
    for (const level of ['1', '2', '10']) {
      const id = `${aisle}-${level}`;
      s.locations[id] = { id, shelf: 'A', aisle, level, direction: 'rtl' };
    }
  const view = shelfElevation(s, 'A');
  assert.deepEqual(
    view.aisles.map((a) => a.aisle),
    ['10', '2', '1'],
  );
  assert.deepEqual(
    view.aisles[0].levels.map((l) => l.level),
    ['10', '2', '1'],
  );
});
