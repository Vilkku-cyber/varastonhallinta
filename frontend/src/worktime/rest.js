import { addDays, dateKey, toInstant, weekKey } from './engine.js';

const MIN = 60000;
const instant = (date) => Date.parse(toInstant(`${date}T00:00`));
function merge(intervals) {
  const result = [];
  for (const [start, end] of intervals.sort((a, b) => a[0] - b[0])) {
    if (end <= start) continue;
    if (result.length && start <= result.at(-1)[1])
      result.at(-1)[1] = Math.max(end, result.at(-1)[1]);
    else result.push([start, end]);
  }
  return result;
}
function gaps(intervals, from, to) {
  let cursor = from;
  const result = [];
  for (const [start, end] of intervals) {
    if (end <= from || start >= to) continue;
    if (start > cursor) result.push([cursor, Math.min(start, to)]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < to) result.push([cursor, to]);
  return result;
}
function workIntervals(entry, now) {
  const end = Math.min(now, Date.parse(entry.end));
  let cursor = Date.parse(entry.start);
  const result = [];
  for (const b of (entry.breaks || [])
    .filter((b) => !b.paid && b.start)
    .sort((a, b) => a.start.localeCompare(b.start))) {
    const from = Math.max(cursor, Date.parse(b.start)),
      to = Math.min(end, Date.parse(b.end));
    if (to <= from) continue;
    if (from > cursor) result.push([cursor, from]);
    cursor = to;
  }
  if (cursor < end) result.push([cursor, end]);
  return result;
}
const longest = (intervals, from, to) =>
  Math.max(0, ...gaps(intervals, from, to).map(([a, b]) => (b - a) / MIN));
function monthsAfter(date, months) {
  const d = new Date(`${date}T12:00Z`),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

// Observations are recomputed from source times. Reviews never alter worked hours.
// Crediting requires an explicit continuous interval; an empty calendar day is not a receipt.
export function calculateRest(
  entries,
  now = Date.now(),
  active = null,
  records = {},
  settings = {},
  weeklyReserved = null,
) {
  const work = entries.filter((e) => !e.deleted && e.kind !== 'off' && Date.parse(e.start) < now);
  const intervals = merge([
    ...work.flatMap((e) => workIntervals(e, now)),
    ...(active && Date.parse(active.start) < now ? [[Date.parse(active.start), now]] : []),
  ]);
  const debts = [],
    weeks = [],
    pairs = [];
  const weeklyIntervals = merge([...intervals.map((i) => [...i]), ...(weeklyReserved || [])]);
  // Multiple pieces of one day's shift must not create the same obligation twice.
  const anchors = new Map();
  const starts = work.flatMap((e) => {
    const result = [];
    for (
      let start = Date.parse(e.start);
      start < Math.min(now, Date.parse(e.end));
      start += 1440 * MIN
    )
      result.push(start);
    return result;
  });
  if (active && Date.parse(active.start) < now) {
    for (let start = Date.parse(active.start); start < now; start += 1440 * MIN) starts.push(start);
  }
  for (const start of starts.sort((a, b) => a - b))
    if (!anchors.has(dateKey(start))) anchors.set(dateKey(start), start);
  for (const [date, start] of anchors) {
    const end = start + 1440 * MIN;
    if (end > now) continue;
    const rest = longest(intervals, start, end);
    if (rest < 660)
      debts.push({
        id: `daily-${start}`,
        type: 'daily',
        date,
        start,
        end,
        observed: rest,
        minutes: 660 - rest,
        deadline: addDays(date, 14),
        minimumMet: rest >= 300,
      });
  }
  const beginning = settings.startDate || (intervals[0] && dateKey(intervals[0][0]));
  if (beginning) {
    for (let date = weekKey(beginning); instant(date) < now; date = addDays(date, 7)) {
      const end = instant(addDays(date, 7));
      const complete = end <= now && date >= beginning;
      weeks.push({
        date,
        start: instant(date),
        end,
        complete,
        rest: longest(weeklyIntervals, instant(date), Math.min(end, now)),
      });
    }
    for (let i = 0; i < weeks.length; i += 2) {
      const a = weeks[i],
        b = weeks[i + 1];
      const complete = a.complete && !!b?.complete;
      const valid = complete && a.rest >= 1440 && b.rest >= 1440 && a.rest + b.rest >= 4200;
      pairs.push({
        date: a.date,
        endDate: addDays(a.date, 13),
        first: a.rest,
        second: b?.rest ?? null,
        complete,
        valid,
      });
      if (!complete || valid) continue;
      // Each affected week remains an observation until §28 grounds and the actual
      // working time during the weekly rest are confirmed. Never assume 35h-rest is payable.
      for (const w of [a, b])
        if (w.rest < 2100)
          debts.push({
            id: `weekly-${w.date}`,
            type: 'weekly',
            date: w.date,
            start: w.start,
            end: w.end,
            observed: w.rest,
            minutes: Math.max(0, 2100 - w.rest),
            deadline: monthsAfter(w.date, 3),
            minimumMet: w.rest >= 1440,
          });
    }
    for (const w of weeks.filter((w) => w.complete && w.rest < 1440)) {
      if (!debts.some((d) => d.id === `weekly-${w.date}`))
        debts.push({
          id: `weekly-${w.date}`,
          type: 'weekly',
          date: w.date,
          start: w.start,
          end: w.end,
          observed: w.rest,
          minutes: 2100 - w.rest,
          deadline: monthsAfter(w.date, 3),
          minimumMet: false,
        });
    }
  }
  const allocations = Object.values(records.allocations || {}).sort(
    (a, b) =>
      Number(b.debtId.startsWith('daily-')) - Number(a.debtId.startsWith('daily-')) ||
      a.at.localeCompare(b.at),
  );
  const usedIntervals = [];
  const dailyReplacementIntervals = [];
  const invalidAllocations = [];
  for (const debt of debts) {
    let consecutive = 1;
    if (debt.type === 'daily') {
      let previous = addDays(debt.date, -1);
      while (debts.some((d) => d.type === 'daily' && d.date === previous)) {
        consecutive++;
        previous = addDays(previous, -1);
      }
    }
    debt.exceptionEligible = debt.type === 'weekly' || (debt.minimumMet && consecutive <= 3);
    debt.review = records.reviews?.[debt.id] || {};
    debt.confirmed =
      debt.review.confirmed === true &&
      debt.review.basis === (debt.type === 'daily' ? 'continuity25' : 'exception28') &&
      !!debt.review.reason?.trim() &&
      debt.exceptionEligible &&
      (debt.type !== 'weekly' || (Number.isFinite(debt.review.minutes) && debt.review.minutes > 0));
    debt.required = debt.type === 'weekly' && debt.confirmed ? debt.review.minutes : debt.minutes;
    debt.repaid = 0;
    debt.receipts = [];
  }
  for (const allocation of allocations) {
    const debt = debts.find((d) => d.id === allocation.debtId);
    const start = Date.parse(allocation.start),
      end = Date.parse(allocation.end);
    const minutes = Number(allocation.minutes);
    // Reserve ordinary rest separately. For weekly replacement reserve 35h.
    // For a daily replacement interval >=35h reserve all 35h to avoid consuming weekly rest.
    const baseline = debt?.type === 'weekly' || end - start >= 2100 * MIN ? 2100 : 660;
    const prior = usedIntervals
      .filter((x) => start < x.end && end > x.start)
      .reduce((sum, x) => sum + x.minutes, 0);
    const gap = gaps(intervals, intervals[0]?.[0] ?? now, now).find(
      ([a, b]) => start >= a && end <= b,
    );
    const nextGap = debt && gaps(intervals, debt.end, now).find(([a, b]) => b - a >= 660 * MIN);
    const deferred = nextGap && start > nextGap[1];
    const valid =
      debt?.confirmed &&
      gap &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end <= now &&
      start >= debt.end &&
      end > start &&
      dateKey(end - 1) <= debt.deadline &&
      Number.isFinite(minutes) &&
      minutes > 0 &&
      minutes <= debt.required - debt.repaid &&
      (end - start) / MIN >= baseline + prior + minutes &&
      (!deferred || debt.review.deferralReason?.trim());
    if (valid) {
      debt.repaid += minutes;
      debt.receipts.push(allocation);
      usedIntervals.push({ start, end, minutes });
      // A daily replacement is additional to normal weekly rest. Reserve its
      // actual tail segment so a 35h gap cannot also repay daily-rest deficits.
      if (debt.type === 'daily')
        dailyReplacementIntervals.push([end - (prior + minutes) * MIN, end - prior * MIN]);
    } else invalidAllocations.push(allocation);
  }
  if (weeklyReserved === null && dailyReplacementIntervals.length)
    return calculateRest(entries, now, active, records, settings, dailyReplacementIntervals);
  for (const debt of debts) {
    debt.remaining = Math.max(0, debt.required - debt.repaid);
    debt.overdue = debt.remaining > 0 && dateKey(now) > debt.deadline;
  }
  return {
    debts,
    pairs,
    weeks,
    invalidAllocations,
    observed: debts.filter((d) => !d.confirmed).reduce((s, d) => s + d.remaining, 0),
    observedDaily: debts
      .filter((d) => !d.confirmed && d.type === 'daily')
      .reduce((s, d) => s + d.remaining, 0),
    observedWeekly: debts
      .filter((d) => !d.confirmed && d.type === 'weekly')
      .reduce((s, d) => s + d.remaining, 0),
    remaining: debts.filter((d) => d.confirmed).reduce((s, d) => s + d.remaining, 0),
    repaid: debts.reduce((s, d) => s + d.repaid, 0),
    gaps: gaps(intervals, intervals[0]?.[0] ?? now, now)
      .filter(([a, b]) => b - a > 660 * MIN)
      .map(([start, end]) => ({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        minutes: (end - start) / MIN,
      })),
  };
}

export function validateRestOperation(state, operation) {
  if (
    [operation.review, operation.allocation, operation.removeAllocation].filter(Boolean).length !==
    1
  )
    throw new Error('Valitse yksi lepojen tallennustoiminto.');
  if (operation.removeAllocation && !state.rest?.allocations?.[operation.removeAllocation])
    throw new Error('Kohdistus on jo poistettu tai muuttunut.');
  const entries = Object.values(state.entries || {});
  const report = calculateRest(
    entries,
    Date.parse(operation.at),
    state.active,
    state.rest,
    state.settings,
  );
  if (operation.review) {
    const debt = report.debts.find((d) => d.id === operation.debtId);
    if (!debt) throw new Error('Lepovaje muuttui. Avaa tuore laskenta.');
    const r = operation.review;
    if (r.minutes != null && (!Number.isFinite(r.minutes) || r.minutes < 0))
      throw new Error('Anna kelvollinen korvausaika.');
    if (
      r.confirmed &&
      (!r.reason?.trim() ||
        r.basis !== (debt.type === 'daily' ? 'continuity25' : 'exception28') ||
        !debt.exceptionEligible)
    )
      throw new Error(
        'Tarkista poikkeuksen peruste: tässä seurannassa vuorokausilepo on vähintään 5 h ja lyhennyksiä enintään kolme peräkkäin.',
      );
    if (
      r.confirmed &&
      debt.type === 'weekly' &&
      (!Number.isFinite(r.minutes) || r.minutes <= 0 || r.minutes > 10080)
    )
      throw new Error('Kirjaa viikkolevon aikana tehtyä työtä vastaava korvaus minuutteina.');
  }
  if (operation.allocation) {
    const candidate = { ...operation.allocation, at: operation.at, debtId: operation.debtId };
    const trial = structuredClone(state.rest || {});
    trial.allocations = { ...trial.allocations, [operation.id]: candidate };
    const checked = calculateRest(
      entries,
      Date.parse(operation.at),
      state.active,
      trial,
      state.settings,
    );
    if (
      checked.invalidAllocations.includes(candidate) ||
      checked.invalidAllocations.some(
        (a) => a === candidate || (a.at === candidate.at && a.debtId === candidate.debtId),
      )
    )
      throw new Error(
        'Tarkista lepojakso: sen pitää olla toteutunut, yhtenäinen, määräajassa ja riittää normaalin levon sekä kaikkien kohdistusten lisäksi. Myöhempi korvaus edellyttää siirtoperustetta.',
      );
  }
}
