import {
  type State,
  type Trip,
  type Product,
  type Task,
  type Location,
  type Placement,
  type Status,
  open,
} from './model.ts';
import { availability, capacity, days, today } from './calendar.ts';
export type Command =
  | { type: 'trip'; trip: Trip; expected: number }
  | { type: 'product'; product: Product; expected: number }
  | {
      type: 'pack';
      tripId: string;
      itemId: string;
      quantity?: number;
      unitId?: string;
      remove?: boolean;
      expected: number;
    }
  | {
      type: 'return';
      tripId: string;
      itemId: string;
      quantity?: number;
      unitId?: string;
      damaged: boolean;
      expected: number;
    }
  | { type: 'status'; tripId: string; status: Status; expected: number }
  | { type: 'archiveReturned'; tripId: string; expected: number }
  | { type: 'task'; task: Task | null; id: string }
  | { type: 'location'; location: Location }
  | { type: 'placement'; placement: Placement | null; id: string };
function fail(s: string): never {
  throw Error(s);
}
const int = (n: number, min = 0) => Number.isSafeInteger(n) && n >= min;
function checkVersion(actual: number, expected: number) {
  if (actual !== expected)
    fail('Tieto muuttui toisella laitteella. Avaa tiedot uudelleen ja yritä sitten.');
}
function checkTrip(s: State, t: Trip, now: string) {
  if (!t.name.trim()) fail('Anna keikan nimi.');
  days(t.start, t.end);
  if (new Set(t.items.map((i) => i.id)).size !== t.items.length)
    fail('Kalustorivien tunnisteiden pitää olla yksilöllisiä.');
  const quantities: Record<string, number> = {};
  for (const i of t.items) {
    if (!i.name.trim() || !int(i.quantity, 1))
      fail('Jokaiselle riville tarvitaan nimi ja positiivinen kokonaismäärä.');
    if (i.type === 'legacy')
      fail('Ratkaise tuodun keikan epäselvät kalustorivit ennen muokkaamista.');
    if (i.quantity < i.packed) fail('Suunniteltu määrä ei voi alittaa pakattua määrää.');
    if (i.type === 'inventory') {
      const p = s.products[i.productId];
      if (!p || p.retired || p.review)
        fail(`${i.name}: tuotteen tiedot pitää tarkistaa ennen varaamista.`);
      quantities[i.productId] = (quantities[i.productId] ?? 0) + i.quantity;
    }
  }
  if (t.status === 'draft') return;
  for (const [id, n] of Object.entries(quantities)) {
    const free = availability(s, id, t.start, t.end, t.id, now);
    if (free.available < n)
      fail(`${s.products[id].name}: valitulle ajalle vapaana ${free.available}, tarvitaan ${n}.`);
  }
}
export function applyCommand(
  source: State,
  c: Command,
  id: string,
  at: string,
  now = today(),
): State {
  const fingerprint = JSON.stringify(c);
  if (source.receipts[id]) {
    if (source.receipts[id] !== fingerprint) fail('Komentotunnus on jo käytössä eri muutokselle.');
    return source;
  }
  const s = structuredClone(source);
  let text = '';
  if (c.type === 'trip') {
    const old = s.trips[c.trip.id];
    checkVersion(old?.version ?? 0, c.expected);
    if (old && !open(old)) fail('Arkistoitua tai peruttua keikkaa ei voi muokata.');
    if (old && ['out', 'returning'].includes(old.status))
      fail('Keikalla olevan kaluston suunnitelmaa ei voi vaihtaa palautuksen aikana.');
    const t = structuredClone(c.trip);
    // Physical packing data is never writable through the planning form.
    if (old) {
      for (const previous of old.items)
        if (previous.packed && !t.items.some((i) => i.id === previous.id))
          fail('Pakatun rivin poistaminen ei ole sallittu.');
      for (const i of t.items) {
        const previous = old.items.find((x) => x.id === i.id);
        if (previous?.packed && (previous.productId !== i.productId || previous.type !== i.type))
          fail('Pakatun rivin tuotetta ei voi vaihtaa.');
        Object.assign(i, {
          packed: previous?.packed ?? 0,
          returned: previous?.returned ?? 0,
          unitIds: previous?.unitIds ?? [],
          returnedUnitIds: previous?.returnedUnitIds ?? [],
          serialSnapshots: previous?.serialSnapshots ?? [],
        });
      }
      t.status = old.status;
      if (t.status === 'packed') t.status = 'planned';
    } else {
      t.status = t.status === 'draft' ? 'draft' : 'planned';
      for (const i of t.items)
        Object.assign(i, {
          packed: 0,
          returned: 0,
          unitIds: [],
          returnedUnitIds: [],
          serialSnapshots: [],
        });
    }
    checkTrip(s, t, now);
    t.version = (old?.version ?? 0) + 1;
    s.trips[t.id] = t;
    text = `Keikka tallennettu: ${t.name}`;
  } else if (c.type === 'product') {
    const p = structuredClone(c.product);
    checkVersion(s.products[p.id]?.version ?? 0, c.expected);
    if (!p.name.trim() || !int(p.total) || !int(p.maintenance) || p.maintenance > p.total)
      fail('Tarkista tuotteen nimi ja määrät.');
    const serials = Object.values(p.units).map((u) => u.serial.trim());
    if (serials.some((x) => !x) || new Set(serials).size !== serials.length)
      fail('Sarjanumerot eivät voi olla tyhjiä tai samoja.');
    for (const other of Object.values(s.products))
      if (other.id !== p.id && Object.values(other.units).some((u) => serials.includes(u.serial)))
        fail('Sarjanumero kuuluu jo toiselle tuotteelle.');
    for (const t of Object.values(s.trips).filter(open))
      for (const row of t.items.filter((i) => i.productId === p.id)) {
        if (
          row.unitIds.some(
            (uid) =>
              !row.returnedUnitIds.includes(uid) &&
              (!p.units[uid] || p.units[uid].condition !== 'ready'),
          )
        )
          fail('Ulkona olevaa yksilöä ei voi poistaa tai siirtää huoltoon tuotemuokkauksesta.');
        if (s.products[p.id]?.tracking !== p.tracking && row.packed)
          fail('Pakatun tuotteen seurantatapaa ei voi vaihtaa.');
      }
    if (p.tracking === 'serial') {
      p.total = Object.keys(p.units).length;
      p.maintenance = 0;
    }
    p.version = c.expected + 1;
    s.products[p.id] = p;
    text = `Kalusto päivitetty: ${p.name}`;
  } else if (c.type === 'task') {
    if (c.task) {
      if (!c.task.text.trim()) fail('Anna tehtävä.');
      s.tasks[c.id] = c.task;
    } else delete s.tasks[c.id];
    text = 'Tehtävälista päivitetty';
  } else if (c.type === 'location') {
    if (!c.location.shelf.trim() || !c.location.aisle.trim() || !c.location.level.trim())
      fail('Anna hylly, väli ja taso.');
    if (
      Object.values(s.locations).some(
        (l) =>
          l.id !== c.location.id &&
          l.shelf === c.location.shelf &&
          l.aisle === c.location.aisle &&
          l.level === c.location.level,
      )
    )
      fail('Paikka on jo olemassa.');
    s.locations[c.location.id] = c.location;
    text = 'Hyllypaikka lisätty';
  } else if (c.type === 'placement') {
    if (c.placement) {
      if (!s.locations[c.placement.locationId]) fail('Hyllypaikkaa ei löydy.');
      if (c.placement.productId && !s.products[c.placement.productId]) fail('Tuotetta ei löydy.');
      s.placements[c.id] = c.placement;
    } else delete s.placements[c.id];
    text = 'Sijoittelu päivitetty';
  } else {
    const t = s.trips[c.tripId];
    if (!t) fail('Keikkaa ei löydy.');
    checkVersion(t.version, c.expected);
    if (!open(t)) fail('Keikka on suljettu.');
    if (c.type === 'archiveReturned') {
      t.manualClosure = {
        at,
        previousStatus: t.status,
        previousReturns: t.items.map((i) => ({
          itemId: i.id,
          returned: i.returned,
          returnedUnitIds: [...i.returnedUnitIds],
        })),
      };
      for (const i of t.items) {
        i.returned = i.packed;
        i.returnedUnitIds = [...i.unitIds];
      }
      t.status = 'closed';
      text = `Keikka palautettu ja arkistoitu käsin keskeneräisistä tiedoista: ${t.name}`;
    } else if (c.type === 'status') {
      const allowed: Partial<Record<Status, Status[]>> = {
        draft: ['planned', 'cancelled'],
        planned: ['packed', 'cancelled'],
        packed: ['out', 'planned'],
        out: ['returning'],
        returning: ['closed'],
      };
      if (!allowed[t.status]?.includes(c.status)) fail('Tilasiirtymä ei ole sallittu.');
      if (c.status === 'planned') checkTrip(s, { ...t, status: 'planned' }, now);
      if (c.status === 'packed' && (!t.items.length || t.items.some((i) => i.packed < i.quantity)))
        fail('Pakkaa kaikki suunnitellut tuotteet ensin.');
      if (c.status === 'cancelled' && t.items.some((i) => i.packed > i.returned))
        fail('Pura pakkaus ennen perumista.');
      if (c.status === 'closed' && t.items.some((i) => i.packed !== i.returned))
        fail('Kaikkia pakattuja tuotteita ei ole palautettu.');
      if (c.status === 'out') checkTrip(s, t, now);
      t.status = c.status;
      text = `Keikan tila päivitetty: ${t.name}`;
    } else {
      const i = t.items.find((x) => x.id === c.itemId);
      if (!i) fail('Riviä ei löydy.');
      if (i.type === 'legacy') fail('Tuodun pakkausrivin identiteetti pitää tarkistaa ensin.');
      const p = i.type === 'inventory' ? s.products[i.productId] : undefined;
      if (c.type === 'pack') {
        if (!['planned', 'packed'].includes(t.status)) fail('Pakkaa keikka ennen lähtöä.');
        if (p?.review || p?.retired) fail('Tuote pitää tarkistaa ennen pakkaamista.');
        if (p?.tracking === 'serial') {
          const uid = c.unitId ?? '';
          const u = p.units[uid];
          if (!u) fail('Sarjanumeroa ei löydy tämän tuotteen yksilöistä.');
          if (c.remove) {
            i.unitIds = i.unitIds.filter((x) => x !== uid);
          } else if (!i.unitIds.includes(uid)) {
            if (u.condition !== 'ready') fail('Laite on huollossa.');
            for (const other of Object.values(s.trips).filter(open))
              for (const row of other.items)
                if (row !== i && row.unitIds.includes(uid) && !row.returnedUnitIds.includes(uid))
                  fail('Laite on jo pakattu toiselle riville tai keikalle.');
            i.unitIds.push(uid);
          }
          i.packed = i.unitIds.length;
          i.serialSnapshots = i.unitIds.map((uid) => p.units[uid].serial);
        } else {
          if (c.unitId) fail('Tuotetta seurataan kappalemääränä.');
          if (!int(c.quantity ?? -1)) fail('Anna kelvollinen määrä.');
          i.packed = c.quantity!;
        }
        if (i.packed > i.quantity)
          fail('Pakkausmäärä ylittää suunnitelman. Muuta ensin kalustovarausta.');
        if (p) {
          const elsewhere = Object.values(s.trips)
            .filter((x) => x.id !== t.id && open(x))
            .flatMap((x) => x.items)
            .filter((x) => x.productId === p.id)
            .reduce((n, x) => n + x.packed - x.returned, 0);
          const here = t.items
            .filter((x) => x.productId === p.id)
            .reduce((n, x) => n + x.packed - x.returned, 0);
          if (elsewhere + here > capacity(p))
            fail('Fyysisesti vapaata kalustoa ei ole riittävästi.');
        }
        t.status = 'planned';
        text = `Pakkaus tallennettu: ${t.name}`;
      } else {
        if (!['out', 'returning'].includes(t.status))
          fail('Palautus tehdään keikalla olevalle kalustolle.');
        if (p?.tracking === 'serial') {
          const uid = c.unitId ?? '';
          if (!i.unitIds.includes(uid)) fail('Yksilöä ei ole pakattu.');
          if (!i.returnedUnitIds.includes(uid)) {
            i.returnedUnitIds.push(uid);
            if (c.damaged) {
              p.units[uid].condition = 'maintenance';
              p.version++;
            }
          }
          i.returned = i.returnedUnitIds.length;
        } else {
          if (!int(c.quantity ?? -1) || c.quantity! > i.packed - i.returned)
            fail('Palautusmäärä ylittää palauttamatta olevan määrän.');
          i.returned += c.quantity!;
          if (c.damaged && p) {
            p.maintenance += c.quantity!;
            p.version++;
          }
        }
        t.status = 'returning';
        text = `Palautus tallennettu: ${t.name}`;
      }
    }
    t.version++;
  }
  s.revision++;
  s.receipts[id] = fingerprint;
  s.events.unshift({ id, at, text });
  s.events = s.events.slice(0, 300);
  return s;
}
