// Finnish statutory Sunday/public-holiday premium. A holiday on Sunday counts once.
export function premiumDay(date) {
  const year = Number(date.slice(0, 4));
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100;
  const d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = Date.UTC(year, month - 1, day, 12);
  const movable = [-2, 1, 39, 49].map((n) =>
    new Date(easter + n * 86400000).toISOString().slice(0, 10),
  );
  const weekday = new Date(`${date}T12:00Z`).getUTCDay();
  return (
    weekday === 0 ||
    ['01-01', '01-06', '05-01', '12-06', '12-25', '12-26'].includes(date.slice(5)) ||
    movable.includes(date) ||
    (weekday === 6 &&
      ((date.slice(5) >= '06-20' && date.slice(5) <= '06-26') ||
        (date.slice(5) >= '10-31' && date.slice(5) <= '11-06')))
  );
}
