# RTDB rules verification

2026-09-09: 12 grouped checks passed against the local Realtime Database emulator 4.11.2, Firebase CLI 15.29.0, rules-unit-testing 5.0.2 and Java 21. No production database was accessed. The test loads database.rules.json directly.

Coverage: the five legacy paths preserve approved access and deny anonymous/unlisted/disabled users; allowedUsers cannot be read or modified by clients; v2 permits approved access; root access, stale revisions, invalid schema, negative stock and whole-state deletion are denied; a valid write is visible through another authenticated SDK connection.

This does not validate every business invariant, a real browser login, live production rules, or migration correctness. Calendar and packing checks remain in frontend/tests. The two SDK connections are not two physical devices.

## Live-import implementation

firebase/import-test.mjs additionally tested the actual legacy export in the local emulator: 189 products, 124 trips and 378 review notes were written atomically into v2. All five legacy source branches stayed unchanged. The previous demo workspace and original source remained in state.migration, and repeated/stale replacement was rejected. Sparse Firebase arrays are compared by JSON representation. This verifies preservation and rule acceptance, not resolution of historical ambiguities.

The app reads the five permitted legacy branches twice for a stable preview, and checks the source hash again immediately before replacing v2 in a transaction. Legacy edits must be paused during the import: separately read branches cannot form a globally atomic snapshot under the existing per-branch permissions. This is a one-time copy; there is no ongoing old/new synchronization.

Run from the repository root after installing a Java 21+ runtime:

```powershell
npm install --prefix tmp/firebase-test firebase-tools@15.29.0 @firebase/rules-unit-testing@5.0.2 firebase@12.18.0
$env:CI='true'
node tmp/firebase-test/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only database --project demo-av-arsenal --config firebase/emulator.json "node firebase/rules-test.mjs"
```

The local portable Java runtime used during verification is tmp/java21/jdk-21.0.12.1+1-jre. Add its bin directory to the current process PATH if Java is not installed globally. Dependencies and emulator downloads in tmp are ignored by Git. Do not use a real Firebase project ID for these tests.
