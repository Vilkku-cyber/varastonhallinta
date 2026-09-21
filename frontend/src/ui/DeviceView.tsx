import { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { type State, type Product, type Unit, statusLabels } from '../domain/model';
import { type Command } from '../domain/commands';
import { findDevices, deviceTrips } from '../domain/device';
import { formatDay } from '../domain/calendar';
import { Scanner } from './Scanner';
import { Field } from './shared';

export function DeviceView({
  state,
  run,
  select,
  edit,
}: {
  state: State;
  run: (command: Command) => Promise<void>;
  select: (id: string) => void;
  edit: (product: Product) => void;
}) {
  const [code, setCode] = useState('');
  const [searched, setSearched] = useState('');
  const [scanning, setScanning] = useState(false);
  const matches = findDevices(state, searched);
  const found = matches.length === 1 ? matches[0] : undefined;
  const lookup = (value: string) => {
    setCode(value.trim());
    setSearched(value.trim());
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">TUNNISTA JA TARKISTA</p>
          <h1>Laitteen tiedot</h1>
        </div>
        <button onClick={() => setScanning(true)}>
          <ScanLine size={18} /> Lue QR-koodi
        </button>
      </div>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(code);
        }}
      >
        <Field label="Sarjanumero">
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Skannaa lukijalla tai kirjoita sarjanumero"
          />
        </Field>
        <button>Hae laite</button>
      </form>
      {!searched && (
        <p className="hint">
          Lue laitteen QR-tarra kameralla tai syötä sarjanumero. Myös USB-lukija toimii
          hakukentässä.
        </p>
      )}
      {searched && !found && (
        <p role="alert" className="error">
          {matches.length > 1
            ? 'Sarjanumero löytyy usealta laitteelta. Korjaa kalustorekisterin päällekkäiset numerot ennen muokkaamista.'
            : `Sarjanumerolla ${searched} ei löytynyt laitetta.`}
        </p>
      )}
      {found && (
        <DeviceCard
          key={`${found.product.id}/${found.unit.id}`}
          {...found}
          state={state}
          run={run}
          select={select}
          edit={edit}
        />
      )}
      {scanning && <Scanner scan={lookup} close={() => setScanning(false)} />}
    </>
  );
}

function DeviceCard({
  product,
  unit,
  state,
  run,
  select,
  edit,
}: {
  product: Product;
  unit: Unit;
  state: State;
  run: (command: Command) => Promise<void>;
  select: (id: string) => void;
  edit: (product: Product) => void;
}) {
  const [draft, setDraft] = useState<{
    condition: Unit['condition'];
    notes: string;
    version: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const history = deviceTrips(state, product.id, unit);
  const identified = history.filter((h) => h.identified);
  const modelTrips = history.filter((h) => !h.identified);
  const locations = Object.values(state.placements)
    .filter((p) => p.productId === product.id)
    .map((p) => state.locations[p.locationId])
    .filter(Boolean);
  const change = (patch: Partial<Unit>) =>
    setDraft({
      condition: unit.condition,
      notes: unit.notes,
      version: product.version,
      ...draft,
      ...patch,
    });
  const trips = (rows: typeof history) =>
    rows.length ? (
      <ul>
        {rows.map(({ trip, outstanding }) => (
          <li key={trip.id}>
            <button className="text-button" onClick={() => select(trip.id)}>
              {trip.name}
            </button>
            <p>
              {formatDay(trip.start)} – {formatDay(trip.end)} · {statusLabels[trip.status]}
              {outstanding ? ' · Yksilö palauttamatta' : ''}
            </p>
          </li>
        ))}
      </ul>
    ) : (
      <p>Ei kirjattuja keikkoja.</p>
    );
  return (
    <>
      <section className="panel">
        <h2>{product.name}</h2>
        <p>
          Sarjanumero: <strong>{unit.serial}</strong>
        </p>
        <dl>
          <dt>Kategoria</dt>
          <dd>{product.category}</dd>
          <dt>Mitat</dt>
          <dd>{product.dimensions || 'Ei kirjattu'}</dd>
          <dt>Paino</dt>
          <dd>{product.weight || 'Ei kirjattu'}</dd>
          <dt>Kunto</dt>
          <dd>{unit.condition === 'ready' ? 'Käyttökunnossa' : 'Huollossa / pois käytöstä'}</dd>
          <dt>Mallin hyllypaikat</dt>
          <dd>
            {locations.map((l) => `${l.shelf} / ${l.aisle} / ${l.level}`).join(', ') ||
              'Ei kirjattu'}
          </dd>
        </dl>
        {product.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{product.notes}</p>}
        {product.retired && <p className="error">Malli on poistettu aktiivikäytöstä.</p>}
        <button className="secondary" onClick={() => edit(product)}>
          Muokkaa mallin tietoja
        </button>
      </section>
      <section className="panel">
        <h2>Kunto ja vauriot</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft) return;
            setBusy(true);
            setError('');
            setMessage('');
            try {
              await run({
                type: 'unitCondition',
                productId: product.id,
                unitId: unit.id,
                condition: draft.condition,
                notes: draft.notes,
                expected: draft.version,
              });
              setDraft(null);
              setMessage('Laitteen tiedot tallennettu.');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Laitteen kunto">
            <select
              value={draft?.condition ?? unit.condition}
              onChange={(e) => change({ condition: e.target.value as Unit['condition'] })}
            >
              <option value="ready">Käyttökunnossa</option>
              <option value="maintenance">Huollossa / pois käytöstä</option>
            </select>
          </Field>
          <Field label="Vauriot ja huomiot">
            <textarea
              rows={4}
              value={draft?.notes ?? unit.notes}
              onChange={(e) => change({ notes: e.target.value })}
            />
          </Field>
          <p className="hint">
            Huollossa olevaa laitetta ei voi pakata uudelle keikalle. Kuntomerkintä ei kuittaa
            laitetta palautetuksi.
          </p>
          {draft && draft.version !== product.version && (
            <p role="alert" className="error">
              Tiedot muuttuivat toisella laitteella. Lataa uusimmat tiedot ennen tallennusta.
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <button disabled={busy || !draft || draft.version !== product.version}>
            {busy ? 'Tallennetaan…' : 'Tallenna laitteen tiedot'}
          </button>
          {draft && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setError('');
              }}
            >
              Lataa tallennetut tiedot
            </button>
          )}
        </form>
      </section>
      <section className="panel">
        <h2>Yksilölle kirjatut keikat</h2>
        {trips(identified)}
      </section>
      <details className="panel">
        <summary>Mallin muut keikat ({modelTrips.length})</summary>
        <p className="hint">
          Näillä keikoilla on samaa mallia. Tämän yksilön käyttöä ei ole vahvistettu sarjanumerolla.
          Mukana ovat myös suunnitellut varaukset.
        </p>
        {trips(modelTrips)}
      </details>
    </>
  );
}
