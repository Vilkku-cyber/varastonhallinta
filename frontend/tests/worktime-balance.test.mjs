import test from 'node:test';
import assert from 'node:assert/strict';
import { settleBalance, toInstant, formatSignedMinutes } from '../src/worktime/engine.js';
import { applyOperation } from '../src/worktime/state.js';

const now = Date.parse(toInstant('2026-11-09T10:00'));
const work = (date, hours = 8) => ({
  id: date,
  kind: 'work',
  start: toInstant(`${date}T08:00`),
  end: toInstant(`${date}T${String(8 + hours).padStart(2, '0')}:00`),
  breaks: [],
});
const settings = {
  startDate: '2026-11-02',
  weeklyMinutes: 2400,
  workDays: [1, 2, 3, 4, 5],
  openingMinutes: 0,
};

test('a normal 40-hour week has two free days and no debit or surplus', () => {
  const b = settleBalance(
    ['02', '03', '04', '05', '06'].map((d) => work(`2026-11-${d}`)),
    now,
    null,
    settings,
  );
  assert.equal(b.target, 2400);
  assert.equal(b.balance, 0);
  assert.equal(b.used, 0);
  assert.equal(b.freeDays, 2);
  assert.equal(b.weekdayFreeDays, 0);
  assert.equal(b.restDays, 2);
});
test('weekday time off consumes opening balance; weekends do not', () => {
  const b = settleBalance(
    ['02', '03', '04', '05'].map((d) => work(`2026-11-${d}`)),
    now,
    null,
    { ...settings, openingMinutes: 600 },
  );
  assert.equal(b.balance, 120);
  assert.equal(b.used, 480);
  assert.equal(b.freeDays, 3);
  assert.equal(b.weekdayFreeDays, 1);
});
test('a long day earns weighted time once and a short day uses it', () => {
  const b = settleBalance(
    [
      work('2026-11-02', 10),
      work('2026-11-03', 6),
      ...['04', '05', '06'].map((d) => work(`2026-11-${d}`)),
    ],
    now,
    null,
    settings,
  );
  assert.equal(b.actual, 2400);
  assert.equal(b.extra, 120);
  assert.equal(b.premium, 60);
  assert.equal(b.used, 120);
  assert.equal(b.rawBalance, 0);
  assert.equal(b.balance, 60);
});
test('weekend work earns weekly overtime once, including its premium', () => {
  const b = settleBalance(
    ['02', '03', '04', '05', '06', '07'].map((d) => work(`2026-11-${d}`)),
    now,
    null,
    settings,
  );
  assert.equal(b.extra, 480);
  assert.equal(b.premium, 240);
  assert.equal(b.balance, 720);
});
test('working a weekend instead of a weekday balances at 40 hours without invented overtime', () => {
  const b = settleBalance(
    ['02', '03', '04', '05', '07'].map((d) => work(`2026-11-${d}`)),
    now,
    null,
    settings,
  );
  assert.equal(b.extra, 480);
  assert.equal(b.used, 480);
  assert.equal(b.premium, 0);
  assert.equal(b.balance, 0);
});
test('tracking starts at the first entry by default; current and future unworked dates are not debited', () => {
  const b = settleBalance([work('2026-11-04')], Date.parse(toInstant('2026-11-05T12:00')));
  assert.equal(b.startDate, '2026-11-04');
  assert.equal(b.through, '2026-11-04');
  assert.equal(b.balance, 0);
  assert.equal(settleBalance([], now).rows.length, 0);
  assert.equal(settleBalance([work('2026-11-12')], now).balance, 0);
});
test('future entries cannot change the present balance or premium', () => {
  const before = settleBalance([work('2026-11-02')], now, null, settings);
  const after = settleBalance([work('2026-11-02'), work('2026-11-10', 14)], now, null, settings);
  assert.equal(after.balance, before.balance);
  assert.equal(after.premium, before.premium);
});
test('an open overnight timer prevents charging its unresolved days as time off', () => {
  const b = settleBalance(
    [work('2026-11-02')],
    now,
    { start: toInstant('2026-11-05T22:00') },
    settings,
  );
  assert.equal(b.through, '2026-11-04');
  assert.equal(b.rows.length, 3);
});
test('37.5-hour schedule and customized workdays alter targets without reclassifying legal overtime', () => {
  const b = settleBalance(
    ['02', '03', '04', '05', '06'].map((d) => work(`2026-11-${d}`)),
    now,
    null,
    { ...settings, weeklyMinutes: 2250 },
  );
  assert.equal(b.target, 2250);
  assert.equal(b.extra, 150);
  assert.equal(b.premium, 0);
  assert.equal(b.balance, 150);
  const shifted = settleBalance(
    ['03', '04', '05', '06', '07'].map((d) => work(`2026-11-${d}`)),
    now,
    null,
    { ...settings, workDays: [2, 3, 4, 5, 6] },
  );
  assert.equal(shifted.balance, 0);
});
test('correction, deletion and restoration recalculate balances instead of adding duplicate ledger entries', () => {
  const entries = ['02', '03', '04', '05', '06'].map((d) => work(`2026-11-${d}`));
  assert.equal(settleBalance(entries, now, null, settings).balance, 0);
  entries[4].deleted = true;
  assert.equal(settleBalance(entries, now, null, settings).balance, -480);
  entries[4].deleted = false;
  assert.equal(settleBalance(entries, now, null, settings).balance, 0);
  entries[0] = work('2026-11-02', 10);
  assert.equal(settleBalance(entries, now, null, settings).balance, 180);
});
test('settings are version-checked and stored with old/new values and a balance snapshot', () => {
  const operation = {
    type: 'settings',
    settings,
    expectedRevision: 0,
    id: 'settings-1',
    actor: 'me',
    at: new Date(now).toISOString(),
  };
  const state = applyOperation(null, operation);
  assert.deepEqual(state.settings, settings);
  assert.equal(state.history['settings-1'].settingsBefore, null);
  assert.equal(state.history['settings-1'].calculation.balance.target, 2400);
  assert.throws(() => applyOperation(state, { ...operation, id: 'settings-2' }), /muuttuneet/);
  assert.throws(() =>
    applyOperation(null, { ...operation, settings: { ...settings, workDays: [] } }),
  );
  assert.equal(formatSignedMinutes(-450), '−7 h 30 min');
});

test('weighted overtime carries to a later week and is consumed by weekday leave once', () => {
  const entries = ['02', '03', '04', '05', '06'].map((d) => work(`2026-11-${d}`, 10));
  entries.push(...['10', '11', '12', '13'].map((d) => work(`2026-11-${d}`)));
  const b = settleBalance(entries, Date.parse(toInstant('2026-11-16T10:00')), null, settings);
  assert.equal(b.weeks[0].balance, 900);
  assert.equal(b.weeks[1].balance, 420);
  assert.equal(b.balance, 420);
  assert.equal(b.premium, 300);
  assert.equal(b.used, 480);
  assert.equal(b.freeDays, 5);
  assert.equal(b.weekdayFreeDays, 1);
});

test('future-ended saved overnight shifts are not mistaken for unworked past days', () => {
  const entries = [
    work('2026-11-02'),
    { ...work('2026-11-05'), end: toInstant('2026-11-10T08:00') },
  ];
  const b = settleBalance(entries, now, null, settings);
  assert.equal(b.through, '2026-11-04');
  assert.equal(b.actual, 480);
});
