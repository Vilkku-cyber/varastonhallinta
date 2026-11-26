import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, type Command } from '../src/domain/commands.ts';
import { demoState, item } from '../src/domain/seed.ts';
import { legacyLedIds } from '../src/domain/led.ts';
import {
  parseCurveDocument,
  parseLedProject,
  projectChanges,
  projectMaterials,
  type LedProjectDraft,
} from '../src/domain/ledProjects.ts';
import { curveGeometry } from '../src/domain/kaariGeometry.ts';
import { hydrate, LocalRepository } from '../src/data/repository.ts';
import { parseBackup } from '../src/domain/backup.ts';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

const date = '2027-05-01',
  at = date + 'T12:00:00Z';
let operation = 0;
function setup() {
  const s = demoState(),
    t = s.trips.demo1;
  t.start = t.end = date;
  t.items = [item('panel', s.products.panel.name, 3)];
  s.trips = { demo1: t };
  s.products.panel.total = 500;
  for (const id of Object.values(legacyLedIds))
    s.products[id] = { ...s.products.hdmi, id, name: id, total: 2000 };
  return s;
}
function draft(count = 8, id = 'plan-1'): LedProjectDraft {
  return {
    id,
    name: 'Lavan LED',
    curve: parseCurveDocument({
      version: 2,
      angles: Array(count).fill(10),
      rotation: 0,
      horizontal: true,
      pins: [],
      selected: 0,
      selection: [0],
      pointKind: 'mid',
      shapeInfo: null,
    }),
    configuration: {
      selectedPanel: 'panel',
      long: 'panel',
      half: '',
      processor: '',
      width: 200,
      height: 1000,
      powerLimit: null,
      mount: 'none',
      start: 0,
      bindings: { ...legacyLedIds },
    },
  };
}
const command = (s: ReturnType<typeof setup>, c: Command) =>
  applyCommand(s, c, `led-operation-${++operation}`, at, date);
const save = (s: ReturnType<typeof setup>, p = draft()) =>
  command(s, {
    type: 'ledPlanSave',
    tripId: 'demo1',
    plan: p,
    planVersion: s.trips.demo1.ledPlans?.[p.id]?.version ?? 0,
    expected: s.trips.demo1.version,
  });
const apply = (s: ReturnType<typeof setup>, planId = 'plan-1') =>
  command(s, {
    type: 'ledPlanApply',
    tripId: 'demo1',
    planId,
    planVersion: s.trips.demo1.ledPlans![planId].version,
    expected: s.trips.demo1.version,
  });

test('saving only the plan preserves all items, packing, status and reservation demand', () => {
  const s = setup();
  s.trips.demo1.status = 'packed';
  s.trips.demo1.items[0].packed = 3;
  s.products.panel.total = 0; // Metadata can be saved even if no stock remains.
  const after = save(s);
  assert.deepEqual(after.trips.demo1.items, s.trips.demo1.items);
  assert.equal(after.trips.demo1.status, 'packed');
  assert.equal(after.trips.demo1.ledPlans!['plan-1'].version, 1);
  assert.equal(after.trips.demo1.ledPlans!['plan-1'].appliedVersion, 0);
  assert.equal(after.trips.demo1.ledPlans!['plan-1'].configuration.width, 4000);
  assert(!s.trips.demo1.ledPlans);
});
test('panel quantity is real columns times height rows, not projected bounding width', () => {
  const p = draft(24),
    s = setup();
  p.configuration.height = 2000;
  p.curve!.angles.fill(15);
  const g = curveGeometry(p.curve!);
  assert(g.width < 12000);
  assert.equal(projectMaterials(p, s.products).find((i) => i.productId === 'panel')!.quantity, 96);
});
test('applying creates separate owned rows without absorbing the same product already on the trip', () => {
  const s = save(setup()),
    after = apply(s),
    t = after.trips.demo1;
  assert.deepEqual(
    t.items.find((i) => i.id === 'row-panel'),
    s.trips.demo1.items[0],
  );
  assert.equal(
    t.items.find((i) => i.ledPlanId === 'plan-1' && i.productId === 'panel')!.quantity,
    16,
  );
  assert.equal(t.ledPlans!['plan-1'].appliedVersion, 1);
  assert(t.items.filter((i) => i.productId === 'panel').length === 2);
});
test('repeated apply updates the same rows, never appends another copy', () => {
  const once = apply(save(setup())),
    twice = apply(once);
  assert.deepEqual(twice.trips.demo1.items, once.trips.demo1.items);
});
test('saving a new shape revision leaves old quantities until the explicit update', () => {
  const once = apply(save(setup())),
    saved = save(once, draft(10));
  assert.deepEqual(saved.trips.demo1.items, once.trips.demo1.items);
  assert.equal(saved.trips.demo1.ledPlans!['plan-1'].version, 2);
  assert.equal(saved.trips.demo1.ledPlans!['plan-1'].appliedVersion, 1);
  const updated = apply(saved);
  assert.equal(
    updated.trips.demo1.items.find((i) => i.ledPlanId === 'plan-1' && i.productId === 'panel')!
      .quantity,
    20,
  );
});
test('updating one LED plan does not touch another plan or manual rows', () => {
  const a = apply(save(setup())),
    b = apply(save(a, draft(4, 'plan-2')), 'plan-2');
  const after = apply(save(b, draft(10)));
  assert.deepEqual(
    after.trips.demo1.items.filter((i) => i.ledPlanId !== 'plan-1'),
    b.trips.demo1.items.filter((i) => i.ledPlanId !== 'plan-1'),
  );
});
test('availability is checked for the whole trip at update and failures are atomic', () => {
  const s = save(setup());
  s.products.panel.total = 18; // Need 16 + 3 manual panels.
  const before = structuredClone(s);
  assert.throws(() => apply(s), /vapaana/);
  assert.deepEqual(s, before);
});
test('packed and serial fields survive quantity growth with stable row IDs', () => {
  const s = apply(save(setup())),
    row = s.trips.demo1.items.find((i) => i.ledPlanId === 'plan-1' && i.productId === 'panel')!;
  Object.assign(row, {
    packed: 3,
    returned: 1,
    unitIds: ['a', 'b', 'c'],
    returnedUnitIds: ['a'],
    serialSnapshots: ['AV-a', 'AV-b', 'AV-c'],
  });
  const after = apply(save(s, draft(10))),
    result = after.trips.demo1.items.find((i) => i.id === row.id)!;
  for (const key of [
    'packed',
    'returned',
    'unitIds',
    'returnedUnitIds',
    'serialSnapshots',
  ] as const)
    assert.deepEqual(result[key], row[key]);
  assert.equal(result.quantity, 20);
});
test('decreasing below packed quantity is refused outside a bundle', () => {
  const s = apply(save(setup())),
    row = s.trips.demo1.items.find((i) => i.ledPlanId === 'plan-1' && i.productId === 'panel')!;
  row.packed = 16;
  assert.throws(() => apply(save(s, draft(4))), /alittaa pakatun/);
});
test('bundle demand can shrink while physical surplus and bundle holdings stay packed', () => {
  let s = apply(save(setup())),
    row = s.trips.demo1.items.find((i) => i.ledPlanId === 'plan-1' && i.productId === 'panel')!;
  row.packed = 16;
  s.trips.other = { ...structuredClone(s.trips.demo1), id: 'other', items: [], ledPlans: {} };
  s.bundles = {
    b: {
      id: 'b',
      name: 'Nippu',
      tripIds: ['demo1', 'other'],
      version: 1,
      departed: false,
      closed: false,
      holding: { panel: { quantity: 2, unitIds: [] } },
    },
  };
  const saved = save(s, draft(4));
  assert.equal(saved.bundles!.b.version, 1);
  const after = apply(saved),
    updated = after.trips.demo1.items.find((i) => i.id === row.id)!;
  assert.equal(updated.quantity, 8);
  assert.equal(updated.packed, 16);
  assert.deepEqual(after.bundles!.b.holding, s.bundles.b.holding);
  assert.equal(after.bundles!.b.version, 2);
});
test('removed plan products cannot silently remove packed rows', () => {
  const s = setup(),
    p = draft();
  p.configuration.mount = 'feet';
  const applied = apply(save(s, p)),
    feet = applied.trips.demo1.items.find((i) => i.productId === legacyLedIds.feet)!;
  feet.packed = 1;
  assert.throws(() => apply(save(applied, draft())), /pakattua kalustoa/);
});
test('optimistic versions reject stale plan save and stale material application', () => {
  const s = save(setup());
  assert.throws(
    () =>
      command(s, {
        type: 'ledPlanSave',
        tripId: 'demo1',
        plan: draft(),
        planVersion: 0,
        expected: 1,
      }),
    /muuttui toisella/,
  );
  assert.throws(
    () =>
      command(s, {
        type: 'ledPlanApply',
        tripId: 'demo1',
        planId: 'plan-1',
        expected: s.trips.demo1.version,
        planVersion: 0,
      }),
    /muuttui toisella/,
  );
});
test('closed trips reject both operations; out trips allow drawings but not non-bundle inventory edits', () => {
  const s = setup();
  s.trips.demo1.status = 'closed';
  assert.throws(() => save(s), /Arkistoitua/);
  s.trips.demo1.status = 'out';
  const saved = save(s);
  assert.throws(() => apply(saved), /Keikalla olevan/);
  saved.trips.demo1.status = 'returning';
  assert.throws(() => apply(saved), /Keikalla olevan/);
});
test('a live trip subscription cannot let an old editor overwrite a newer plan revision', () => {
  const first = save(setup()),
    oldDraft = draft();
  const newer = draft();
  newer.name = 'Toisen käyttäjän uudempi suunnitelma';
  const current = save(first, newer);
  assert.throws(
    () =>
      command(current, {
        type: 'ledPlanSave',
        tripId: 'demo1',
        plan: oldDraft,
        planVersion: 1,
        expected: current.trips.demo1.version,
      }),
    /muuttui toisella/,
  );
  assert.equal(current.trips.demo1.ledPlans!['plan-1'].name, newer.name);
});
test('general trip edits preserve authoritative saved plans and cannot forge row ownership', () => {
  const s = save(setup()),
    trip = structuredClone(s.trips.demo1);
  trip.ledPlans = {};
  trip.items[0].ledPlanId = 'plan-1';
  const after = command(s, { type: 'trip', trip, expected: trip.version });
  assert.deepEqual(after.trips.demo1.ledPlans, s.trips.demo1.ledPlans);
  assert.equal(after.trips.demo1.items[0].ledPlanId, undefined);
});
test('curve documents reject invalid angles, nonfinite coordinates, oversized input and invalid IDs', () => {
  const d = draft();
  for (const angles of [[31], [1], [NaN], [], Array(201).fill(0)])
    assert.throws(() => parseCurveDocument({ ...d.curve, angles }));
  for (const id of ['../bad', 'a/b', 'a.b', 'a#b', '[bad]', '', '__proto__', 'constructor'])
    assert.throws(() => parseLedProject({ ...d, id }));
  assert.throws(() =>
    parseCurveDocument({ ...d.curve, pins: [{ i: 0, kind: 'mid', x: Infinity, y: 0 }] }),
  );
});
test('stored shape labels are sanitized and zero-depth waves roundtrip', () => {
  const d = parseCurveDocument({
    ...draft().curve,
    shapeInfo: {
      kind: 'wave',
      width: 10000,
      depth: 0,
      cycles: 2,
      title: '<script>bad</script>',
      method: '<img>',
    },
  });
  assert.equal(d.shapeInfo!.title, 'Aalto');
  assert.equal(d.shapeInfo!.depth, 0);
  assert(!JSON.stringify(d).includes('<script>'));
});
test('Pintaled cannot accidentally be counted as the 500 mm curve geometry', () => {
  const p = draft();
  p.configuration.selectedPanel = 'surface1';
  p.configuration.long = 'surface1';
  assert.throws(() => projectMaterials(p, setup().products), /Kaari käyttää/);
});
test('backup restore preserves drawings, revisions and ownership', () => {
  const s = apply(save(setup())),
    restored = parseBackup({ format: 'av-arsenal-backup', version: 2, state: s }).state;
  assert.deepEqual(restored.trips.demo1.ledPlans, s.trips.demo1.ledPlans);
  assert.deepEqual(restored.trips.demo1.items, s.trips.demo1.items);
  restored.trips.demo1.ledPlans!['plan-1'].curve!.angles[0] = 1;
  assert.throws(
    () => parseBackup({ format: 'av-arsenal-backup', version: 2, state: restored }),
    /2,5/,
  );
});
test('RTDB empty-array pruning hydrates curve metadata without losing settings', () => {
  const s = save(setup()),
    curve = s.trips.demo1.ledPlans!['plan-1'].curve!;
  delete (curve as Partial<typeof curve>).pins;
  delete (curve as Partial<typeof curve>).selection;
  delete (curve as Partial<typeof curve>).shapeInfo;
  const restored = hydrate(s).trips.demo1.ledPlans!['plan-1'].curve!;
  assert.deepEqual(restored.pins, []);
  assert.deepEqual(restored.selection, []);
  assert.equal(restored.shapeInfo, null);
  assert.equal(restored.angles.length, 8);
});
test('RTDB missing null fields restore straight plans and optional power limits', () => {
  const p = draft();
  p.curve = null;
  const s = save(setup(), p),
    plan = s.trips.demo1.ledPlans!['plan-1'];
  delete (plan as Partial<typeof plan>).curve;
  delete (plan.configuration as Partial<typeof plan.configuration>).powerLimit;
  const restored = hydrate(s).trips.demo1.ledPlans!['plan-1'];
  assert.equal(restored.curve, null);
  assert.equal(restored.configuration.powerLimit, null);
  assert.doesNotThrow(() => parseLedProject(restored));
});
test('applying a naming-only revision preserves a packed trip status', () => {
  const s = apply(save(setup()));
  s.trips.demo1.status = 'packed';
  const p = draft();
  p.name = 'Uusi nimi';
  const after = apply(save(s, p));
  assert.equal(after.trips.demo1.status, 'packed');
});
test('native preview computes exact circle extents and horizontal chord geometry', () => {
  const circle = draft(12).curve!;
  circle.angles.fill(30);
  const g = curveGeometry(circle);
  assert(Math.abs(g.width - 6000 / Math.PI) < 1e-7);
  assert(g.gap < 1e-7);
  const wave = draft().curve!;
  wave.angles = [10, 15, -15, -10, -10, -15, 15, 10];
  const w = curveGeometry(wave);
  assert(Math.abs(w.end.y - w.start.y) < 1e-7);
});
test('local repository persists a saved plan across closing and reopening the workspace', async () => {
  Object.assign(globalThis, { indexedDB, IDBKeyRange });
  const name = `led-test-${crypto.randomUUID()}`,
    repo = new LocalRepository(name);
  await repo.importLocal(setup(), null);
  await repo.dispatch({
    type: 'ledPlanSave',
    tripId: 'demo1',
    plan: draft(),
    planVersion: 0,
    expected: 1,
  });
  await repo.dispose();
  const again = new LocalRepository(name);
  const backup = (await again.backup()) as { state: ReturnType<typeof setup> };
  assert.equal(backup.state.trips.demo1.ledPlans!['plan-1'].curve!.angles.length, 8);
  assert.equal(backup.state.trips.demo1.items.length, 1);
  await again.dispose();
});
test('preview reports only this plan contribution including removals', () => {
  const s = apply(save(setup())),
    changes = projectChanges(s.trips.demo1, draft(10), s.products);
  const panel = changes.find((c) => c.productId === 'panel')!;
  assert.equal(panel.before, 16);
  assert.equal(panel.after, 20);
});
