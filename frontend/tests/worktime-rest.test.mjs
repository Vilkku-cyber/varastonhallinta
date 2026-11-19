import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRest } from '../src/worktime/rest.js';
import {
  toInstant,
  settleBalance,
  entryMinutes,
  validateEntry,
  calculate,
} from '../src/worktime/engine.js';
import { premiumDay } from '../src/worktime/holidays.js';
import { entryFrom, formFrom, freshForm } from '../src/worktime/forms.js';
import { applyOperation } from '../src/worktime/state.js';
import { RULES, RULES_V4 } from '../src/worktime/rules.js';

const at = (s) => toInstant(s);
const now = Date.parse(at('2026-11-19T06:20'));
const work = (start, end, id = start) => ({
  id,
  kind: 'work',
  start: at(start),
  end: at(end),
  breaks: [],
});
const shifts = [
  work('2026-11-16T08:00', '2026-11-16T22:22'),
  work('2026-11-17T08:00', '2026-11-17T22:58'),
  work('2026-11-18T08:00', '2026-11-18T16:00'),
];
const report = (rest = {}, entries = shifts, clock = now) =>
  calculateRest(entries, clock, null, rest);
function reviewed() {
  return {
    reviews: Object.fromEntries(
      report().debts.map((d) => [
        d.id,
        {
          confirmed: true,
          basis: 'continuity25',
          reason: 'Välttämätön toiminnan jatkuvuuden turvaaminen',
        },
      ]),
    ),
    allocations: {},
  };
}
const allocation = (debt, minutes, end = '2026-11-19T06:20') => ({
  debtId: debt.id,
  start: at('2026-11-18T16:00'),
  end: at(end),
  minutes,
  at: new Date(now).toISOString(),
});
const op = (payload) => ({
  type: 'rest',
  id: crypto.randomUUID(),
  actor: 'a',
  at: new Date(now).toISOString(),
  expectedRevision: 0,
  ...payload,
});

test('daily 24h windows reproduce 82 + 118 min and the two calendar deadlines without hardcoded dates', () => {
  const r = report();
  assert.deepEqual(
    r.debts.map((d) => d.minutes),
    [82, 118],
  );
  assert.deepEqual(
    r.debts.map((d) => d.deadline),
    ['2026-11-30', '2026-12-01'],
  );
  assert.equal(r.observed, 200);
  assert.equal(r.remaining, 0);
  assert.equal(r.repaid, 0);
});
test('a free day alone cannot repay rest; confirmation plus actual 14h20 repays two deficits once', () => {
  const rest = reviewed(),
    debts = report(rest).debts;
  assert.equal(report(rest).remaining, 200);
  rest.allocations.one = allocation(debts[0], 82);
  rest.allocations.two = allocation(debts[1], 118);
  const r = report(rest);
  assert.equal(r.repaid, 200);
  assert.equal(r.remaining, 0);
  assert.equal(r.invalidAllocations.length, 0);
  rest.allocations.three = { ...allocation(debts[1], 118), at: '2026-11-19T05:00:00Z' };
  assert.equal(report(rest).repaid, 200);
  assert.equal(report(rest).invalidAllocations.length, 1);
});
test('normal 11h is reserved, missing grounds, future rest and work inside a receipt cannot repay', () => {
  const rest = reviewed(),
    debt = report(rest).debts[0];
  for (const end of ['2026-11-19T03:00', '2026-11-19T07:00']) {
    rest.allocations.one = allocation(debt, 82, end);
    assert.equal(report(rest).repaid, 0);
  }
  rest.allocations.one = allocation(debt, 82);
  assert.equal(report({ ...rest, reviews: {} }).repaid, 0);
  assert.equal(report(rest, [...shifts, work('2026-11-19T01:00', '2026-11-19T02:00')]).repaid, 0);
});
test('only actually held and not deferred without grounds intervals can replace daily rest', () => {
  const rest = reviewed(),
    debt = report(rest).debts[0];
  const later = work('2026-11-19T08:00', '2026-11-19T16:00');
  rest.allocations.one = {
    ...allocation(debt, 82),
    start: at('2026-11-19T16:00'),
    end: at('2026-11-20T06:00'),
  };
  const clock = Date.parse(at('2026-11-20T06:00'));
  assert.equal(report(rest, [...shifts, later], clock).repaid, 0);
  rest.reviews[debt.id].deferralReason = 'Painava työn järjestelyihin liittyvä syy tarkistettu';
  assert.equal(report(rest, [...shifts, later], clock).repaid, 82);
});
test('receipts after 14 calendar days are not counted and debt remains overdue', () => {
  const rest = reviewed(),
    debt = report(rest).debts[0];
  rest.allocations.one = {
    ...allocation(debt, 82),
    start: at('2026-12-01T16:00'),
    end: at('2026-12-02T06:00'),
  };
  rest.reviews[debt.id].deferralReason = 'Painava peruste';
  const r = report(rest, shifts, Date.parse(at('2026-12-02T08:00')));
  assert.equal(r.debts.find((d) => d.id === debt.id).repaid, 0);
  assert.equal(r.debts.find((d) => d.id === debt.id).overdue, true);
});
test('less than 5h and fourth consecutive shortened daily rest cannot be confirmed in continuity exception', () => {
  const entries = ['16', '17', '18', '19'].map((d) =>
    work(`2026-11-${d}T08:00`, `2026-11-${d}T22:00`),
  );
  const r = report({}, entries, Date.parse(at('2026-11-20T12:00')));
  assert.deepEqual(
    r.debts.filter((d) => d.type === 'daily').map((d) => d.exceptionEligible),
    [true, true, true, false],
  );
  const tooLong = report({}, [work('2026-11-16T08:00', '2026-11-17T05:00')]);
  assert.equal(tooLong.debts[0].exceptionEligible, false);
});
test('split entries create one daily observation and active timer prevents false free rest', () => {
  const entries = [
    work('2026-11-16T08:00', '2026-11-16T12:00'),
    work('2026-11-16T13:00', '2026-11-16T22:22'),
    shifts[1],
  ];
  assert.equal(report({}, entries).debts.filter((d) => d.date === '2026-11-16').length, 1);
  const r = calculateRest([shifts[0]], now, { start: at('2026-11-17T08:00') });
  assert.equal(r.gaps.length, 0);
  assert.ok(r.debts.length >= 2);
});
// Continuous work around an explicit weekly gap makes the 7-day observations unambiguous.
function fortnight(firstHours, secondHours) {
  return [
    work('2026-11-02T00:00', '2026-11-03T00:00'),
    work(
      `2026-11-${String(3 + Math.floor(firstHours / 24)).padStart(2, '0')}T${String(firstHours % 24).padStart(2, '0')}:00`,
      '2026-11-10T00:00',
    ),
    work(
      `2026-11-${String(10 + Math.floor(secondHours / 24)).padStart(2, '0')}T${String(secondHours % 24).padStart(2, '0')}:00`,
      '2026-11-16T00:00',
    ),
  ];
}
test('14 day weekly rest accepts 24+46, rejects 24+45 and 23+47, and does not settle a future week', () => {
  const clock = Date.parse(at('2026-11-16T00:00'));
  for (const [a, b, valid] of [
    [24, 46, true],
    [24, 45, false],
    [23, 47, false],
  ]) {
    const r = calculateRest(fortnight(a, b), clock);
    assert.equal(r.pairs[0].first, a * 60);
    assert.equal(r.pairs[0].second, b * 60);
    assert.equal(r.pairs[0].valid, valid);
  }
  assert.equal(
    calculateRest(fortnight(24, 46), Date.parse(at('2026-11-12T12:00'))).pairs[0].complete,
    false,
  );
});
test('rest review and allocations are revision protected and audited, invalid allocation is rejected', () => {
  const state = { entries: Object.fromEntries(shifts.map((e) => [e.id, e])), revision: 0 };
  const debt = report().debts[0];
  const review = reviewed().reviews[debt.id];
  const reviewedState = applyOperation(state, op({ debtId: debt.id, review }));
  assert.equal(reviewedState.revision, 1);
  assert.equal(Object.values(reviewedState.history)[0].restBefore, null);
  assert.equal(Object.values(reviewedState.history)[0].restCalculation.remaining, 82);
  assert.throws(() => applyOperation(reviewedState, op({ debtId: debt.id, review })), /muuttuivat/);
  assert.throws(
    () =>
      applyOperation(
        reviewedState,
        op({
          expectedRevision: 1,
          debtId: debt.id,
          allocation: allocation(debt, 82, '2026-11-19T03:00'),
        }),
      ),
    /Tarkista lepojakso/,
  );
  const saved = applyOperation(
    reviewedState,
    op({ expectedRevision: 1, debtId: debt.id, allocation: allocation(debt, 82) }),
  );
  assert.equal(Object.values(saved.history).at(-1).restCalculation.repaid, 82);
});
test('meal at work never deducts time, actual meal deducts once through repeated edits and copying', () => {
  const form = {
    ...freshForm(),
    start: '2026-11-16T08:00',
    end: '2026-11-16T19:00',
    mealMinutes: 30,
  };
  assert.equal(entryMinutes(entryFrom(form)), 660);
  const entry = entryFrom({ ...form, meal: 'duty-free' });
  validateEntry(entry);
  assert.equal(entryMinutes(entry), 630);
  assert.equal(entryMinutes(entryFrom(formFrom(entry))), 630);
  assert.equal(entryMinutes(entryFrom({ ...formFrom(entry), meal: 'with-work' })), 660);
  assert.throws(
    () => validateEntry(entryFrom({ ...form, meal: 'duty-free', mealMinutes: -1 })),
    /ruokatauon/,
  );
});
test('timer meal choice preserves exact entered time and source history', () => {
  const started = applyOperation(null, {
    type: 'start',
    id: 'timer',
    actor: 'me',
    at: at('2026-11-16T08:00'),
  });
  const stopped = applyOperation(started, {
    type: 'stop',
    id: 'stop',
    actor: 'me',
    at: at('2026-11-16T16:00'),
    activeId: 'timer',
    activeRevision: 1,
    meal: 'duty-free',
    mealMinutes: 30,
  });
  assert.equal(entryMinutes(stopped.entries.timer), 450);
  assert.equal(stopped.entries.timer.start, at('2026-11-16T08:00'));
  assert.equal(stopped.history.stop.ruleSnapshot.compensation, 'time-off');
});
test('Sunday and national holiday premiums enter balance once, add to overtime and exclude future work', () => {
  const e = work('2026-12-06T08:00', '2026-12-06T19:00');
  const settings = {
    startDate: '2026-12-06',
    workDays: [1, 2, 3, 4, 5],
    weeklyMinutes: 2400,
    openingMinutes: 0,
  };
  const b = settleBalance([e], Date.parse(at('2026-12-06T20:00')), null, settings);
  assert.equal(b.actual, 660);
  assert.equal(b.premium, 780);
  assert.equal(b.balance, 1440);
  assert.equal(calculate([e], Date.parse(at('2026-12-06T20:00'))).totals.sunday, 660);
  assert.equal(settleBalance([e], Date.parse(at('2026-12-06T07:00')), null, settings).balance, 0);
  const roundTrip = entryFrom(formFrom(e));
  assert.equal(entryMinutes(roundTrip), 660);
});
test('public holidays cover fixed, movable and Saturday holidays without treating eves as premium days', () => {
  for (const date of [
    '2026-01-01',
    '2026-01-06',
    '2026-04-03',
    '2026-04-06',
    '2026-05-01',
    '2026-05-14',
    '2026-06-20',
    '2026-10-31',
    '2026-12-25',
    '2026-12-26',
  ])
    assert.equal(premiumDay(date), true, date);
  for (const date of ['2026-04-02', '2026-06-19', '2026-12-24', '2026-11-02'])
    assert.equal(premiumDay(date), false, date);
  assert.equal(RULES_V4.id, 'fi-general-2026-11-13-v4');
  assert.notEqual(RULES.id, RULES_V4.id);
});

test('daily replacement cannot simultaneously count towards the 24h weekly minimum', () => {
  const rest = reviewed(),
    debt = report(rest).debts[0];
  rest.allocations.one = allocation(debt, 82);
  const entries = [...shifts, work('2026-11-20T03:00', '2026-11-23T00:00')];
  const clock = Date.parse(at('2026-11-23T00:00'));
  const before = calculateRest(entries, clock);
  const after = calculateRest(entries, clock, null, rest);
  assert.equal(before.weeks[0].rest, 2100);
  assert.ok(after.weeks[0].rest < 1440);
  assert.ok(after.debts.some((d) => d.type === 'weekly' && !d.minimumMet));
  assert.equal(after.repaid, 82);
});

test('weekly deviation remains unconfirmed until the actual replacement amount is entered', () => {
  const entries = fortnight(23, 47),
    clock = Date.parse(at('2026-11-16T00:00'));
  const debt = calculateRest(entries, clock).debts.find((d) => d.type === 'weekly');
  const state = { entries: Object.fromEntries(entries.map((e) => [e.id, e])), revision: 0 };
  const review = {
    confirmed: true,
    basis: 'exception28',
    reason: 'Välttämätön jatkuvuustyö',
    minutes: 60,
  };
  const operation = { ...op({ debtId: debt.id, review }), at: new Date(clock).toISOString() };
  assert.throws(
    () => applyOperation(state, { ...operation, review: { ...review, minutes: 0 } }),
    /viikkolevon aikana/,
  );
  const updated = applyOperation(state, operation);
  const result = calculateRest(entries, clock, null, updated.rest);
  assert.equal(result.debts.find((d) => d.id === debt.id).required, 60);
  assert.equal(result.debts.find((d) => d.id === debt.id).confirmed, true);
  assert.equal(result.debts.find((d) => d.id === debt.id).deadline, '2027-02-02');
});
