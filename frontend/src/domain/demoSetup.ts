import { demoState } from './seed.ts';

// A transaction may retry with newer server data. Never replace an existing state.
export function initialDemo(current: unknown) {
  if (current !== null) return undefined;
  const state = demoState();
  state.revision = 1;
  for (const product of Object.values(state.products)) product.name = `[TESTI] ${product.name}`;
  for (const trip of Object.values(state.trips)) {
    trip.name = `[TESTI] ${trip.name}`;
    for (const item of trip.items) item.name = state.products[item.productId]?.name ?? item.name;
  }
  state.events = [
    {
      id: 'demo-setup',
      at: new Date().toISOString(),
      text: 'Verkkotestin esimerkkiaineisto alustettu. Ei oikeaa varastoaineistoa.',
    },
  ];
  return state;
}
