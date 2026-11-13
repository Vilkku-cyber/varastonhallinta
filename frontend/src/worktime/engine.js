import { RULES } from './rules.js';

const MINUTE = 60000;
const partsFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: RULES.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
export function localTime(value = Date.now()) {
  return partsFormatter.format(new Date(value)).replace(' ', 'T');
}
export const dateKey = (value) => localTime(value).slice(0, 10);
export function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function weekKey(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -(day + 6) % 7);
}
// Resolve wall-clock inputs in Helsinki, including DST. Ambiguous autumn times
// require an explicit occurrence; nonexistent spring times cannot be recorded.
export function toInstant(local, occurrence = 'first') {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error('Anna päivämäärä ja kellonaika.');
  const wall = Date.parse(`${local}:00Z`);
  const candidates = [120, 180]
    .map((offset) => wall - offset * MINUTE)
    .filter((value) => localTime(value) === local)
    .sort((a, b) => a - b);
  if (!candidates.length)
    throw new Error('Kellonaikaa ei ole olemassa Suomen kesäaikasiirtymän vuoksi.');
  return new Date(occurrence === 'last' ? candidates.at(-1) : candidates[0]).toISOString();
}
export function duration(start, end) {
  return (Date.parse(end) - Date.parse(start)) / MINUTE;
}
export function formatMinutes(value = 0) {
  const rounded = Math.round(value * 10) / 10;
  const hours = Math.floor(rounded / 60),
    minutes = Math.round((rounded % 60) * 10) / 10;
  return [
    hours ? `${hours} h` : '',
    minutes || !hours ? `${String(minutes).replace('.', ',')} min` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
export function validateEntry(entry) {
  if (entry.kind === 'off') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || addDays(entry.date, 0) !== entry.date)
      throw new Error('Anna kelvollinen päivämäärä.');
    return;
  }
  const total = duration(entry.start, entry.end);
  if (!Number.isFinite(total) || total <= 0)
    throw new Error('Lopetusajan pitää olla aloitusajan jälkeen.');
  if (total > 60 * 24 * 31) throw new Error('Jaa yli 31 vuorokauden merkintä osiin.');
  let sum = 0,
    previousEnd = Date.parse(entry.start);
  for (const b of [...(entry.breaks || [])].sort((a, b) =>
    String(a.start).localeCompare(String(b.start)),
  )) {
    const minutes = b.start ? duration(b.start, b.end) : Number(b.minutes);
    if (!Number.isFinite(minutes) || minutes < 0)
      throw new Error('Tauon keston pitää olla vähintään 0 minuuttia.');
    if (typeof b.paid !== 'boolean') throw new Error('Valitse, oliko tauko työaikaa.');
    if (b.start) {
      if (
        Date.parse(b.start) < previousEnd ||
        Date.parse(b.end) > Date.parse(entry.end) ||
        minutes <= 0
      ) {
        throw new Error(
          'Tarkista taukojen ajat: taukojen tulee olla vuoron sisällä eivätkä ne saa mennä päällekkäin.',
        );
      }
      previousEnd = Date.parse(b.end);
    }
    sum += minutes;
  }
  if (sum > total) throw new Error('Taukojen yhteiskesto ylittää työvuoron keston.');
}
export function entryMinutes(entry) {
  if (entry.kind === 'off') return 0;
  return (
    duration(entry.start, entry.end) -
    (entry.breaks || [])
      .filter((b) => !b.paid)
      .reduce((sum, b) => sum + (b.start ? duration(b.start, b.end) : Number(b.minutes)), 0)
  );
}

function daySlices(entry) {
  const slices = [];
  let cursor = Date.parse(entry.start),
    end = Date.parse(entry.end);
  while (cursor < end) {
    const date = dateKey(cursor);
    const stop = Math.min(end, Date.parse(toInstant(`${addDays(date, 1)}T00:00`)));
    const gross = (stop - cursor) / MINUTE;
    let net = gross;
    for (const b of entry.breaks || []) {
      if (b.paid) continue;
      if (b.start)
        net -=
          Math.max(0, Math.min(stop, Date.parse(b.end)) - Math.max(cursor, Date.parse(b.start))) /
          MINUTE;
    }
    slices.push({ date, minutes: net, entryId: entry.id });
    cursor = stop;
  }
  const untimed = (entry.breaks || [])
    .filter((b) => !b.paid && !b.start)
    .reduce((sum, b) => sum + Number(b.minutes), 0);
  const remaining = slices.reduce((sum, slice) => sum + slice.minutes, 0);
  for (const slice of slices)
    slice.minutes -= remaining ? (untimed * slice.minutes) / remaining : 0;
  return slices;
}

function longestGap(intervals, from, to) {
  let cursor = from,
    longest = 0;
  for (const [start, end] of intervals) {
    if (end <= from || start >= to) continue;
    longest = Math.max(longest, Math.max(0, start - cursor));
    cursor = Math.max(cursor, end);
  }
  return Math.max(longest, to - cursor) / MINUTE;
}

export function calculate(entries, now = Date.now(), active = null, settings = {}) {
  const work = entries
    .filter((e) => !e.deleted && e.kind !== 'off')
    .sort((a, b) => a.start.localeCompare(b.start));
  const days = {},
    weeks = {},
    warnings = [];
  for (const off of entries.filter((e) => !e.deleted && e.kind === 'off')) {
    days[off.date] ||= { date: off.date, minutes: 0, entryIds: [] };
  }
  const warn = (code, text, sections, entryId = null) =>
    warnings.push({ code, text, sections, entryId });
  for (const entry of work) {
    if (entries.some((e) => !e.deleted && e.kind === 'off' && e.date === dateKey(entry.start))) {
      warn(
        'off-overlap',
        'Samalle päivälle on merkitty sekä työtä että vapaapäivä. Tarkista merkinnät.',
        [16],
        entry.id,
      );
    }
    for (const slice of daySlices(entry)) {
      const day = (days[slice.date] ||= { date: slice.date, minutes: 0, entryIds: [] });
      day.minutes += slice.minutes;
      if (!day.entryIds.includes(entry.id)) day.entryIds.push(entry.id);
    }
    const start = Date.parse(entry.start),
      end = Date.parse(entry.end);
    const windowEnd = start + 24 * 60 * MINUTE;
    if (
      windowEnd <= now &&
      longestGap(
        work.map((e) => [Date.parse(e.start), Date.parse(e.end)]),
        start,
        windowEnd,
      ) < 660
    ) {
      warn(
        'daily-rest',
        'Vuoron alkamisesta seuraavan 24 tunnin jaksossa ei löydy 11 tunnin yhtenäistä lepoa. Tarkista mahdollinen poikkeus ja korvaava lepo.',
        [25],
        entry.id,
      );
    }
    const overlap = work.find(
      (e) => e.id !== entry.id && Date.parse(e.start) < end && Date.parse(e.end) > start,
    );
    if (overlap)
      warn(
        'overlap',
        'Työvuorot menevät päällekkäin. Tunnit ovat mukana molemmista kirjauksista; korjaa todelliset ajat.',
        [16],
        entry.id,
      );
  }
  // Fill the calendar rather than writing artificial off-day records to Firebase.
  // Include empty weeks and the current week in employee summaries.
  const activeDates = new Set();
  if (active && Date.parse(active.start) <= now) {
    for (let date = dateKey(active.start); date <= dateKey(now); date = addDays(date, 1))
      activeDates.add(date);
  }
  const relevant = [...Object.keys(days), ...activeDates, dateKey(now)].sort();
  const last = addDays(weekKey(relevant.at(-1)), 6);
  for (let date = weekKey(relevant[0]); date <= last; date = addDays(date, 1)) {
    days[date] ||= { date, minutes: 0, entryIds: [], inferredOff: !activeDates.has(date) };
  }
  for (const day of Object.values(days).sort((a, b) => a.date.localeCompare(b.date))) {
    const week = (weeks[weekKey(day.date)] ||= {
      date: weekKey(day.date),
      minutes: 0,
      regular: 0,
      daily50: 0,
      daily100: 0,
      weekly50: 0,
      sunday: 0,
      days: [],
    });
    Object.assign(day, overtimeParts(day.minutes, week.regular));
    day.sunday = new Date(`${day.date}T12:00:00Z`).getUTCDay() === 0 ? day.minutes : 0;
    day.leave = (day.daily50 + day.weekly50) * 1.5 + day.daily100 * 2;
    for (const key of ['minutes', 'regular', 'daily50', 'daily100', 'weekly50', 'sunday'])
      week[key] += day[key];
    week.days.push(day.date);
  }
  const intervals = work.map((e) => [Date.parse(e.start), Date.parse(e.end)]);
  for (const week of Object.values(weeks)) {
    const from = Date.parse(toInstant(`${week.date}T00:00`));
    const to = Date.parse(toInstant(`${addDays(week.date, 7)}T00:00`));
    week.leave = (week.daily50 + week.weekly50) * 1.5 + week.daily100 * 2;
    week.inferredOffDays = Array.from({ length: 7 }, (_, i) => addDays(week.date, i)).filter(
      (date) => !days[date]?.entryIds.length && !activeDates.has(date),
    );
    week.running = !!active && Date.parse(active.start) < to && now > from;
    week.complete = to <= now && !week.running;
    week.longestRest = week.complete ? longestGap(intervals, from, to) : null;
    if (week.longestRest !== null && week.longestRest < 2100)
      warn(
        'weekly-rest',
        `Viikon ${week.date} pisin kirjauksista löytyvä yhtenäinen lepo on ${formatMinutes(week.longestRest)}. Tavallinen 35 h ei täyty tässä ma–su-tarkastelussa. Tarkista myös viikon rajat ylittävä lepo. 14 vrk järjestelyssä edellytetään keskimäärin 35 h ja vähintään 24 h kummassakin 7 vrk jaksossa.`,
        [27, 28],
      );
    if (week.minutes > 2880)
      warn(
        'maximum',
        `Viikolla ${week.date} on ${formatMinutes(week.minutes)} työtä. Yksittäinen yli 48 h viikko ei yksin merkitse enimmäistyöajan ylitystä: tarkista keskimäärä neljän kuukauden seurantajaksolta.`,
        [18],
      );
  }
  const totals = Object.values(weeks).reduce(
    (sum, w) => {
      for (const key of [
        'minutes',
        'regular',
        'daily50',
        'daily100',
        'weekly50',
        'sunday',
        'leave',
      ])
        sum[key] += w[key];
      return sum;
    },
    { minutes: 0, regular: 0, daily50: 0, daily100: 0, weekly50: 0, sunday: 0, leave: 0 },
  );
  const result = { days, weeks, warnings, totals, rules: RULES };
  result.balance = settleBalance(entries, now, active, settings);
  return result;
}

export function validateBalanceSettings(settings) {
  if (
    !settings ||
    !Array.isArray(settings.workDays) ||
    !settings.workDays.length ||
    new Set(settings.workDays).size !== settings.workDays.length ||
    settings.workDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    throw new Error('Valitse vähintään yksi säännöllinen työpäivä.');
  if (
    !Number.isFinite(settings.weeklyMinutes) ||
    settings.weeklyMinutes <= 0 ||
    settings.weeklyMinutes > settings.workDays.length * 1440
  )
    throw new Error('Tarkista viikkotyöaika.');
  if (!Number.isFinite(settings.openingMinutes)) throw new Error('Anna kelvollinen alkusaldo.');
  if (
    typeof settings.startDate !== 'string' ||
    (settings.startDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(settings.startDate) ||
        addDays(settings.startDate, 0) !== settings.startDate))
  )
    throw new Error('Anna kelvollinen seurannan aloituspäivä.');
}

export function formatSignedMinutes(minutes) {
  const rounded = Math.round(minutes * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${formatMinutes(Math.abs(rounded))}`;
}

// Operational time-off estimate, not a new legal overtime classification.
// All elapsed dates are inferred off if no work exists, as requested by the user.
export function settleBalance(entries, now = Date.now(), active = null, config = {}) {
  const settings = {
    weeklyMinutes: 2400,
    workDays: [1, 2, 3, 4, 5],
    openingMinutes: 0,
    startDate: '',
    ...config,
  };
  validateBalanceSettings(settings);
  const visible = entries.filter((e) => !e.deleted);
  const today = dateKey(now);
  const unfinished = visible.some(
    (e) => e.kind !== 'off' && dateKey(e.start) <= today && Date.parse(e.end) > now,
  );
  const finishedToday = visible.some(
    (e) => e.kind !== 'off' && Date.parse(e.end) <= now && dateKey(Date.parse(e.end) - 1) === today,
  );
  let through = finishedToday && !unfinished && !active ? today : addDays(today, -1);
  if (active && dateKey(active.start) <= through) through = addDays(dateKey(active.start), -1);
  for (const entry of visible) {
    if (
      entry.kind !== 'off' &&
      Date.parse(entry.start) <= now &&
      Date.parse(entry.end) > now &&
      dateKey(entry.start) <= through
    )
      through = addDays(dateKey(entry.start), -1);
  }
  const dates = visible.map((e) => (e.kind === 'off' ? e.date : dateKey(e.start))).sort();
  const startDate = settings.startDate || dates[0] || null;
  const totals = {
    actual: 0,
    target: 0,
    extra: 0,
    used: 0,
    premium: 0,
    freeDays: 0,
    weekdayFreeDays: 0,
    restDays: 0,
  };
  const rows = [],
    weeks = {};
  const dailyTarget = settings.weeklyMinutes / settings.workDays.length;
  // Reclassify only completed input. Future entries must never change today's balance.
  const past = visible.filter((e) => e.kind === 'off' || Date.parse(e.end) <= now);
  const classified = classifyCompleted(past);
  let balance = settings.openingMinutes;
  if (startDate)
    for (let date = startDate; date <= through; date = addDays(date, 1)) {
      const day = classified[date] || { minutes: 0, premium: 0 };
      const target = settings.workDays.includes(new Date(`${date}T12:00Z`).getUTCDay())
        ? dailyTarget
        : 0;
      const actual = day.minutes;
      const extra = Math.max(0, actual - target),
        used = Math.max(0, target - actual);
      const free = actual === 0;
      const row = {
        date,
        actual,
        target,
        extra,
        used,
        premium: day.premium,
        free,
        scheduled: target > 0,
      };
      balance += extra + row.premium - used;
      row.balance = balance;
      rows.push(row);
      const week = (weeks[weekKey(date)] ||= {
        date: weekKey(date),
        actual: 0,
        target: 0,
        extra: 0,
        used: 0,
        premium: 0,
        freeDays: 0,
        weekdayFreeDays: 0,
        restDays: 0,
      });
      for (const accumulator of [totals, week]) {
        for (const key of ['actual', 'target', 'extra', 'used', 'premium'])
          accumulator[key] += row[key];
        if (free) {
          accumulator.freeDays++;
          accumulator[target ? 'weekdayFreeDays' : 'restDays']++;
        }
      }
      week.balance = balance;
    }
  return {
    ...totals,
    startDate,
    through,
    settings,
    dailyTarget,
    balance,
    rawBalance: totals.actual - totals.target,
    earned: totals.extra + totals.premium,
    rows,
    weeks: Object.values(weeks),
    version: RULES.balancePolicy,
  };
}

function classifyCompleted(entries) {
  const days = {},
    weekly = {};
  for (const entry of entries
    .filter((e) => e.kind !== 'off')
    .sort((a, b) => a.start.localeCompare(b.start)))
    for (const slice of daySlices(entry))
      (days[slice.date] ||= { minutes: 0, premium: 0 }).minutes += slice.minutes;
  for (const [date, day] of Object.entries(days).sort(([a], [b]) => a.localeCompare(b))) {
    const key = weekKey(date),
      before = weekly[key] || 0;
    const parts = overtimeParts(day.minutes, before);
    day.premium = parts.premium;
    weekly[key] = before + parts.regular;
  }
  return days;
}

function overtimeParts(minutes, previousRegular) {
  const daily50 = Math.min(120, Math.max(0, minutes - 480));
  const daily100 = Math.max(0, minutes - 600);
  const base = Math.min(minutes, 480);
  const weekly50 = Math.min(base, Math.max(0, previousRegular + base - 2400));
  return {
    daily50,
    daily100,
    weekly50,
    regular: base - weekly50,
    premium: (daily50 + weekly50) * 0.5 + daily100,
  };
}
