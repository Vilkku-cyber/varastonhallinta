import { emptyState, type State, type Item, type Status } from './model.ts';
import { validDay } from './calendar.ts';
type Legacy = Record<string, any>;
const entries = (v: any): [string, any][] =>
  v && typeof v === 'object' ? Object.entries(v).filter(([, x]) => x !== null) : [];
const key = (s: string) =>
  'old-' +
  Array.from(new TextEncoder().encode(s))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
const num = (v: any) => (Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
export function legacyDay(v: unknown) {
  if (typeof v !== 'string') return '';
  if (validDay(v)) return v;
  const d = new Date(v);
  return Number.isFinite(+d)
    ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki' }).format(d)
    : '';
}
export function importLegacy(raw: Legacy): State {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !raw.inventory)
    throw Error('Valitse vanhan RTDB-kannan export, jossa on inventory-haara.');
  const s = emptyState();
  const review = (path: string, message: string) =>
    s.reviews.push({ id: key(path + '|' + message), path, message });
  for (const [id, p] of entries(raw.inventory)) {
    if (!p.name) {
      review(
        'inventory/' + id,
        'Nimetön tietue säilytetty alkuperäisessä tuonnissa; hyllymerkinnät näkyvät Varasto-näkymässä.',
      );
      continue;
    }
    const units: State['products'][string]['units'] = {};
    for (const [serial, u] of entries(p.units)) {
      const uid = key(id + '|' + serial);
      units[uid] = { id: uid, serial, condition: 'ready', notes: String(u.damage ?? '') };
    }
    const mismatch = entries(p.units).length > 0 && entries(p.units).length !== num(p.available);
    if (mismatch)
      review(
        'inventory/' + id,
        'Yksilömäärä ja saldo eroavat. Tarkista tuote ja vahvista määrät ennen uusia varauksia.',
      );
    s.products[id] = {
      id,
      name: String(p.name),
      category: String(p.category ?? 'Muu'),
      total: num(p.available),
      maintenance: 0,
      tracking: entries(p.units).length ? 'serial' : 'quantity',
      units,
      notes: [p.details, p.additionalInfo]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join('\n\n'),
      dimensions: String(p.dimensions ?? ''),
      weight: String(p.weight ?? ''),
      retired: false,
      review: mismatch,
      version: 1,
    };
  }
  for (const [shelf, sh] of entries(raw.shelves))
    for (const [aisle, a] of entries(sh.aisles))
      for (const [level, l] of entries(a.levels)) {
        const id = key(`${shelf}/${aisle}/${level}`);
        s.locations[id] = { id, shelf, aisle, level, direction: sh.direction ?? 'ltr' };
        for (const [pid] of entries(l.products)) {
          const placementId = key(`${id}/${pid}`);
          s.placements[placementId] = {
            id: placementId,
            locationId: id,
            productId: s.products[pid] ? pid : '',
            label: s.products[pid]?.name ?? pid,
          };
        }
      }
  const status: Record<string, Status> = {
    pakkaamatta: 'planned',
    pakattu: 'packed',
    keikalla: 'out',
    purkamatta: 'returning',
  };
  for (const branch of ['keikat', 'archived-trips'])
    for (const [id, t] of entries(raw[branch])) {
      const items: Item[] = [];
      for (const [k, i] of entries(t.items)) {
        const pid = String(i.id ?? (!Array.isArray(t.items) ? k : ''));
        const p = s.products[pid];
        items.push({
          id: key('item/' + k),
          type: p ? 'inventory' : 'legacy',
          productId: p ? pid : '',
          name: String(i.name ?? p?.name ?? pid ?? 'Tuntematon tuote'),
          quantity: num(i.quantity),
          note: '',
          packed: 0,
          returned: 0,
          unitIds: [],
          returnedUnitIds: [],
          serialSnapshots: [],
        });
        if (!p)
          review(
            `${branch}/${id}/items/${k}`,
            'Tuoteviittaus puuttuu. Alkuperäinen rivi säilytetty.',
          );
      }
      for (const [k, packed] of entries(t.packedItems)) {
        const packedRows = Array.isArray(packed) ? entries(packed) : [[k, packed] as [string, any]];
        for (const [sub, p] of packedRows) {
          const direct =
            !k.startsWith('manual-') && !Array.isArray(packed) ? s.products[k] : undefined;
          let row = direct ? items.find((i) => i.productId === k) : undefined;
          if (!row) {
            row = {
              id: key('packed/' + k + '/' + sub),
              type: direct ? 'inventory' : 'legacy',
              productId: direct ? k : '',
              name: String(p.name ?? direct?.name ?? k.replace(/^manual-/, '')),
              quantity: num(p.quantity),
              note: direct ? '' : 'Tuotu pakkausrivi – tuoteyhteys tarkistettava',
              packed: 0,
              returned: 0,
              unitIds: [],
              returnedUnitIds: [],
              serialSnapshots: [],
            };
            items.push(row);
          }
          row.packed = num(p.quantity);
          row.serialSnapshots = entries(p.serials).map(([serial]) => serial);
          row.unitIds = direct
            ? row.serialSnapshots
                .map((serial) => key(k + '|' + serial))
                .filter((uid) => !!direct.units[uid])
            : [];
          if (!direct)
            review(
              `${branch}/${id}/packedItems/${k}/${sub}`,
              'Käsin pakatun rivin tuoteyhteyttä ei päätelty pelkän nimen perusteella.',
            );
        }
      }
      const start = legacyDay(t.startDate),
        end = legacyDay(t.endDate);
      if (!validDay(start) || !validDay(end) || end < start)
        review(`${branch}/${id}`, 'Keikan päivämäärät on tarkistettava.');
      let targetId = id;
      if (s.trips[id]) {
        targetId = key(branch + '/' + id);
        review(
          `${branch}/${id}`,
          'Tunniste oli jo aktiivisissa keikoissa; arkiston vastine säilytettiin erillisenä.',
        );
      }
      s.trips[targetId] = {
        id: targetId,
        name: String(t.name ?? 'Nimetön keikka'),
        contact: String(t.contact ?? ''),
        start,
        end,
        status: branch === 'archived-trips' ? 'closed' : (status[t.status] ?? 'planned'),
        items,
        notes: 'Tuotu vanhasta AV-arsenalista.',
        version: 1,
        imported: true,
        packingUnknown: !t.packedItems,
      };
    }
  for (const [id, t] of entries(raw.todo))
    s.tasks[id] = { id, text: String(t.text ?? ''), done: !!t.done };
  return s;
}
