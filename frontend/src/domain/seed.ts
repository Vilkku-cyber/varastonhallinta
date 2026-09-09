import { emptyState, type Product, type Trip, type Item } from './model.ts';
import { today, addDays } from './calendar.ts';
export function item(id: string, name: string, quantity = 1): Item {
  return {
    id: `row-${id}`,
    type: 'inventory',
    productId: id,
    name,
    quantity,
    note: '',
    packed: 0,
    returned: 0,
    unitIds: [],
    returnedUnitIds: [],
    serialSnapshots: [],
  };
}
export function demoState() {
  const s = emptyState();
  const now = today();
  const products: [string, string, string, number, string][] = [
    ['screen', 'Samsung 55″ näyttö', 'Näytöt', 10, '55 tuumaa'],
    ['speaker', 'Genelec 8030', 'Ääni', 8, ''],
    ['panel', 'LED-paneeli 500 × 500', 'LED', 80, '500 × 500 mm'],
    ['surface1', 'Pintaled 1000 × 250', 'LED', 24, '1000 × 250 mm'],
    ['surface05', 'Pintaled 500 × 250', 'LED', 12, '500 × 250 mm'],
    ['hdmi', 'HDMI 10 m', 'Kaapelit', 24, '10 m'],
    ['stand', 'Näytön lattiateline', 'Rakenteet', 10, ''],
    ['processor', 'LED-prosessori', 'Video', 3, ''],
  ];
  for (const [id, name, category, total, dimensions] of products)
    s.products[id] = {
      id,
      name,
      category,
      total,
      dimensions,
      maintenance: 0,
      tracking: 'quantity',
      units: {},
      notes: '',
      weight: '',
      retired: false,
      review: false,
      version: 1,
    };
  const p: Product = s.products.screen;
  p.tracking = 'serial';
  for (let n = 1; n <= 10; n++)
    p.units[`screen-${n}`] = {
      id: `screen-${n}`,
      serial: `AV-TV-${String(n).padStart(3, '0')}`,
      condition: 'ready',
      notes: '',
    };
  const create = (id: string, name: string, start: string, end: string, items: Item[]): Trip => ({
    id,
    name,
    start,
    end,
    items,
    contact: '',
    status: 'planned',
    notes: 'Esimerkkikeikka – voit muokata vapaasti.',
    version: 1,
    imported: false,
    packingUnknown: false,
  });
  s.trips.demo1 = create('demo1', 'Studio / tuotantopäivä', now, now, [
    item('screen', p.name, 6),
    item('hdmi', s.products.hdmi.name, 6),
  ]);
  s.trips.demo2 = create('demo2', 'Seminaari / päälava', addDays(now, 1), addDays(now, 1), [
    item('screen', p.name, 6),
    item('speaker', s.products.speaker.name, 4),
  ]);
  s.trips.demo3 = create('demo3', 'LED / tapahtumatila', addDays(now, 3), addDays(now, 4), [
    item('panel', s.products.panel.name, 24),
    item('processor', s.products.processor.name),
  ]);
  for (const [id, shelf, aisle, level] of [
    ['a11', 'A', '1', '1'],
    ['a12', 'A', '1', '2'],
    ['b11', 'B', '1', '1'],
    ['c11', 'C', '1', '1'],
  ])
    s.locations[id] = { id, shelf, aisle, level, direction: 'ltr' };
  ['screen', 'speaker', 'panel', 'hdmi'].forEach(
    (id, n) =>
      (s.placements[id] = {
        id,
        productId: id,
        locationId: ['a11', 'a12', 'b11', 'c11'][n],
        label: s.products[id].name,
      }),
  );
  s.tasks.task1 = { id: 'task1', text: 'Tarkista kalusto ennen seuraavaa lähtöä', done: false };
  return s;
}
