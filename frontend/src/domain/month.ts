import { addDays, validDay } from './calendar.ts';
export const weekdays = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];
export function monthStart(day: string) {
  if (!validDay(day)) throw Error('Virheellinen päivä');
  return day.slice(0, 7) + '-01';
}
export function shiftMonth(day: string, count: number) {
  const d = new Date(monthStart(day) + 'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + count);
  return d.toISOString().slice(0, 10);
}
export function monthDays(day: string) {
  const first = monthStart(day);
  const offset = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, n) => addDays(start, n));
}
export function monthTitle(day: string) {
  return new Intl.DateTimeFormat('fi-FI', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(monthStart(day) + 'T12:00:00Z'));
}
