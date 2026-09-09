import test from 'node:test';
import assert from 'node:assert/strict';
import {
  panelPlan,
  panelKind,
  mounting,
  ledItems,
  panelPixels,
  processorCapacity,
} from '../src/domain/led.ts';
import { demoState } from '../src/domain/seed.ts';
test('surface geometry is actual 1000 and 500 wide panels, height 250', () => {
  const p = panelPlan(2500, 500, 500, 500, true);
  assert.deepEqual(p.columnWidths, [1000, 1000, 500]);
  assert.equal(p.long, 4);
  assert.equal(p.half, 2);
  assert.equal(p.panels, 6);
  assert.equal(p.midCables, 10);
  assert.equal(p.dataFeeds, 3);
  assert.equal(p.powerFeeds, null);
  assert.deepEqual(panelPlan(400, 100, 500, 500, true).columnWidths, [500]);
});
test('vertical surface data splits at exactly eight panels, separate power limit', () => {
  assert.equal(panelPlan(2500, 2000, 500, 500, true, 4).dataFeeds, 3);
  const p = panelPlan(2500, 2001, 500, 500, true, 4);
  assert.equal(p.rows, 9);
  assert.equal(p.dataFeeds, 6);
  assert.equal(p.powerFeeds, 9);
});
test('standard power continues at 20, 21, 40 and 41 panel boundaries', () => {
  for (const [cols, feeds] of [
    [20, 1],
    [21, 2],
    [40, 2],
    [41, 3],
  ]) {
    const p = panelPlan(cols * 500, 1000);
    assert.equal(p.powerFeeds, feeds * 2);
    assert.equal(p.dataFeeds, 2);
  }
  assert.equal(panelPlan(3500, 500).midCables, 10);
  assert.equal(panelPlan(4000, 500).midCables, 20);
  assert.throws(() => panelPlan(NaN, 500));
  assert.throws(() => panelPlan(1000, 500, 500, 500, true, 0));
});
test('only LED panels are offered, distinguish physical sizes and edge variants', () => {
  const s = demoState();
  assert.equal(panelKind(undefined), null);
  assert.equal(panelKind(s.products.hdmi), null);
  assert.equal(panelKind(s.products.panel), 'standard');
  assert.equal(panelKind(s.products.surface1), 'long');
  assert.equal(panelKind(s.products.surface05), 'half');
  assert.equal(panelKind({ ...s.products.surface1, name: '1000x250 right LED' }), null);
  assert.equal(panelKind({ ...s.products.panel, category: 'LED prosessori' }), null);
});
test('mounting boundaries and complete material list merge duplicate products', () => {
  assert.deepEqual(mounting(panelPlan(2500, 3000), 'legs', 500), {
    shortPoles: 6,
    longPoles: 0,
    plates: 3,
    feet: 0,
  });
  assert.equal(mounting(panelPlan(2500, 3000), 'legs', 501).longPoles, 6);
  const s = demoState();
  const items = ledItems(
    [
      { productId: 'hdmi', quantity: 3, label: 'a' },
      { productId: 'hdmi', quantity: 4, label: 'b' },
    ],
    s.products,
    'LED',
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 7);
  assert.throws(() =>
    ledItems([{ productId: 'missing', quantity: 2, label: 'DATA' }], s.products, ''),
  );
});
test('pixel dimensions and explicit processor capacity', () => {
  const p = demoState().products.panel;
  assert.deepEqual(panelPixels({ ...p, notes: '512X128PX' }), { w: 512, h: 128 });
  assert.deepEqual(panelPixels({ ...p, notes: '168' }), { w: 168, h: 168 });
  assert.equal(processorCapacity({ ...p, notes: 'MaxPixels=10 400 000' }), 10400000);
  assert.equal(processorCapacity(p), null);
});
