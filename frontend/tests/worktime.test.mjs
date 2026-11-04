import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculate,
  toInstant,
  entryMinutes,
  validateEntry,
  duration,
  weekKey,
} from '../src/worktime/engine.js';
import { applyOperation } from '../src/worktime/state.js';
import { formFrom, entryFrom } from '../src/worktime/forms.js';
import { employeeOptions, permissionsFor } from '../src/worktime/access.js';
import { RULES, RULES_V1 } from '../src/worktime/rules.js';

const at = '2026-11-04T18:00:00.000Z';
const make = (date, start = '08:00', end = '16:00', extra = {}) => ({
  id: `${date}-${start}`,
  kind: 'work',
  start: toInstant(`${date}T${start}`),
  end: toInstant(`${date}T${end}`),
  breaks: [],
  breakStatus: 'none',
  employerApproved: 'yes',
  employeeConsent: 'yes',
  ...extra,
});
const calc = (entries) => calculate(entries, Date.parse(at));
const op = (type, extra = {}) => ({
  type,
  id: crypto.randomUUID(),
  actor: 'test-user',
  at,
  ...extra,
});

test('08–19 with 30 unpaid minutes gives 10h30 and 4h leave', () => {
  const r = calc([
    make('2026-11-02', '08:00', '19:00', { breaks: [{ minutes: 30, paid: false }] }),
  ]);
  assert.equal(r.totals.minutes, 630);
  assert.equal(r.totals.regular, 480);
  assert.equal(r.totals.daily50, 120);
  assert.equal(r.totals.daily100, 30);
  assert.equal(r.totals.leave, 240);
});
test('no automatic deduction; paid break remains work', () => {
  assert.equal(entryMinutes(make('2026-11-02', '08:00', '19:00')), 660);
  assert.equal(
    entryMinutes(make('2026-11-02', '08:00', '19:00', { breaks: [{ minutes: 30, paid: true }] })),
    660,
  );
});
test('daily overtime is aggregated across split entries', () => {
  const r = calc([make('2026-11-02', '08:00', '13:00'), make('2026-11-02', '14:00', '20:00')]);
  assert.equal(r.totals.daily50, 120);
  assert.equal(r.totals.daily100, 60);
});
test('weekly overtime excludes daily overtime', () => {
  const r = calc(
    ['02', '03', '04', '05', '06', '07'].map((d) => make(`2026-11-${d}`, '08:00', '18:00')),
  );
  assert.equal(r.totals.minutes, 3600);
  assert.equal(r.totals.daily50, 720);
  assert.equal(r.totals.weekly50, 480);
  assert.equal(r.totals.regular, 2400);
  assert.equal(
    r.totals.regular + r.totals.daily50 + r.totals.daily100 + r.totals.weekly50,
    r.totals.minutes,
  );
});
test('week changes on Monday including year boundary', () => {
  assert.equal(weekKey('2027-01-03'), '2026-12-28');
  assert.equal(weekKey('2027-01-04'), '2027-01-04');
  const r = calc([make('2026-11-08'), make('2026-11-09')]);
  assert.equal(Object.keys(r.weeks).length, 2);
});
test('overnight Sunday and precise break are split at Helsinki midnight', () => {
  const entry = make('2026-11-07', '22:00', '23:00', {
    end: toInstant('2026-11-08T04:00'),
    breaks: [
      { start: toInstant('2026-11-08T00:00'), end: toInstant('2026-11-08T00:30'), paid: false },
    ],
  });
  const r = calc([entry]);
  assert.equal(r.totals.minutes, 330);
  assert.equal(r.totals.sunday, 210);
  assert.equal(r.days['2026-11-07'].minutes, 120);
});
test('summer time uses actual elapsed minutes; nonexistent and repeated wall times handled', () => {
  assert.equal(duration(toInstant('2026-03-29T00:00'), toInstant('2026-03-29T08:00')), 420);
  assert.throws(() => toInstant('2026-03-29T03:30'), /ei ole olemassa/);
  assert.equal(duration(toInstant('2026-10-25T03:30'), toInstant('2026-10-25T03:30', 'last')), 60);
});
test('invalid break amounts, negative intervals and overlapping breaks rejected', () => {
  assert.throws(() => validateEntry(make('2026-11-02', '16:00', '08:00')));
  assert.throws(() =>
    validateEntry(make('2026-11-02', '08:00', '09:00', { breaks: [{ minutes: 90, paid: false }] })),
  );
  assert.throws(() =>
    validateEntry(make('2026-11-02', '08:00', '09:00', { breaks: [{ minutes: -1, paid: false }] })),
  );
  assert.throws(() =>
    validateEntry(
      make('2026-11-02', '08:00', '16:00', {
        breaks: [
          { start: toInstant('2026-11-02T10:00'), end: toInstant('2026-11-02T11:00'), paid: false },
          { start: toInstant('2026-11-02T10:30'), end: toInstant('2026-11-02T11:30'), paid: true },
        ],
      }),
    ),
  );
});
test('missing work days are inferred off days without explicit entries', () => {
  const entries = ['26', '27', '28', '29', '30'].map((d) => make(`2026-10-${d}`));
  assert.equal(calc(entries).weeks['2026-10-26'].longestRest, 3360);
  assert.deepEqual(calc(entries).weeks['2026-10-26'].inferredOffDays, ['2026-10-31', '2026-11-01']);
  entries.push(
    { id: 'sat', kind: 'off', date: '2026-10-31' },
    { id: 'sun', kind: 'off', date: '2026-11-01' },
  );
  assert.equal(calc(entries).weeks['2026-10-26'].longestRest, 3360);
});
test('30 hour weekly rest warns with 14 day exception reference', () => {
  const entries = ['26', '27', '28', '29', '30', '31'].map((d) =>
    make(`2026-10-${d}`, '08:00', '18:00'),
  );
  entries.push({ id: 'sun', kind: 'off', date: '2026-11-01' });
  const r = calc(entries);
  assert.equal(r.weeks['2026-10-26'].longestRest, 1800);
  assert.ok(r.warnings.find((w) => w.code === 'weekly-rest' && w.sections.includes(28)));
});
test('daily rest checked in 24h window including long single shift', () => {
  const r = calc([make('2026-11-01', '06:00', '22:00')]);
  assert.ok(r.warnings.some((w) => w.code === 'daily-rest'));
});
test('overlap still warns; removed approval questions do not return as warnings', () => {
  const entries = [
    make('2026-11-01', '08:00', '19:00', { employerApproved: 'unknown' }),
    make('2026-11-01', '18:00', '20:00'),
  ];
  entries.forEach(validateEntry);
  const r = calc(entries);
  assert.ok(r.warnings.some((w) => w.code === 'overlap'));
  assert.ok(
    !r.warnings.some((w) => w.code === 'overtime-consent' || w.code === 'break-unconfirmed'),
  );
});
test('save, correction, delete, restore preserve original and calculation snapshots', () => {
  const original = make('2026-11-02');
  const first = applyOperation(null, op('save', { entries: [original] }));
  const second = applyOperation(
    first,
    op('save', {
      entries: [{ ...first.entries[original.id], end: toInstant('2026-11-02T19:00') }],
    }),
  );
  assert.equal(first.entries[original.id].end, original.end);
  assert.equal(Object.values(second.history)[0].calculation.totals.minutes, 480);
  const audit = Object.values(second.history).find((h) => h.revision === 2);
  assert.equal(audit.changes[0].before.end, original.end);
  assert.equal(audit.calculation.totals.minutes, 660);
  assert.equal(audit.ruleSnapshot.id, audit.calculation.rules.id);
  const deleted = applyOperation(
    second,
    op('save', { entries: [{ ...second.entries[original.id], deleted: true }] }),
  );
  assert.equal(Object.values(deleted.history).at(-1).calculation.totals.minutes, 0);
  const restored = applyOperation(
    deleted,
    op('save', { entries: [{ ...deleted.entries[original.id], deleted: false }] }),
  );
  assert.equal(Object.keys(restored.history).length, 4);
  assert.equal(restored.entries[original.id].revision, 4);
});
test('stale edits and simultaneous timer operations cannot overwrite newer data', () => {
  const entry = make('2026-11-02');
  const first = applyOperation(null, op('save', { entries: [entry] }));
  assert.throws(() => applyOperation(first, op('save', { entries: [entry] })), /toisessa/);
  const running = applyOperation(null, op('start'));
  assert.throws(() => applyOperation(running, op('start')), /jo käynnissä/);
  assert.throws(
    () => applyOperation(running, op('pause', { activeId: running.active.id, activeRevision: 0 })),
    /tila muuttui/,
  );
});
test('timer persists exact paid/unpaid pauses; stopping on break closes it once', () => {
  const started = applyOperation(null, op('start', { at: toInstant('2026-11-02T08:00') }));
  const paused = applyOperation(
    started,
    op('pause', {
      at: toInstant('2026-11-02T12:00'),
      activeId: started.active.id,
      activeRevision: 1,
      paid: false,
    }),
  );
  const stopped = applyOperation(
    paused,
    op('stop', {
      at: toInstant('2026-11-02T12:30'),
      activeId: paused.active.id,
      activeRevision: 2,
    }),
  );
  assert.equal(stopped.active, null);
  assert.equal(entryMinutes(Object.values(stopped.entries)[0]), 240);
  assert.equal(Object.values(stopped.entries)[0].breaks.length, 1);
});
test('batch is atomic if a copied entry is invalid', () => {
  assert.throws(() =>
    applyOperation(
      null,
      op('save', { entries: [make('2026-11-02'), make('2026-11-03', '19:00', '08:00')] }),
    ),
  );
});
test('editing only a note preserves exact timer and break seconds', () => {
  const entry = make('2026-11-02', '08:00', '16:00', {
    start: '2026-11-02T06:00:24.123Z',
    end: '2026-11-02T14:00:42.987Z',
    breakStatus: 'recorded',
    breaks: [{ start: '2026-11-02T10:00:12.345Z', end: '2026-11-02T10:30:56.789Z', paid: false }],
  });
  const edited = entryFrom({ ...formFrom(entry), note: 'Korjattu muistiinpano' });
  assert.equal(edited.start, entry.start);
  assert.equal(edited.end, entry.end);
  assert.deepEqual(edited.breaks, entry.breaks);
});
test('editing either repeated autumn hour retains its original occurrence', () => {
  for (const occurrence of ['first', 'last']) {
    const start = new Date(
      Date.parse(toInstant('2026-10-25T03:30', occurrence)) + 23456,
    ).toISOString();
    const entry = make('2026-10-25', '02:00', '08:00', { start });
    const form = formFrom(entry);
    assert.equal(form.startOccurrence, occurrence);
    assert.equal(entryFrom(form).start, start);
  }
});
test('no-break form needs no confirmation and added breaks are always saved', () => {
  const form = formFrom(make('2026-11-02', '08:00', '16:00', { breakStatus: 'unknown' }));
  assert.equal(entryFrom(form).breakStatus, 'assumed-taken');
  form.breaks.push({ minutes: 30, paid: false });
  const saved = entryFrom(form);
  assert.equal(saved.breakStatus, 'recorded');
  assert.equal(entryMinutes(saved), 450);
});
test('empty weeks are free and live shifts are not treated as weekly rest', () => {
  const entries = [make('2026-10-19')];
  const empty = calc(entries).weeks['2026-10-26'];
  assert.equal(empty.minutes, 0);
  assert.equal(empty.inferredOffDays.length, 7);
  assert.equal(empty.longestRest, 10080);
  const active = { start: toInstant('2026-11-01T23:00') };
  const r = calculate(entries, Date.parse(at), active);
  assert.equal(r.weeks['2026-10-26'].longestRest, null);
  assert.ok(!r.weeks['2026-10-26'].inferredOffDays.includes('2026-11-01'));
});
test('employee list defaults to self and grants distinguish viewing from writing', () => {
  const actor = { uid: 'me', name: 'Oma käyttäjä' },
    directory = { other: { name: 'Aino' } };
  assert.deepEqual(
    employeeOptions(directory, actor).map((p) => p.uid),
    ['me'],
  );
  assert.deepEqual(
    employeeOptions(directory, actor, { readAll: true }).map((p) => p.uid),
    ['me', 'other'],
  );
  assert.deepEqual(permissionsFor('me', 'other', { readAll: true }), {
    canRead: true,
    canWrite: false,
  });
  assert.deepEqual(permissionsFor('me', 'other', { writeAll: true }), {
    canRead: true,
    canWrite: true,
  });
  assert.deepEqual(permissionsFor(null, 'other', { writeAll: true }), {
    canRead: false,
    canWrite: false,
  });
});
test('recording for another employee retains both actor and subject and isolates data', () => {
  const own = applyOperation(null, op('save', { subject: 'me', entries: [make('2026-11-02')] }));
  const other = applyOperation(
    null,
    op('save', { subject: 'other', entries: [make('2026-11-03')] }),
  );
  const audit = Object.values(other.history)[0];
  assert.equal(audit.actor, 'test-user');
  assert.equal(audit.subject, 'other');
  assert.equal(Object.values(own.entries)[0].start, toInstant('2026-11-02T08:00'));
  assert.notEqual(RULES.id, RULES_V1.id);
  assert.equal(RULES.missingDayPolicy, 'off');
});
test('assumed breaks produce no warnings or invented deductions in new entries', () => {
  const entry = entryFrom({
    ...formFrom(make('2026-11-02', '08:00', '19:00')),
    breakPolicy: 'assumed-taken',
  });
  assert.equal(entryMinutes(entry), 660);
  assert.equal(entry.breakPolicy, 'assumed-taken');
  assert.ok(!calc([entry]).warnings.some((w) => w.code.startsWith('break')));
  const started = applyOperation(null, op('start', { at: toInstant('2026-11-02T08:00') }));
  const stopped = applyOperation(
    started,
    op('stop', {
      at: toInstant('2026-11-02T19:00'),
      activeId: started.active.id,
      activeRevision: 1,
    }),
  );
  assert.equal(Object.values(stopped.entries)[0].breakStatus, 'assumed-taken');
  assert.equal(entryMinutes(Object.values(stopped.entries)[0]), 660);
});
