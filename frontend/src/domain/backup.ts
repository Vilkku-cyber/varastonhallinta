import { type State, statusLabels } from './model.ts';
export function parseBackup(raw: unknown): { state: State; source: unknown } {
  const r = raw as { format?: string; version?: number; state?: State; legacySource?: unknown };
  if (r?.format !== 'av-arsenal-backup' || r.version !== 2 || r.state?.schemaVersion !== 2)
    throw Error('Varmuuskopion versio ei ole tuettu.');
  const s = r.state;
  const object = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
  const integer = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  if (
    !integer(s.revision) ||
    !['products', 'trips', 'locations', 'placements', 'tasks', 'receipts'].every((k) =>
      object(s[k as keyof State]),
    ) ||
    !Array.isArray(s.reviews) ||
    !Array.isArray(s.events)
  )
    throw Error('Varmuuskopion rakenne ei ole kelvollinen.');
  for (const [id, p] of Object.entries(s.products)) {
    if (
      id !== p.id ||
      typeof p.name !== 'string' ||
      !integer(p.total) ||
      !integer(p.maintenance) ||
      !integer(p.version) ||
      !object(p.units) ||
      !['serial', 'quantity'].includes(p.tracking)
    )
      throw Error('Tuotetiedot eivät ole kelvollisia.');
    for (const [uid, u] of Object.entries(p.units))
      if (
        uid !== u.id ||
        typeof u.serial !== 'string' ||
        !['ready', 'maintenance'].includes(u.condition)
      )
        throw Error('Yksilötiedot eivät ole kelvollisia.');
  }
  for (const [id, t] of Object.entries(s.trips)) {
    if (
      id !== t.id ||
      typeof t.name !== 'string' ||
      typeof t.start !== 'string' ||
      typeof t.end !== 'string' ||
      !Object.hasOwn(statusLabels, t.status) ||
      !Array.isArray(t.items) ||
      !integer(t.version)
    )
      throw Error('Keikkatiedot eivät ole kelvollisia.');
    for (const i of t.items)
      if (
        typeof i.name !== 'string' ||
        !['inventory', 'custom', 'legacy'].includes(i.type) ||
        !integer(i.quantity) ||
        !integer(i.packed) ||
        !integer(i.returned) ||
        i.returned > i.packed ||
        ![i.unitIds, i.returnedUnitIds, i.serialSnapshots].every(
          (a) => Array.isArray(a) && a.every((x) => typeof x === 'string'),
        )
      )
        throw Error('Kalustorivi ei ole kelvollinen.');
  }
  for (const p of Object.values(s.placements))
    if (typeof p.label !== 'string' || !s.locations[p.locationId])
      throw Error('Hyllysijoittelun viittaus puuttuu.');
  return { state: structuredClone(s), source: r.legacySource ?? null };
}
