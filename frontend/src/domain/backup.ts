import { type State, statusLabels } from './model.ts';
import { parseLedProject } from './ledProjects.ts';
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
    if (t.ledPlans !== undefined) {
      if (!object(t.ledPlans)) throw Error('LED-suunnitelmien rakenne ei ole kelvollinen.');
      for (const [planId, plan] of Object.entries(t.ledPlans)) {
        parseLedProject(plan);
        if (
          plan.id !== planId ||
          !integer(plan.version) ||
          plan.version < 1 ||
          !integer(plan.appliedVersion) ||
          plan.appliedVersion > plan.version ||
          typeof plan.updatedAt !== 'string'
        )
          throw Error('LED-suunnitelman versio ei ole kelvollinen.');
      }
    }
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
  if (s.bundles !== undefined) {
    if (!object(s.bundles)) throw Error('Pakkausnippujen rakenne ei ole kelvollinen.');
    const members = new Set<string>();
    const units = new Set<string>();
    for (const [id, b] of Object.entries(s.bundles)) {
      if (
        id !== b.id ||
        typeof b.name !== 'string' ||
        !integer(b.version) ||
        typeof b.closed !== 'boolean' ||
        typeof b.departed !== 'boolean' ||
        !Array.isArray(b.tripIds) ||
        b.tripIds.length < 2 ||
        new Set(b.tripIds).size !== b.tripIds.length ||
        b.tripIds.some((id) => !s.trips[id]) ||
        !object(b.holding)
      )
        throw Error('Pakkausnipun tiedot eivät ole kelvollisia.');
      for (const id of b.tripIds)
        if (!b.closed) {
          if (members.has(id)) throw Error('Keikka kuuluu useaan aktiiviseen nippuun.');
          members.add(id);
        }
      for (const [pid, h] of Object.entries(b.holding)) {
        if (
          !s.products[pid] ||
          !integer(h.quantity) ||
          !Array.isArray(h.unitIds) ||
          h.unitIds.length > h.quantity ||
          new Set(h.unitIds).size !== h.unitIds.length ||
          (b.closed && h.quantity !== 0)
        )
          throw Error('Nipun pakkausmäärä ei ole kelvollinen.');
        for (const uid of h.unitIds) {
          const key = pid + '/' + uid;
          if (
            !s.products[pid].units[uid] ||
            units.has(key) ||
            Object.values(s.trips).some(
              (t) =>
                !['closed', 'cancelled'].includes(t.status) &&
                t.items.some(
                  (i) =>
                    i.productId === pid &&
                    i.unitIds.includes(uid) &&
                    !i.returnedUnitIds.includes(uid),
                ),
            )
          )
            throw Error('Nipun laite puuttuu tai on jo pakattu muualle.');
          units.add(key);
        }
      }
    }
  }
  return { state: structuredClone(s), source: r.legacySource ?? null };
}
