import { active, type State, type Product, type Trip } from './model.ts';
export function today() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki' }).format(new Date());
}
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
  );
}
export function dayNumber(day: string) {
  if (!validDay(day)) throw Error('Päivämäärä ei ole kelvollinen.');
  return Date.parse(day) / 86400000;
}
export function addDays(day: string, n: number) {
  return new Date((dayNumber(day) + n) * 86400000).toISOString().slice(0, 10);
}
export function days(start: string, end: string) {
  const a = dayNumber(start),
    b = dayNumber(end);
  if (b < a || b - a > 3660)
    throw Error('Valitse aikaväli, jonka loppu on alun jälkeen (enintään 10 vuotta).');
  return Array.from({ length: b - a + 1 }, (_, i) => addDays(start, i));
}
export const formatDay = (day: string) =>
  validDay(day)
    ? new Intl.DateTimeFormat('fi-FI', { day: 'numeric', month: 'numeric' }).format(
        new Date(day + 'T12:00:00Z'),
      )
    : 'Päivä tarkistettava';
export function capacity(p: Product) {
  return p.retired || p.review
    ? 0
    : p.tracking === 'serial'
      ? Object.values(p.units).filter((u) => u.condition === 'ready').length
      : Math.max(0, p.total - p.maintenance);
}
export function demand(t: Trip, productId: string, day: string, now: string) {
  if (!active(t)) return 0;
  const rows = t.items.filter((i) => i.productId === productId && i.type === 'inventory');
  const planned = rows.reduce((s, i) => s + i.quantity, 0);
  const outstanding = rows.reduce((s, i) => s + Math.max(0, i.packed - i.returned), 0);
  if (!validDay(t.start) || !validDay(t.end)) return Math.max(planned, outstanding);
  if (day >= t.start && day <= t.end) return Math.max(planned, outstanding);
  // Only an actually overdue, unreturned loan blocks subsequent dates.
  // A planned Monday loan must not block a Tuesday reservation made in advance.
  if (t.end < now && day >= now) return outstanding;
  return 0;
}
export function availability(
  s: State,
  productId: string,
  start: string,
  end: string,
  exclude = '',
  now = today(),
) {
  const p = s.products[productId];
  if (!p) throw Error('Tuotetta ei löydy.');
  const dates = days(start, end);
  let peak = 0;
  const conflicts = new Set<string>();
  for (const d of dates) {
    let used = 0;
    for (const b of Object.values(s.bundles ?? {})) {
      if (b.closed) continue;
      const members = b.tripIds.map((id) => s.trips[id]).filter(Boolean);
      const first = members.map((t) => t.start).sort()[0];
      const end = b.tripIds
        .map((id) => s.trips[id]?.end ?? '')
        .sort()
        .at(-1);
      if (end && first && ((d >= first && d <= end) || (end < now && d >= now))) {
        const unfilled = members
          .filter((t) => active(t) && d >= t.start && d <= t.end)
          .reduce((n, t) => {
            const rows = t.items.filter((i) => i.type === 'inventory' && i.productId === productId);
            return (
              n +
              Math.max(
                0,
                rows.reduce((v, i) => v + i.quantity, 0) -
                  rows.reduce((v, i) => v + i.packed - i.returned, 0),
              )
            );
          }, 0);
        used += Math.max(0, (b.holding[productId]?.quantity ?? 0) - unfilled);
      }
    }
    for (const t of Object.values(s.trips)) {
      if (t.id === exclude) continue;
      const n = demand(t, productId, d, now);
      used += n;
      if (n) conflicts.add(t.id);
    }
    peak = Math.max(peak, used);
  }
  const total = capacity(p);
  return { capacity: total, reserved: peak, available: total - peak, conflicts: [...conflicts] };
}
