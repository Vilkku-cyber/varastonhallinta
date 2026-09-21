import type { State, Product, Unit } from './model.ts';

export function findDevices(state: State, code: string): { product: Product; unit: Unit }[] {
  const serial = code.trim();
  if (!serial) return [];
  return Object.values(state.products).flatMap((product) =>
    Object.values(product.units)
      .filter((unit) => unit.serial.trim() === serial)
      .map((unit) => ({ product, unit })),
  );
}

export function deviceTrips(state: State, productId: string, unit: Unit) {
  return Object.values(state.trips)
    .flatMap((trip) => {
      const rows = trip.items.filter((i) => i.productId === productId);
      if (!rows.length) return [];
      const identified = rows.some(
        (i) => i.unitIds.includes(unit.id) || i.serialSnapshots.includes(unit.serial),
      );
      const outstanding = rows.some(
        (i) => i.unitIds.includes(unit.id) && !i.returnedUnitIds.includes(unit.id),
      );
      return [
        {
          trip,
          identified,
          outstanding: outstanding && !['closed', 'cancelled'].includes(trip.status),
        },
      ];
    })
    .sort((a, b) => b.trip.start.localeCompare(a.trip.start));
}
