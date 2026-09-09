import type { State } from './model.ts';
import { importLegacy } from './importLegacy.ts';
import { parseBackup } from './backup.ts';

export const legacyPaths = ['inventory', 'keikat', 'archived-trips', 'shelves', 'todo'] as const;
export type LegacyPreview = {
  source: Record<string, unknown>;
  sourceHash: string;
  state: State;
  previous: State;
  preparedAt: string;
};
export function isDemoWorkspace(state: State) {
  return (
    !state.migration &&
    state.events.some((e) => e.id === 'demo-setup') &&
    !Object.values(state.trips).some((t) => t.imported)
  );
}
function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + Array.from(value, canonical).join(',') + ']';
  return (
    '{' +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}
export async function sourceHash(source: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(source)));
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
}
export function prepareLegacy(
  source: Record<string, unknown>,
  previous: State,
  hash: string,
): LegacyPreview {
  if (!isDemoWorkspace(previous))
    throw Error('Tuonti voi korvata vain esimerkkiaineistosta aloitetun testityötilan.');
  const state = importLegacy(source);
  if (!Object.keys(state.products).length)
    throw Error('Vanhasta kannasta ei löytynyt tuotteita. Tuonti keskeytettiin.');
  parseBackup({ format: 'av-arsenal-backup', version: 2, state });
  return {
    source: structuredClone(source),
    sourceHash: hash,
    state,
    previous: structuredClone(previous),
    preparedAt: new Date().toISOString(),
  };
}
export function replaceDemo(current: State, preview: LegacyPreview): State {
  if (!isDemoWorkspace(current) || current.revision !== preview.previous.revision)
    throw Error('2.0-työtila muuttui esikatselun jälkeen. Lue tuonti uudelleen.');
  const state = structuredClone(preview.state);
  state.revision = current.revision + 1;
  state.migration = {
    importedAt: preview.preparedAt,
    sourceHash: preview.sourceHash,
    source: preview.source,
    previousState: preview.previous,
  };
  state.events = [
    {
      id: 'legacy-import',
      at: preview.preparedAt,
      text: 'Vanhan verkkokannan aineisto tuotu. Testiaineisto ja alkuperäinen lähde säilyvät varmuuskopiossa.',
    },
  ];
  return state;
}
