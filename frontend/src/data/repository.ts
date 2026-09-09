import { type State, emptyState } from '../domain/model.ts';
import { applyCommand, type Command } from '../domain/commands.ts';
import { demoState } from '../domain/seed.ts';
export interface Repository {
  mode: 'local' | 'firebase';
  subscribe(fn: (s: State) => void, error: (e: Error) => void): () => void;
  dispatch(c: Command): Promise<void>;
  importLocal?(s: State, source: unknown): Promise<void>;
  backup(): Promise<unknown>;
}
// RTDB removes empty maps and arrays. Restore the domain shape at this boundary.
export function hydrate(raw: Partial<State> | null): State {
  const s = { ...emptyState(), ...raw };
  for (const field of [
    'products',
    'trips',
    'locations',
    'placements',
    'tasks',
    'receipts',
  ] as const)
    s[field] ??= {};
  s.events ??= [];
  s.reviews ??= [];
  for (const p of Object.values(s.products)) p.units ??= {};
  for (const t of Object.values(s.trips)) {
    t.items ??= [];
    for (const i of t.items) {
      i.unitIds ??= [];
      i.returnedUnitIds ??= [];
      i.serialSnapshots ??= [];
    }
  }
  return s;
}
export class LocalRepository implements Repository {
  mode = 'local' as const;
  private channel: BroadcastChannel;
  private listeners = new Set<(s: State) => void>();
  private db: Promise<IDBDatabase>;
  constructor(name = 'av-arsenal-v2') {
    this.channel = new BroadcastChannel(name);
    this.db = new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('state');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    this.channel.onmessage = () => {
      this.read()
        .then((s) => this.listeners.forEach((fn) => fn(s)))
        .catch(() => {});
    };
  }
  async dispose() {
    this.channel.close();
    (await this.db).close();
    this.listeners.clear();
  }
  private async read() {
    const db = await this.db;
    return new Promise<State>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      const store = tx.objectStore('state');
      const r = store.get('current');
      let state: State;
      r.onsuccess = () => {
        state = r.result ?? demoState();
        if (!r.result) store.put(state, 'current');
      };
      tx.oncomplete = () => resolve(hydrate(state));
      tx.onerror = () => reject(tx.error);
    });
  }
  subscribe(fn: (s: State) => void, error: (e: Error) => void) {
    let alive = true;
    this.listeners.add(fn);
    this.read()
      .then((s) => {
        if (alive) fn(s);
      })
      .catch(error);
    return () => {
      alive = false;
      this.listeners.delete(fn);
    };
  }
  async dispatch(c: Command) {
    await this.mutate((s) => applyCommand(s, c, crypto.randomUUID(), new Date().toISOString()));
  }
  private async mutate(fn: (s: State) => State, source?: unknown) {
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      const store = tx.objectStore('state');
      let failure: unknown;
      store.get('current').onsuccess = (e) => {
        try {
          const before = (e.target as IDBRequest).result ?? demoState();
          const next = fn(hydrate(before));
          if (source !== undefined) {
            store.put(before, 'beforeImport');
            store.put(source, 'legacySource');
          }
          store.put(next, 'current');
        } catch (e) {
          failure = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(failure ?? tx.error ?? Error('Tallennus keskeytyi.'));
      tx.onerror = () => reject(tx.error);
    });
    const s = await this.read();
    this.listeners.forEach((fn) => fn(s));
    this.channel.postMessage('changed');
  }
  async importLocal(s: State, source: unknown) {
    await this.mutate(() => s, source);
  }
  async backup() {
    const db = await this.db;
    const current = await this.read();
    return new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('state', 'readonly');
      const request = tx.objectStore('state').get('legacySource');
      request.onsuccess = () =>
        resolve({
          format: 'av-arsenal-backup',
          version: 2,
          state: current,
          legacySource: request.result ?? null,
        });
      request.onerror = () => reject(request.error);
    });
  }
}
