import type { Location, Placement, State } from './model.ts';
export const locationLabel = (l: Location) => `${l.shelf} / ${l.aisle} / ${l.level}`;
const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('fi');
export type ShelfResult = { location: Location; placement: Placement | null; name: string };
export function searchWarehouse(state: State, query: string): ShelfResult[] {
  const text = normalize(query);
  if (!text) return [];
  const result: ShelfResult[] = [];
  for (const location of Object.values(state.locations)) {
    const address = [
      locationLabel(location),
      `${location.shelf}${location.aisle}${location.level}`,
    ];
    const locationMatch = address.some((v) => normalize(v).includes(text));
    const placements = Object.values(state.placements).filter((p) => p.locationId === location.id);
    if (!placements.length && locationMatch)
      result.push({ location, placement: null, name: 'Tyhjä hyllypaikka' });
    for (const placement of placements) {
      const product = state.products[placement.productId];
      const fields = [
        placement.label,
        product?.name ?? '',
        product?.category ?? '',
        product?.notes ?? '',
        ...Object.values(product?.units ?? {}).map((u) => u.serial),
      ];
      if (locationMatch || fields.some((value) => normalize(value).includes(text)))
        result.push({ location, placement, name: product?.name ?? placement.label });
    }
  }
  return result.sort(
    (a, b) =>
      locationLabel(a.location).localeCompare(locationLabel(b.location), 'fi', { numeric: true }) ||
      a.name.localeCompare(b.name, 'fi'),
  );
}
export function shelfElevation(state: State, shelf: string) {
  const locations = Object.values(state.locations).filter((l) => l.shelf === shelf);
  const direction = locations[0]?.direction === 'rtl' ? 'rtl' : 'ltr';
  const aisles = [...new Set(locations.map((l) => l.aisle))].sort((a, b) =>
    a.localeCompare(b, 'fi', { numeric: true }),
  );
  if (direction === 'rtl') aisles.reverse();
  return {
    direction,
    aisles: aisles.map((aisle) => ({
      aisle,
      levels: locations
        .filter((l) => l.aisle === aisle)
        .sort((a, b) => b.level.localeCompare(a.level, 'fi', { numeric: true })),
    })),
  };
}
