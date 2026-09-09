import test from 'node:test';
import assert from 'node:assert/strict';
import { auditExport } from '../tools/audit-export.mjs';

test('sparse Firebase arrays preserve physical shelf coordinates', () => {
  const data = {
    inventory: { p: { name: 'Product', available: 1, shelfLocation: 'A12' } },
    shelves: { A: { aisles: [null, { levels: [null, null, { products: { p: {} } }] }] } },
  };
  const before = JSON.stringify(data);
  assert.deepEqual(auditExport(data).findings, []);
  assert.equal(JSON.stringify(data), before);
});
test('reports orphan inventory, duplicate locations and stale cache independently', () => {
  const data = {
    inventory: { p: { shelfLocation: 'A99' } },
    shelves: {
      A: {
        aisles: {
          1: { levels: { 1: { products: { p: {}, missing: {} } }, 2: { products: { p: {} } } } },
        },
      },
    },
  };
  const r = auditExport(data);
  assert.equal(r.summary.inventory_without_name, 1);
  assert.equal(r.summary.multiple_shelf_locations, 1);
  assert.equal(r.summary.shelf_cache_without_matching_location, 1);
  assert.equal(r.summary.shelf_reference_missing_inventory, 1);
});
test('legacy manualItems nested inside packedItems is not silently treated as a product', () => {
  const r = auditExport({
    'archived-trips': {
      t: {
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        items: [],
        packedItems: { manualItems: [{ name: 'Cable', quantity: 1 }] },
      },
    },
  });
  assert.equal(r.summary.noncanonical_item_entry, 1);
  assert.equal(r.shapes['archived-trips'].packedEntries.array, 1);
});
test('serial mismatch, invalid quantities and reversed dates require review', () => {
  const r = auditExport({
    inventory: { p: { name: 'P', available: 2, units: { s: {} } } },
    keikat: {
      t: {
        startDate: '2026-01-02',
        endDate: '2026-01-01',
        items: { p: { id: 'p', quantity: '' } },
        packedItems: { p: { isSerial: true, quantity: 2, serials: { missing: {} } } },
      },
    },
  });
  for (const code of [
    'unit_count_differs_from_available',
    'invalid_trip_dates',
    'invalid_item_quantity',
    'packed_serial_count_mismatch',
    'packed_serial_missing_from_current_product',
  ])
    assert.equal(r.summary[code], 1);
});
