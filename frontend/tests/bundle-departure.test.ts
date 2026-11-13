import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState } from '../src/domain/seed.ts';
import { applyCommand, type Command } from '../src/domain/commands.ts';
import { isDemoWorkspace } from '../src/domain/cloudImport.ts';
import type { State } from '../src/domain/model.ts';
const run = (s: State, c: Command) =>
  applyCommand(s, c, crypto.randomUUID(), '2026-11-13T09:00:00Z');
test('departure rejects a newly damaged held unit without changing trips', () => {
  let s = demoState();
  s.trips.demo2.start = s.trips.demo2.end = s.trips.demo1.start;
  for (const id of ['demo1', 'demo2']) {
    s.trips[id].items = [s.trips[id].items[0]];
    s.trips[id].items[0].quantity = 1;
  }
  s = run(s, { type: 'bundleCreate', id: 'b', name: 'Auto', tripIds: ['demo1', 'demo2'] });
  s = run(s, {
    type: 'bundle',
    id: 'b',
    expected: 1,
    action: 'load',
    productId: 'screen',
    unitId: 'screen-1',
  });
  s = run(s, {
    type: 'bundle',
    id: 'b',
    expected: 2,
    action: 'load',
    productId: 'screen',
    quantity: 1,
  });
  s = run(s, {
    type: 'unitCondition',
    productId: 'screen',
    unitId: 'screen-1',
    expected: s.products.screen.version,
    condition: 'maintenance',
    notes: 'Vaurio',
  });
  assert.throws(
    () => run(s, { type: 'bundle', id: 'b', expected: 3, action: 'depart' }),
    /huoltoon/,
  );
  assert.equal(s.trips.demo1.status, 'planned');
  s.events.push({ id: 'demo-setup', at: 'now', text: 'demo' });
  assert.equal(isDemoWorkspace(s), false);
});
