import { useState } from 'react';
import { type Product } from '../domain/model';
import { Dialog, Field, uid } from './shared';
export function ProductEditor({
  product,
  save,
  close,
}: {
  product?: Product;
  save: (p: Product) => Promise<void>;
  close: () => void;
}) {
  const [p, set] = useState<Product>(() =>
    structuredClone(
      product ?? {
        id: uid(),
        name: '',
        category: 'Muu',
        total: 1,
        maintenance: 0,
        tracking: 'quantity',
        units: {},
        notes: '',
        dimensions: '',
        weight: '',
        retired: false,
        review: false,
        version: 0,
      },
    ),
  );
  const [serials, ss] = useState(
    Object.values(p.units)
      .map((u) => u.serial)
      .join('\n'),
  );
  const [error, se] = useState('');
  const [busy, sb] = useState(false);
  const patch = (v: Partial<Product>) => set({ ...p, ...v });
  return (
    <Dialog title={product ? 'Kaluston tiedot' : 'Lisää kalustoa'} close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          sb(true);
          try {
            const units: Product['units'] = {};
            for (const serial of serials
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)) {
              const old = Object.values(p.units).find((u) => u.serial === serial);
              const id = old?.id ?? uid();
              units[id] = old ?? { id, serial, condition: 'ready', notes: '' };
            }
            await save({ ...p, units });
            close();
          } catch (e) {
            se((e as Error).message);
          } finally {
            sb(false);
          }
        }}
      >
        <Field label="Tuotteen nimi">
          <input required value={p.name} onChange={(e) => patch({ name: e.target.value })} />
        </Field>
        <div className="form-grid">
          <Field label="Kategoria">
            <input
              required
              value={p.category}
              onChange={(e) => patch({ category: e.target.value })}
            />
          </Field>
          <Field label="Seurantatapa">
            <select
              value={p.tracking}
              onChange={(e) => patch({ tracking: e.target.value as Product['tracking'] })}
            >
              <option value="quantity">Kappalemäärä</option>
              <option value="serial">Sarjanumerot</option>
            </select>
          </Field>
        </div>
        {p.tracking === 'quantity' ? (
          <div className="form-grid">
            <Field label="Kokonaismäärä">
              <input
                type="number"
                min="0"
                required
                value={p.total}
                onChange={(e) => patch({ total: Number(e.target.value) })}
              />
            </Field>
            <Field label="Huollossa">
              <input
                type="number"
                min="0"
                max={p.total}
                value={p.maintenance}
                onChange={(e) => patch({ maintenance: Number(e.target.value) })}
              />
            </Field>
          </div>
        ) : (
          <>
            <Field label="Sarjanumerot, yksi per rivi">
              <textarea rows={5} value={serials} onChange={(e) => ss(e.target.value)} />
            </Field>
            {Object.values(p.units).map((u) => (
              <div className="unit-row" key={u.id}>
                <span>{u.serial}</span>
                <select
                  aria-label={`Kunto ${u.serial}`}
                  value={u.condition}
                  onChange={(e) =>
                    patch({
                      units: {
                        ...p.units,
                        [u.id]: { ...u, condition: e.target.value as 'ready' | 'maintenance' },
                      },
                    })
                  }
                >
                  <option value="ready">Käyttökunnossa</option>
                  <option value="maintenance">Huollossa</option>
                </select>
                <input
                  aria-label={`Vauriot ${u.serial}`}
                  placeholder="Vauriot / huomio"
                  value={u.notes}
                  onChange={(e) =>
                    patch({ units: { ...p.units, [u.id]: { ...u, notes: e.target.value } } })
                  }
                />
              </div>
            ))}
          </>
        )}
        <div className="form-grid">
          <Field label="Mitat">
            <input value={p.dimensions} onChange={(e) => patch({ dimensions: e.target.value })} />
          </Field>
          <Field label="Paino">
            <input value={p.weight} onChange={(e) => patch({ weight: e.target.value })} />
          </Field>
        </div>
        <Field label="Lisätiedot">
          <textarea value={p.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={p.retired}
            onChange={(e) => patch({ retired: e.target.checked })}
          />{' '}
          Poistettu aktiivikäytöstä
        </label>
        {product?.review && (
          <label className="check">
            <input
              type="checkbox"
              checked={!p.review}
              onChange={(e) => patch({ review: !e.target.checked })}
            />{' '}
            Olen tarkistanut tuodun tuotteen määrän ja sarjanumerot
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" className="secondary" onClick={close}>
            Peruuta
          </button>
          <button disabled={busy}>Tallenna kalusto</button>
        </footer>
      </form>
    </Dialog>
  );
}
