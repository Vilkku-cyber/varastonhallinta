export type Status = 'draft' | 'planned' | 'packed' | 'out' | 'returning' | 'closed' | 'cancelled';
export type Unit = {
  id: string;
  serial: string;
  condition: 'ready' | 'maintenance';
  notes: string;
};
export type Product = {
  id: string;
  name: string;
  category: string;
  total: number;
  maintenance: number;
  tracking: 'quantity' | 'serial';
  units: Record<string, Unit>;
  notes: string;
  dimensions: string;
  weight: string;
  retired: boolean;
  review: boolean;
  version: number;
};
export type Item = {
  id: string;
  type: 'inventory' | 'custom' | 'legacy';
  productId: string;
  name: string;
  quantity: number;
  note: string;
  packed: number;
  returned: number;
  unitIds: string[];
  returnedUnitIds: string[];
  serialSnapshots: string[];
};
export type Trip = {
  manualClosure?: {
    at: string;
    previousStatus: Status;
    previousReturns: { itemId: string; returned: number; returnedUnitIds: string[] }[];
  };
  id: string;
  name: string;
  contact: string;
  start: string;
  end: string;
  status: Status;
  items: Item[];
  notes: string;
  version: number;
  imported: boolean;
  packingUnknown: boolean;
};
export type Location = {
  id: string;
  shelf: string;
  aisle: string;
  level: string;
  direction: string;
};
export type Placement = { id: string; locationId: string; productId: string; label: string };
export type Task = { id: string; text: string; done: boolean };
export type Review = { id: string; path: string; message: string };
export type State = {
  migration?: { importedAt: string; sourceHash: string; source: unknown; previousState: unknown };
  schemaVersion: 2;
  revision: number;
  products: Record<string, Product>;
  trips: Record<string, Trip>;
  locations: Record<string, Location>;
  placements: Record<string, Placement>;
  tasks: Record<string, Task>;
  reviews: Review[];
  receipts: Record<string, string>;
  events: { id: string; at: string; text: string }[];
};
export const emptyState = (): State => ({
  schemaVersion: 2,
  revision: 0,
  products: {},
  trips: {},
  locations: {},
  placements: {},
  tasks: {},
  reviews: [],
  receipts: {},
  events: [],
});
export const statusLabels: Record<Status, string> = {
  draft: 'Luonnos',
  planned: 'Pakkaamatta',
  packed: 'Pakattu',
  out: 'Keikalla',
  returning: 'Purkamatta',
  closed: 'Palautettu',
  cancelled: 'Peruttu',
};
export const active = (t: Trip) => !['closed', 'cancelled', 'draft'].includes(t.status);
export const open = (t: Trip) => !['closed', 'cancelled'].includes(t.status);
