import { dateKey, localTime, toInstant } from './engine.js';

export const freshForm = () => ({
  kind: 'work',
  date: dateKey(),
  start: `${dateKey()}T08:00`,
  end: `${dateKey()}T16:00`,
  breaks: [],
  meal: 'with-work',
  mealMinutes: 30,
  breakPolicy: 'assumed-taken',
  employerApproved: 'unknown',
  employeeConsent: 'unknown',
  note: '',
});
const minuteStamp = (value) => Math.floor(Date.parse(value) / 60000) * 60000;
function occurrenceFor(value) {
  return value && Date.parse(toInstant(localTime(value))) !== minuteStamp(value) ? 'last' : 'first';
}
function fromInput(value, occurrence, original) {
  const resolved = toInstant(value, occurrence);
  // A note-only correction must not round the timer's original seconds.
  return original && Date.parse(resolved) === minuteStamp(original) ? original : resolved;
}
export function formFrom(entry) {
  return {
    ...entry,
    date: entry.date || dateKey(entry.start),
    start: entry.start ? localTime(entry.start) : '',
    end: entry.end ? localTime(entry.end) : '',
    originalStart: entry.start || null,
    originalEnd: entry.end || null,
    startOccurrence: occurrenceFor(entry.start),
    endOccurrence: occurrenceFor(entry.end),
    meal: entry.meal || 'legacy',
    mealMinutes: entry.meal === 'duty-free' ? entry.mealMinutes : 30,
    breaks: (entry.breaks || [])
      .filter((b) => b.source !== 'meal')
      .map((b) => ({
        ...b,
        ...(b.start
          ? {
              start: localTime(b.start),
              end: localTime(b.end),
              originalStart: b.start,
              originalEnd: b.end,
              startOccurrence: occurrenceFor(b.start),
              endOccurrence: occurrenceFor(b.end),
            }
          : {}),
      })),
  };
}
export function entryFrom(form, id = form.id || crypto.randomUUID()) {
  const base = {
    id,
    kind: form.kind,
    date: form.date,
    note: form.note || '',
    revision: form.revision || 0,
    deleted: false,
  };
  if (form.kind === 'off') return base;
  return {
    ...base,
    start: fromInput(form.start, form.startOccurrence, form.originalStart),
    end: fromInput(form.end, form.endOccurrence, form.originalEnd),
    breakPolicy:
      form.meal === 'duty-free'
        ? 'recorded'
        : form.breakPolicy || (form.breaks.length ? 'recorded' : 'assumed-taken'),
    breakStatus: form.breaks.length || form.meal === 'duty-free' ? 'recorded' : 'assumed-taken',
    employerApproved: form.employerApproved || 'unknown',
    employeeConsent: form.employeeConsent || 'unknown',
    meal: form.meal || 'legacy',
    mealMinutes: form.meal === 'duty-free' ? Number(form.mealMinutes) : 0,
    breaks: [
      ...form.breaks.map((b) =>
        b.start
          ? {
              start: fromInput(b.start, b.startOccurrence, b.originalStart),
              end: fromInput(b.end, b.endOccurrence, b.originalEnd),
              paid: b.paid,
            }
          : { minutes: Number(b.minutes), paid: b.paid },
      ),
      ...(form.meal === 'duty-free'
        ? [{ minutes: Number(form.mealMinutes), paid: false, source: 'meal' }]
        : []),
    ],
  };
}
