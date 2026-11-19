import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalRepository } from '../src/data/repository.ts';
import { parseBackup } from '../src/domain/backup.ts';
import { initialDemo } from '../src/domain/demoSetup.ts';
import { prepareLegacy, replaceDemo } from '../src/domain/cloudImport.ts';
import { toInstant } from '../src/worktime/engine.js';
import { calculateRest } from '../src/worktime/rest.js';

test('worktime shares the repository, survives backup and rejects competing edits atomically', async () => {
  const name = crypto.randomUUID(),
    a = new LocalRepository(name),
    b = new LocalRepository(name);
  try {
    const before = ((await a.backup()) as { state: any }).state;
    await a.dispatch({ type: 'worktimeProfile', uid: 'one', name: 'Ensimmäinen' });
    await a.dispatch({ type: 'worktimeProfile', uid: 'two', name: 'Toinen' });
    const entry = {
      id: 'shift',
      kind: 'work',
      start: toInstant('2026-11-02T08:00'),
      end: toInstant('2026-11-02T16:00'),
      breaks: [],
    };
    await a.dispatch({
      type: 'worktime',
      actor: 'one',
      subject: 'two',
      operation: { type: 'save', entries: [entry] },
    });
    const backup = (await a.backup()) as { state: any };
    assert.deepEqual(backup.state.products, before.products);
    assert.deepEqual(backup.state.trips, before.trips);
    const saved = backup.state.worktime.records.two.entries.shift;
    assert.equal(saved.revision, 1);
    const history = Object.values(backup.state.worktime.records.two.history) as any[];
    assert.equal(history[0].actor, 'one');
    assert.equal(history[0].subject, 'two');
    const results = await Promise.allSettled(
      [a, b].map((repo) =>
        repo.dispatch({
          type: 'worktime',
          actor: 'one',
          subject: 'two',
          operation: { type: 'save', entries: [{ ...saved, note: 'Korjaus' }] },
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const roundtrip = parseBackup(await a.backup());
    assert.equal((roundtrip.state.worktime!.records.two as any).entries.shift.revision, 2);
    assert.equal(roundtrip.state.worktime!.records.one, undefined);
  } finally {
    await a.dispose();
    await b.dispose();
  }
});

test('warehouse import preserves existing time records and profile names', () => {
  const previous = initialDemo(null)!;
  previous.worktime = {
    people: { one: { name: 'Työntekijä' } },
    records: { one: { revision: 4 } },
  };
  const preview = prepareLegacy(
    { inventory: { product: { name: 'Kalusto', available: 1 } } },
    previous,
    'hash',
  );
  assert.deepEqual(replaceDemo(previous, preview).worktime, previous.worktime);
});

test('meal and rest reviews share employee storage, backup and transaction conflict protection', async () => {
  const name = crypto.randomUUID(),
    a = new LocalRepository(name),
    b = new LocalRepository(name);
  try {
    await a.dispatch({ type: 'worktimeProfile', uid: 'worker', name: 'Testi' });
    const entries = ['16', '17'].map((day) => ({
      id: day,
      kind: 'work',
      start: toInstant(`2026-11-${day}T08:00`),
      end: toInstant(`2026-11-${day}T22:22`),
      breaks: [],
      meal: 'with-work',
      mealMinutes: 0,
    }));
    await a.dispatch({
      type: 'worktime',
      actor: 'editor',
      subject: 'worker',
      operation: { type: 'save', entries },
    });
    const debt = calculateRest(entries, Date.parse(toInstant('2026-11-19T10:00'))).debts[0];
    const operation = {
      type: 'rest',
      expectedRevision: 1,
      debtId: debt.id,
      review: { confirmed: true, basis: 'continuity25', reason: 'Tarkistettu jatkuvuusperuste' },
    };
    const results = await Promise.allSettled(
      [a, b].map((repo) =>
        repo.dispatch({ type: 'worktime', actor: 'editor', subject: 'worker', operation }),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const restored = parseBackup(await a.backup()).state.worktime!.records.worker as any;
    assert.equal(restored.entries['16'].meal, 'with-work');
    assert.equal(restored.rest.reviews[debt.id].confirmed, true);
    assert.equal(restored.rest.reviews[debt.id].actor, 'editor');
    const event = Object.values(restored.history).find((e: any) => e.type === 'rest') as any;
    assert.equal(event.subject, 'worker');
    assert.equal(event.restBefore, null);
    assert.equal(event.restCalculation.remaining, 82);
    assert.equal(event.ruleSnapshot.compensation, 'time-off');
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
