import test from 'node:test';
import assert from 'node:assert/strict';
import { initialDemo } from '../src/domain/demoSetup.ts';
import { prepareLegacy, replaceDemo, sourceHash } from '../src/domain/cloudImport.ts';
import { parseBackup } from '../src/domain/backup.ts';

test('migration preserves source and previous workspace, rejects stale or repeated replacement', async () => {
  const previous = initialDemo(null)!;
  const source = {
    inventory: { old: { name: 'Oikea tuote', available: 4 } },
    todo: { t: { text: 'Tehtävä', done: true } },
  };
  const preview = prepareLegacy(source, previous, await sourceHash(source));
  const imported = replaceDemo(previous, preview);
  assert.deepEqual(Object.keys(imported.products), ['old']);
  assert.deepEqual(imported.migration?.source, source);
  assert.deepEqual(imported.migration?.previousState, previous);
  assert.equal(imported.revision, 2);
  assert.throws(() => replaceDemo(imported, preview));
  assert.throws(() => replaceDemo({ ...previous, revision: 4 }, preview));
  assert.deepEqual(
    parseBackup({ format: 'av-arsenal-backup', version: 2, state: imported }).state.migration,
    imported.migration,
  );
});
test('source fingerprint ignores object ordering but detects changes', async () => {
  assert.equal(await sourceHash({ a: 1, b: 2 }), await sourceHash({ b: 2, a: 1 }));
  assert.notEqual(await sourceHash({ a: 1 }), await sourceHash({ a: 2 }));
  assert.throws(() => prepareLegacy({ inventory: {} }, initialDemo(null)!, 'empty'));
});
