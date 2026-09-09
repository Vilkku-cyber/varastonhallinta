import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initialDemo } from '../frontend/src/domain/demoSetup.ts';
const require = createRequire(new URL('../tmp/firebase-test/package.json', import.meta.url));
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000') {
  throw Error('Tests require the local emulator at 127.0.0.1:9000.');
}
const env = await initializeTestEnvironment({
  projectId: 'demo-av-arsenal',
  database: { host: '127.0.0.1', port: 9000, rules: readFileSync(new URL('database.rules.json', import.meta.url), 'utf8') },
});
let passed = 0;
async function check(name, action) { await action(); passed++; console.log(`PASS ${name}`); }
try {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().set({ allowedUsers: { approved: true, disabled: false }, inventory: { test: true }, keikat: { test: true }, 'archived-trips': { test: true }, shelves: { test: true }, todo: { test: true } });
  });
  const approved = env.authenticatedContext('approved').database();
  const denied = env.authenticatedContext('unknown').database();
  const disabled = env.authenticatedContext('disabled').database();
  const anon = env.unauthenticatedContext().database();
  for (const path of ['inventory', 'keikat', 'archived-trips', 'shelves', 'todo']) {
    await check(`legacy ${path}: approved read/write; anonymous and unlisted denied`, async () => {
      await assertSucceeds(approved.ref(path).once('value'));
      await assertSucceeds(approved.ref(`${path}/probe`).set(true));
      for (const db of [anon, denied, disabled]) {
        await assertFails(db.ref(path).once('value'));
        await assertFails(db.ref(`${path}/probe`).set(false));
      }
    });
  }
  await check('no client may read or grant allowedUsers permissions', async () => {
    for (const db of [approved, denied, anon]) {
      await assertFails(db.ref('allowedUsers').once('value'));
      await assertFails(db.ref('allowedUsers/unknown').set(true));
    }
  });
  const path = 'avArsenalV2/state';
  await check('approved can initialize v2 and read it', async () => {
    const created = await assertSucceeds(approved.ref(path).transaction(initialDemo));
    assert.equal(created.committed, true);
    assert.equal((await approved.ref(path).once('value')).val().revision, 1);
    assert.equal(Object.keys((await approved.ref(path).once('value')).val().products).length, 8);
    const repeated = await approved.ref(path).transaction(initialDemo);
    assert.equal(repeated.committed, false);
    assert.equal((await approved.ref(path).once('value')).val().revision, 1);
  });
  await check('anonymous, unlisted and disabled users cannot access v2', async () => {
    for (const db of [anon, denied, disabled]) {
      await assertFails(db.ref(path).once('value'));
      await assertFails(db.ref(path).set({ schemaVersion: 2, revision: 2 }));
    }
  });
  await check('root reads and writes remain denied', async () => {
    await assertFails(approved.ref().once('value'));
    await assertFails(approved.ref().set({ replaced: true }));
  });
  await check('invalid schema, stale revision and whole-state deletion denied', async () => {
    await assertFails(approved.ref(path).set({ schemaVersion: 1, revision: 2 }));
    await assertFails(approved.ref(path).set({ schemaVersion: 2, revision: 1 }));
    await assertFails(approved.ref(path).remove());
  });
  await check('negative stock denied', async () => {
    await assertFails(approved.ref(path).set({ schemaVersion: 2, revision: 2, products: { p: { id: 'p', name: 'Test', total: -1, maintenance: 0, tracking: 'quantity', version: 1 } } }));
  });
  await check('valid stock update visible to another authenticated connection', async () => {
    const second = env.authenticatedContext('approved', { session: 'second' }).database();
    const next = { schemaVersion: 2, revision: 2, products: { p: { id: 'p', name: 'Test', total: 10, maintenance: 0, tracking: 'quantity', version: 1 } } };
    await assertSucceeds(approved.ref(path).set(next));
    assert.equal((await second.ref(`${path}/products/p/total`).once('value')).val(), 10);
  });
  console.log(`All ${passed} emulator checks passed. No production data accessed.`);
} finally { await env.cleanup(); }
