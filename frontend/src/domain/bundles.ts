import { type State, type PackingBundle, open } from './model.ts';
import { availability, capacity, days } from './calendar.ts';

export type BundleCommand =
  | {
      type: 'bundle';
      id: string;
      expected: number;
      action: 'returnAll';
      tripVersions: Record<string, number>;
    }
  | {
      type: 'bundle';
      id: string;
      expected: number;
      action: 'returnUnit';
      productId: string;
      unitId: string;
      damaged: boolean;
    }
  | {
      type: 'bundle';
      id: string;
      expected: number;
      action: 'returnQuantity';
      productId: string;
      quantity: number;
      tripId: string;
      itemId: string;
      tripVersion: number;
    }
  | { type: 'bundleCreate'; id: string; name: string; tripIds: string[] }
  | {
      type: 'bundle';
      id: string;
      expected: number;
      action: 'load' | 'unload' | 'assign' | 'unassign';
      productId: string;
      unitId?: string;
      quantity?: number;
      tripId?: string;
      itemId?: string;
      tripVersion?: number;
    }
  | { type: 'bundle'; id: string; expected: number; action: 'depart' | 'close' };
export const activeBundles = (s: State) => Object.values(s.bundles ?? {}).filter((b) => !b.closed);
export const bundleForTrip = (s: State, id: string) =>
  activeBundles(s).find((b) => b.tripIds.includes(id));
export const held = (s: State, productId: string) =>
  activeBundles(s).reduce((n, b) => n + (b.holding[productId]?.quantity ?? 0), 0);
export const heldUnit = (s: State, productId: string, unitId: string) =>
  activeBundles(s).some((b) => b.holding[productId]?.unitIds.includes(unitId));
export function bundleRows(s: State, b: PackingBundle) {
  const result: Record<
    string,
    {
      productId: string;
      name: string;
      quantity: number;
      packed: number;
      returned: number;
      holding: number;
    }
  > = {};
  for (const id of b.tripIds)
    for (const i of s.trips[id]?.items ?? []) {
      if (i.type !== 'inventory') continue;
      const r = (result[i.productId] ??= {
        productId: i.productId,
        name: i.name,
        quantity: 0,
        packed: 0,
        returned: 0,
        holding: b.holding[i.productId]?.quantity ?? 0,
      });
      r.quantity += i.quantity;
      r.packed += i.packed;
      r.returned += i.returned;
    }
  for (const [pid, h] of Object.entries(b.holding))
    if (h.quantity > 0 && !result[pid])
      result[pid] = {
        productId: pid,
        name: s.products[pid]?.name ?? pid,
        quantity: 0,
        packed: 0,
        returned: 0,
        holding: h.quantity,
      };
  return Object.values(result);
}
function requireThat(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function applyBundle(s: State, c: BundleCommand): string {
  s.bundles ??= {};
  if (c.type === 'bundleCreate') {
    requireThat(
      c.id && !s.bundles[c.id] && c.name.trim(),
      'Anna uudelle nipulle nimi ja yksilöllinen tunnus.',
    );
    requireThat(
      c.tripIds.length >= 2 && new Set(c.tripIds).size === c.tripIds.length,
      'Valitse vähintään kaksi eri keikkaa.',
    );
    const trips = c.tripIds.map((id) => s.trips[id]);
    for (const t of trips) {
      requireThat(
        t && ['planned', 'packed'].includes(t.status) && !bundleForTrip(s, t.id),
        'Keikan pitää olla pakattavissa eikä se saa kuulua toiseen nippuun.',
      );
      days(t.start, t.end);
      requireThat(
        !t.items.some((i) => i.type === 'legacy' || i.returned > 0),
        'Ratkaise tuodut pakkausrivit ennen niputtamista.',
      );
    }
    requireThat(
      trips
        .map((t) => t.start)
        .sort()
        .at(-1)! <= trips.map((t) => t.end).sort()[0],
      'Niputettavilla keikoilla pitää olla yhteinen tapahtumapäivä.',
    );
    s.bundles[c.id] = {
      id: c.id,
      name: c.name.trim(),
      tripIds: [...c.tripIds],
      version: 1,
      departed: false,
      closed: false,
      holding: {},
    };
    return `Pakkausnippu luotu: ${c.name}`;
  }
  const b = s.bundles[c.id];
  requireThat(b && !b.closed, 'Aktiivista nippua ei löydy.');
  requireThat(
    b.version === c.expected,
    'Nippu muuttui toisella laitteella. Tarkista tiedot ja yritä uudelleen.',
  );
  if (c.action === 'returnAll' || c.action === 'returnUnit' || c.action === 'returnQuantity') {
    requireThat(b.departed, 'Merkitse nippu lähteneeksi ennen palautusta.');
    const finish = (t: State['trips'][string], complete = false) => {
      t.status = t.items.every(
        (i) => i.returned === i.packed && (complete || i.packed >= i.quantity),
      )
        ? 'closed'
        : 'returning';
      t.version++;
    };
    if (c.action === 'returnAll') {
      for (const id of b.tripIds) {
        const t = s.trips[id];
        requireThat(
          t && c.tripVersions[id] === t.version,
          'Keikan tiedot muuttuivat. Tarkista palautettava kalusto uudelleen.',
        );
        requireThat(
          ['out', 'returning', 'closed', 'cancelled'].includes(t.status),
          'Keikka ei ole palautettavassa tilassa.',
        );
        if (!['closed', 'cancelled'].includes(t.status)) {
          for (const i of t.items) {
            i.returned = i.packed;
            i.returnedUnitIds = [...i.unitIds];
          }
          finish(t, true);
        }
      }
      for (const h of Object.values(b.holding)) {
        h.quantity = 0;
        h.unitIds = [];
      }
      b.closed = true;
    } else if (c.action === 'returnUnit') {
      const p = s.products[c.productId];
      requireThat(p?.units[c.unitId], 'Laitetta ei löydy.');
      const matches = b.tripIds.flatMap((id) => {
        const t = s.trips[id];
        return t && ['out', 'returning'].includes(t.status)
          ? t.items
              .filter(
                (i) =>
                  i.productId === p.id &&
                  i.unitIds.includes(c.unitId) &&
                  !i.returnedUnitIds.includes(c.unitId),
              )
              .map((i) => ({ t, i }))
          : [];
      });
      const h = b.holding[p.id];
      const inHolding = !!h?.unitIds.includes(c.unitId);
      requireThat(
        matches.length + Number(inHolding) === 1,
        'Laite on jo palautettu tai sitä ei ole kohdistettu tähän nippuun.',
      );
      if (inHolding) {
        h.quantity--;
        h.unitIds = h.unitIds.filter((id) => id !== c.unitId);
      } else {
        const { t, i } = matches[0];
        i.returnedUnitIds.push(c.unitId);
        i.returned++;
        finish(t);
      }
      if (c.damaged) {
        p.units[c.unitId].condition = 'maintenance';
        p.version++;
      }
    } else {
      requireThat(b.tripIds.includes(c.tripId), 'Keikka ei kuulu nippuun.');
      const t = s.trips[c.tripId];
      requireThat(
        t.version === c.tripVersion,
        'Keikan tiedot muuttuivat. Tarkista palautus uudelleen.',
      );
      requireThat(
        ['out', 'returning'].includes(t.status),
        'Keikka ei ole palautettavassa tilassa.',
      );
      const i = t.items.find((i) => i.id === c.itemId && i.productId === c.productId);
      requireThat(
        i &&
          Number.isSafeInteger(c.quantity) &&
          c.quantity > 0 &&
          c.quantity <= i.packed - i.unitIds.length - (i.returned - i.returnedUnitIds.length),
        'Määrä ylittää ilman sarjanumeroa palauttamatta olevan määrän.',
      );
      i.returned += c.quantity;
      finish(t);
    }
    b.version++;
    return `Pakkausnippu ${b.name}: ${c.action === 'returnAll' ? 'koko kalusto palautettu ja asiakkaiden keikat arkistoitu' : c.action === 'returnUnit' ? `sarjanumero ${s.products[c.productId].units[c.unitId].serial} palautettu${c.damaged ? ' huoltoon' : ''}` : 'määrä palautettu asiakkaan keikalle'}`;
  } else if (c.action === 'close') {
    requireThat(
      Object.values(b.holding).every((h) => h.quantity === 0),
      'Kohdista tai pura nipun kohdistamattomat tavarat ensin.',
    );
    // Closing only removes the grouping; trips and their packing history remain intact.
    b.closed = true;
  } else if (c.action === 'depart') {
    requireThat(!b.departed, 'Nippu on jo merkitty lähteneeksi.');
    requireThat(
      bundleRows(s, b).every((r) => r.packed + r.holding >= r.quantity),
      'Pakkaa nipun koko kalusto ennen lähtöä.',
    );
    for (const id of b.tripIds) {
      const t = s.trips[id];
      requireThat(['planned', 'packed'].includes(t.status), 'Keikan tila on muuttunut.');
      for (const i of t.items.filter((i) => i.type === 'inventory')) {
        const planned = t.items
          .filter((row) => row.productId === i.productId)
          .reduce((n, row) => n + row.quantity, 0);
        requireThat(
          availability(s, i.productId, t.start, t.end, t.id).available >= planned,
          'Kaluston saatavuus muuttui. Tarkista varaukset ennen lähtöä.',
        );
        requireThat(
          i.unitIds.every((uid) => s.products[i.productId]?.units[uid]?.condition === 'ready'),
          'Keikalle pakattu laite on merkitty huoltoon.',
        );
      }
      requireThat(
        t.items.filter((i) => i.type !== 'inventory').every((i) => i.packed === i.quantity),
        'Pakkaa myös keikkojen muut tuotteet ennen lähtöä.',
      );
      t.status = 'out';
      t.version++;
    }
    b.departed = true;
    for (const [pid, h] of Object.entries(b.holding))
      requireThat(
        h.unitIds.every((uid) => s.products[pid]?.units[uid]?.condition === 'ready'),
        'Nippuun pakattu laite on merkitty huoltoon. Pura se ensin.',
      );
  } else if ('productId' in c) {
    const p = s.products[c.productId];
    requireThat(p, 'Tuotetta ei löydy.');
    const row = bundleRows(s, b).find((r) => r.productId === p.id);
    requireThat(row, 'Tuote ei kuulu nipun keikkojen varaukseen.');
    const h = (b.holding[p.id] ??= { quantity: 0, unitIds: [] });
    const count = c.unitId ? 1 : (c.quantity ?? 0);
    requireThat(Number.isSafeInteger(count) && count > 0, 'Anna positiivinen kokonaismäärä.');
    if (c.unitId)
      requireThat(p.units[c.unitId] && p.tracking === 'serial', 'Sarjanumero ei kuulu tuotteelle.');
    if (c.action === 'load') {
      requireThat(!b.departed, 'Lähteneeseen nippuun ei voi lisätä kalustoa.');
      requireThat(!p.retired && !p.review, 'Tuotteen tiedot pitää tarkistaa.');
      if (c.unitId) {
        requireThat(p.units[c.unitId].condition === 'ready', 'Laite on huollossa.');
        requireThat(!heldUnit(s, p.id, c.unitId), 'Laite on jo pakattu nippuun.');
        requireThat(
          !Object.values(s.trips)
            .filter(open)
            .some((t) =>
              t.items.some(
                (i) =>
                  i.productId === p.id &&
                  i.unitIds.includes(c.unitId!) &&
                  !i.returnedUnitIds.includes(c.unitId!),
              ),
            ),
          'Laite on jo pakattu keikalle.',
        );
        h.unitIds.push(c.unitId);
      }
      const packed = Object.values(s.trips)
        .filter(open)
        .flatMap((t) => t.items)
        .filter((i) => i.productId === p.id)
        .reduce((n, i) => n + i.packed - i.returned, 0);
      requireThat(
        packed + held(s, p.id) + count <= capacity(p),
        'Fyysisesti vapaata kalustoa ei ole riittävästi.',
      );
      h.quantity += count;
    } else if (c.action === 'unload') {
      if (c.unitId) {
        requireThat(h.unitIds.includes(c.unitId), 'Laite ei ole kohdistamattomana nipussa.');
        h.unitIds = h.unitIds.filter((id) => id !== c.unitId);
      } else
        requireThat(
          count <= h.quantity - h.unitIds.length,
          'Määrä ylittää ilman sarjanumeroa pakatun määrän.',
        );
      h.quantity -= count;
    } else {
      requireThat(c.tripId && b.tripIds.includes(c.tripId), 'Valitse nipun keikka.');
      const t = s.trips[c.tripId!];
      requireThat(
        t.version === c.tripVersion,
        'Keikka muuttui toisella laitteella. Tarkista tiedot.',
      );
      requireThat(
        ['planned', 'packed', 'out'].includes(t.status),
        'Keikka ei ole kohdistettavissa palautuksen aikana tai arkistossa.',
      );
      const i = t.items.find(
        (i) => i.id === c.itemId && i.type === 'inventory' && i.productId === p.id,
      );
      requireThat(i, 'Kalustoriviä ei löydy keikalta.');
      if (c.action === 'assign') {
        if (c.unitId) {
          if (!h.unitIds.includes(c.unitId)) {
            requireThat(
              h.quantity > h.unitIds.length,
              'Nipussa ei ole tätä laitetta eikä tunnistamatonta kappaletta.',
            );
            requireThat(p.units[c.unitId].condition === 'ready', 'Laite on huollossa.');
            requireThat(!heldUnit(s, p.id, c.unitId), 'Laite on toisessa nipussa.');
            requireThat(
              !Object.values(s.trips)
                .filter(open)
                .some((other) =>
                  other.items.some(
                    (row) =>
                      row.productId === p.id &&
                      row.unitIds.includes(c.unitId!) &&
                      !row.returnedUnitIds.includes(c.unitId!),
                  ),
                ),
              'Laite on jo kohdistettu keikalle.',
            );
          }
          h.unitIds = h.unitIds.filter((id) => id !== c.unitId);
          i!.unitIds.push(c.unitId);
        } else
          requireThat(
            count <= h.quantity - h.unitIds.length,
            'Määrä ylittää nipun kohdistamattoman määrän.',
          );
        h.quantity -= count;
        i!.packed += count;
      } else {
        if (c.unitId) {
          requireThat(
            i!.unitIds.includes(c.unitId) && !i!.returnedUnitIds.includes(c.unitId),
            'Laite ei ole tällä keikalla palauttamatta.',
          );
          i!.unitIds = i!.unitIds.filter((id) => id !== c.unitId);
          h.unitIds.push(c.unitId);
        } else
          requireThat(
            count <= i!.packed - i!.unitIds.length - (i!.returned - i!.returnedUnitIds.length),
            'Määrä ylittää kohdistetun määrän.',
          );
        i!.packed -= count;
        h.quantity += count;
      }
      i!.serialSnapshots = i!.unitIds.map((id) => p.units[id].serial);
      if (t.status === 'packed') t.status = 'planned';
      t.version++;
    }
  }
  b.version++;
  return `Pakkausnippu ${b.name}: ${{ load: 'pakattu autoon', unload: 'purettu kohdistamaton kalusto', assign: 'kohdistettu asiakkaalle', unassign: 'vapautettu asiakkaalta nippuun', depart: 'lähtenyt tapahtumaan', close: 'niputus päätetty' }[c.action]}`;
}
