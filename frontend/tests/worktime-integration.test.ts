import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalRepository } from '../src/data/repository.ts';
import { parseBackup } from '../src/domain/backup.ts';
import { initialDemo } from '../src/domain/demoSetup.ts';
import { prepareLegacy, replaceDemo } from '../src/domain/cloudImport.ts';
import { toInstant } from '../src/worktime/engine.js';

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
