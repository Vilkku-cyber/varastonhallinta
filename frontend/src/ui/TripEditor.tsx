import { DatePicker } from './DatePicker';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { type State, type Trip, type Item } from '../domain/model';
import { availability, today } from '../domain/calendar';
import { Dialog, Field, uid } from './shared';
export function TripEditor({
  state,
  trip,
  seed,
  save,
  close,
}: {
  state: State;
  trip?: Trip;
  seed?: Item[];
  save: (t: Trip) => Promise<void>;
  close: () => void;
}) {
  const [draft, setDraft] = useState<Trip>(() =>
    structuredClone(
      trip ?? {
        id: uid(),
        name: '',
        contact: '',
        start: today(),
        end: today(),
        status: 'planned',
        items: seed ?? [],
        notes: '',
        version: 0,
        imported: false,
        packingUnknown: false,
      },
    ),
  );
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const patch = (v: Partial<Trip>) => setDraft({ ...draft, ...v });
  const add = (p?: State['products'][string]) => {
    const existing = p && draft.items.find((i) => i.productId === p.id);
    if (existing) {
      patch({
        items: draft.items.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i)),
      });
      return;
    }
    patch({
      items: [
        ...draft.items,
        {
          id: uid(),
          type: p ? 'inventory' : 'custom',
          productId: p?.id ?? '',
          name: p?.name ?? '',
          quantity: 1,
          note: '',
          packed: 0,
          returned: 0,
          unitIds: [],
          returnedUnitIds: [],
          serialSnapshots: [],
        },
      ],
    });
  };
  return (
    <Dialog title={trip ? 'Muokkaa keikkaa' : 'Uusi keikka'} close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await save(draft);
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Keikan nimi">
          <input
            required
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Esim. seminaari / päälava"
          />
        </Field>
        <div className="form-grid">
          <Field label="Alkupäivä">
            <DatePicker
              required
              value={draft.start}
              onChange={(e) => patch({ start: e.target.value })}
            />
          </Field>
          <Field label="Loppupäivä">
            <DatePicker
              required
              min={draft.start}
              value={draft.end}
              onChange={(e) => patch({ end: e.target.value })}
            />
          </Field>
        </div>
        <p className="hint">
          Varaus koskee valittuja päiviä. Seuraavan päivän keikka voi käyttää samaa kalustoa.
        </p>
        <Field label="Yhteyshenkilö">
          <input value={draft.contact} onChange={(e) => patch({ contact: e.target.value })} />
        </Field>
        <div className="section-heading">
          <h3>Kalustovaraus</h3>
          <button type="button" className="secondary small" onClick={() => add()}>
            <Plus size={15} /> Muu tuote
          </button>
        </div>
        <input
          aria-label="Etsi lisättävä tuote"
          placeholder="Etsi kalustoa nimellä tai kategorialla…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <div className="picker">
            {Object.values(state.products)
              .filter(
                (p) =>
                  !p.retired &&
                  `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()),
              )
              .slice(0, 12)
              .map((p) => {
                let free: number | undefined;
                try {
                  free = availability(state, p.id, draft.start, draft.end, draft.id).available;
                } catch {}
                const selected = draft.items
                  .filter((i) => i.type === 'inventory' && i.productId === p.id)
                  .reduce((sum, i) => sum + i.quantity, 0);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      add(p);
                      setSearch('');
                    }}
                  >
                    <span>
                      {p.name}
                      <small style={{ display: 'block' }}>
                        {free === undefined
                          ? 'Valitse kelvollinen keikan aikaväli'
                          : `${free} kpl vapaana keikan ajalle`}
                        {selected > 0 && ` · keikalle valittu ${selected} kpl`}
                      </small>
                    </span>
                    <Plus size={16} />
                  </button>
                );
              })}
          </div>
        )}
        <div className="editor-items">
          {draft.items.map((i, index) => {
            let free: number | undefined;
            try {
              if (i.type === 'inventory')
                free = availability(state, i.productId, draft.start, draft.end, draft.id).available;
            } catch {}
            const change = (v: Partial<Item>) =>
              patch({ items: draft.items.map((it, n) => (n === index ? { ...it, ...v } : it)) });
            return (
              <div className="editor-item" key={i.id}>
                <div>
                  {i.type === 'custom' ? (
                    <input
                      aria-label="Muun tuotteen nimi"
                      required
                      placeholder="Muun tuotteen nimi"
                      value={i.name}
                      onChange={(e) => change({ name: e.target.value })}
                    />
                  ) : (
                    <strong>{i.name}</strong>
                  )}
                  <small className={free !== undefined && free < i.quantity ? 'danger-text' : ''}>
                    {i.type === 'custom'
                      ? 'Ulkopuolinen tavara · ei varastovarausta'
                      : i.type === 'legacy'
                        ? 'Tuoteyhteys pitää ratkaista'
                        : `${free ?? '–'} vapaana valitulle ajalle`}
                  </small>
                  <input
                    className="note-input"
                    aria-label={`Huomio: ${i.name}`}
                    placeholder="Huomio…"
                    value={i.note}
                    onChange={(e) => change({ note: e.target.value })}
                  />
                </div>
                <input
                  aria-label={`Määrä: ${i.name}`}
                  type="number"
                  min="1"
                  required
                  value={i.quantity}
                  onChange={(e) => change({ quantity: Number(e.target.value) })}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Poista ${i.name}`}
                  onClick={() => patch({ items: draft.items.filter((_, n) => n !== index) })}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
        <Field label="Keikan huomiot">
          <textarea value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </Field>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" className="secondary" onClick={close}>
            Peruuta
          </button>
          <button disabled={busy}>{busy ? 'Tallennetaan…' : 'Tallenna keikka'}</button>
        </footer>
      </form>
    </Dialog>
  );
}

