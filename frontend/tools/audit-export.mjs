import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const entries = (value) =>
  value && typeof value === 'object' ? Object.entries(value).filter(([, v]) => v !== null) : [];
const shape = (value) =>
  value == null ? 'missing' : Array.isArray(value) ? 'array' : typeof value;
const count = (map, key) => {
  map[key] = (map[key] ?? 0) + 1;
};
const quantityValid = (value) =>
  (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) >= 0;

// Read-only diagnostic. Findings contain source paths, never contact or serial values.
// This does not normalize, discard, repair, or upload any source record.
export function auditExport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Export root must be an object');
  const inventory = data.inventory ?? {};
  const report = { counts: {}, shapes: {}, findings: [], summary: {} };
  const issue = (code, path) => report.findings.push({ code, path });
  for (const [branch, records] of entries(data)) report.counts[branch] = entries(records).length;
  const locations = new Map();
  for (const [s, shelf] of entries(data.shelves)) {
    for (const [a, aisle] of entries(shelf.aisles)) {
      for (const [l, level] of entries(aisle.levels)) {
        for (const [p] of entries(level.products)) {
          const path = `shelves/${s}/aisles/${a}/levels/${l}/products/${p}`;
          const found = locations.get(p) ?? [];
          found.push({ label: `${s}${a}${l}`, path });
          locations.set(p, found);
          if (!Object.hasOwn(inventory, p)) issue('shelf_reference_missing_inventory', path);
          else if (!inventory[p]?.name) issue('shelf_reference_without_product_name', path);
        }
      }
    }
  }
  const serialOwners = new Map();
  report.counts.namedProducts = 0;
  report.counts.units = 0;
  for (const [id, p] of entries(inventory)) {
    const path = `inventory/${id}`;
    if (typeof p.name !== 'string' || !p.name.trim()) issue('inventory_without_name', path);
    else report.counts.namedProducts++;
    if (p.name && !quantityValid(p.available)) issue('invalid_available', path);
    if (p.details && p.additionalInfo && p.details !== p.additionalInfo)
      issue('distinct_notes_fields', path);
    const units = entries(p.units);
    report.counts.units += units.length;
    if (units.length && Number(p.available) !== units.length)
      issue('unit_count_differs_from_available', path);
    for (const [serial] of units) {
      if (serialOwners.has(serial)) issue('serial_on_multiple_products', path);
      else serialOwners.set(serial, id);
    }
    const placed = locations.get(id) ?? [];
    if (placed.length > 1) issue('multiple_shelf_locations', path);
    if (p.shelfLocation && !placed.some((v) => v.label === p.shelfLocation))
      issue('shelf_cache_without_matching_location', path);
    if (placed.length && !p.shelfLocation) issue('shelf_location_without_cache', path);
  }
  report.counts.unnamedInventoryRecords = entries(inventory).length - report.counts.namedProducts;
  for (const branch of ['keikat', 'archived-trips']) {
    report.shapes[branch] = { items: {}, packedItems: {}, packedEntries: {} };
    for (const [id, trip] of entries(data[branch])) {
      const path = `${branch}/${id}`;
      const start = Date.parse(trip.startDate),
        end = Date.parse(trip.endDate);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end)
        issue('invalid_trip_dates', path);
      if (branch === 'keikat' && Object.hasOwn(data['archived-trips'] ?? {}, id))
        issue('active_archive_duplicate', path);
      for (const field of ['items', 'packedItems']) {
        count(report.shapes[branch][field], shape(trip[field]));
        for (const [key, item] of entries(trip[field])) {
          const itemPath = `${path}/${field}/${key}`;
          if (field === 'packedItems') count(report.shapes[branch].packedEntries, shape(item));
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            issue('noncanonical_item_entry', itemPath);
            continue;
          }
          if (key === 'manualItems') {
            issue('legacy_manualItems', itemPath);
            continue;
          }
          if (!quantityValid(item.quantity)) issue('invalid_item_quantity', itemPath);
          if (key.startsWith('manual-')) {
            issue('manual_item_requires_identity_review', itemPath);
          } else {
            const productId = item.productId ?? item.id ?? key;
            if (!Object.hasOwn(inventory, productId)) issue('item_product_missing', itemPath);
            else if (!inventory[productId]?.name) issue('item_product_without_name', itemPath);
            if (item.isSerial && Number(item.quantity) !== entries(item.serials).length)
              issue('packed_serial_count_mismatch', itemPath);
            for (const [serial] of entries(item.serials)) {
              if (!Object.hasOwn(inventory[productId]?.units ?? {}, serial))
                issue('packed_serial_missing_from_current_product', itemPath);
            }
          }
        }
      }
      if (trip.manualItems) issue('legacy_manualItems', `${path}/manualItems`);
    }
  }
  for (const f of report.findings) count(report.summary, f.code);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [source, output] = process.argv.slice(2);
  if (!source || !output)
    throw new Error('Usage: node tools/audit-export.mjs <source.json> <report.json>');
  if (resolve(source).toLowerCase() === resolve(output).toLowerCase())
    throw new Error('Output must differ from source');
  const bytes = readFileSync(source);
  const report = {
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    ...auditExport(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))),
  };
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify(
      { counts: report.counts, shapes: report.shapes, summary: report.summary },
      null,
      2,
    ),
  );
}
