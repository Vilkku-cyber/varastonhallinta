import { useState } from 'react';
import { ArrowLeft, Printer, Camera, ScanLine, Pencil } from 'lucide-react';
import { type State, type Trip, type Status, statusLabels } from '../domain/model';
import { formatDay } from '../domain/calendar';
import { type Command } from '../domain/commands';
import { Scanner } from './Scanner';
export function TripDetail({
  state,
  trip: t,
  back,
  edit,
  run,
}: {
  state: State;
  trip: Trip;
  back: () => void;
  edit: () => void;
  run: (c: Command) => Promise<void>;
}) {
  const [serial, setSerial] = useState('');
  const [scan, setScan] = useState(false);
  const [error, se] = useState('');
  const [busy, sb] = useState(false);
  const [damaged, sd] = useState(false);
  const act = async (c: Command) => {
    sb(true);
    se('');
    try {
      await run(c);
    } catch (e) {
      se((e as Error).message);
    } finally {
      sb(false);
    }
  };
  const returns = ['out', 'returning'].includes(t.status);
  const closed = ['closed', 'cancelled', 'draft'].includes(t.status);
  const scanSerial = (value: string) => {
    setSerial(value);
    const p = Object.values(state.products).find((p) =>
      Object.values(p.units).some((u) => u.serial === value.trim()),
    );
    const unit = p && Object.values(p.units).find((u) => u.serial === value.trim());
    const row = p && t.items.find((i) => i.productId === p.id);
    if (!row || !unit) {
      se('Sarjanumeroa ei löydy tämän keikan kalustosta.');
      return;
    }
    void act(
      returns
        ? {
            type: 'return',
            tripId: t.id,
            itemId: row.id,
            unitId: unit.id,
            damaged,
            expected: t.version,
          }
        : { type: 'pack', tripId: t.id, itemId: row.id, unitId: unit.id, expected: t.version },
    ).then(() => setSerial(''));
  };
  const next: Partial<Record<Status, Status>> = {
    draft: 'planned',
    planned: 'packed',
    packed: 'out',
    out: 'returning',
    returning: 'closed',
  };
  return (
    <>
      <div className="page-heading no-print">
        <button className="secondary" onClick={back}>
          <ArrowLeft size={16} /> Keikat
        </button>
        <div className="actions">
          <button className="secondary" onClick={() => window.print()}>
            <Printer size={16} /> Lähetyslista
          </button>
          {!['closed', 'cancelled'].includes(t.status) && (
            <button className="secondary" onClick={edit}>
              <Pencil size={16} /> Muokkaa
            </button>
          )}
        </div>
      </div>
      <div className="trip-title">
        <div>
          <p className="eyebrow">KEIKAN TYÖTILA</p>
          <h1>{t.name}</h1>
          <p>
            {formatDay(t.start)} – {formatDay(t.end)} · {t.contact || 'Ei yhteyshenkilöä'}
          </p>
        </div>
        <span className={`badge ${t.status}`}>{statusLabels[t.status]}</span>
      </div>
      <div className="print-only">
        <h2>Lähetyslista</h2>
        <p>
          AV-arsenal · {t.id} · versio {t.version}
        </p>
      </div>
      <div className="workflow no-print">
        {(['planned', 'packed', 'out', 'returning', 'closed'] as Status[]).map((v, n) => (
          <span key={v} className={v === t.status ? 'current' : ''}>
            <b>{n + 1}</b>
            {statusLabels[v]}
          </span>
        ))}
      </div>
      {t.packingUnknown && (
        <p className="notice">
          Vanhan keikan pakkaustietoa ei ole tallennettu. Suunnitelma ja toteuma pidetään erillään.
        </p>
      )}
      {!closed && (
        <div className="scan-bar no-print">
          <ScanLine size={24} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scanSerial(serial);
            }}
          >
            <input
              aria-label="Sarjanumero"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder={
                returns
                  ? 'Palautettavan laitteen sarjanumero…'
                  : 'Skannaa tai kirjoita sarjanumero…'
              }
            />
            <button disabled={busy || !serial}>{returns ? 'Palauta' : 'Pakkaa'}</button>
          </form>
          <button className="secondary" onClick={() => setScan(true)}>
            <Camera size={18} /> Kamera
          </button>
          {returns && (
            <label className="check">
              <input type="checkbox" checked={damaged} onChange={(e) => sd(e.target.checked)} />{' '}
              Palautus huoltoon
            </label>
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>{returns ? 'Palautettava kalusto' : 'Kalusto ja pakkaus'}</h2>
          <span>
            {t.items.reduce((n, i) => n + i.packed, 0)} /{' '}
            {t.items.reduce((n, i) => n + i.quantity, 0)} pakattu
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tuote / yksilöt</th>
                <th>Varattu</th>
                <th>Pakattu</th>
                <th>Palautettu</th>
                <th className="no-print">Toiminto</th>
              </tr>
            </thead>
            <tbody>
              {t.items.map((i) => {
                const p = state.products[i.productId];
                const serialMode = p?.tracking === 'serial';
                return (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.name}</strong>
                      <small>{i.note}</small>
                      <small>
                        {Object.values(state.placements)
                          .filter((l) => l.productId === i.productId)
                          .map((l) => state.locations[l.locationId])
                          .filter(Boolean)
                          .map((l) => `${l.shelf} / ${l.aisle} / ${l.level}`)
                          .join(' · ')}
                      </small>
                      <div className="serial-list">
                        {i.serialSnapshots.map((serial, n) => {
                          const unitId = i.unitIds[n];
                          return (
                            <span key={serial}>
                              {serial}
                              {i.returnedUnitIds.includes(unitId) ? ' ✓' : ''}
                              {!closed && unitId && !returns && (
                                <button
                                  aria-label={`Poista pakkaus ${serial}`}
                                  onClick={() =>
                                    void act({
                                      type: 'pack',
                                      tripId: t.id,
                                      itemId: i.id,
                                      unitId,
                                      remove: true,
                                      expected: t.version,
                                    })
                                  }
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td>{i.quantity}</td>
                    <td>
                      <b className={i.packed >= i.quantity ? 'success-text' : ''}>{i.packed}</b>
                    </td>
                    <td>{i.returned}</td>
                    <td className="no-print">
                      {!closed &&
                        i.type !== 'legacy' &&
                        (serialMode ? (
                          <small>Käytä sarjanumeroa</small>
                        ) : returns ? (
                          <button
                            className="secondary small"
                            disabled={busy || i.returned >= i.packed}
                            onClick={() =>
                              void act({
                                type: 'return',
                                tripId: t.id,
                                itemId: i.id,
                                quantity: 1,
                                damaged,
                                expected: t.version,
                              })
                            }
                          >
                            Palauta 1
                          </button>
                        ) : (
                          <div className="counter">
                            <button
                              disabled={busy || i.packed === 0}
                              aria-label={`Vähennä pakkausta ${i.name}`}
                              onClick={() =>
                                void act({
                                  type: 'pack',
                                  tripId: t.id,
                                  itemId: i.id,
                                  quantity: i.packed - 1,
                                  expected: t.version,
                                })
                              }
                            >
                              −
                            </button>
                            <button
                              disabled={busy || i.packed >= i.quantity}
                              aria-label={`Pakkaa yksi ${i.name}`}
                              onClick={() =>
                                void act({
                                  type: 'pack',
                                  tripId: t.id,
                                  itemId: i.id,
                                  quantity: i.packed + 1,
                                  expected: t.version,
                                })
                              }
                            >
                              +
                            </button>
                            <button
                              className="small secondary"
                              disabled={busy || i.packed === i.quantity}
                              onClick={() =>
                                void act({
                                  type: 'pack',
                                  tripId: t.id,
                                  itemId: i.id,
                                  quantity: i.quantity,
                                  expected: t.version,
                                })
                              }
                            >
                              Kaikki
                            </button>
                          </div>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="detail-footer no-print">
        <p>{t.notes}</p>
        <div className="actions">
          {['draft', 'planned'].includes(t.status) && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void act({ type: 'status', tripId: t.id, status: 'cancelled', expected: t.version })
              }
            >
              Peru keikka
            </button>
          )}
          {next[t.status] && (
            <button
              disabled={busy}
              onClick={() =>
                void act({
                  type: 'status',
                  tripId: t.id,
                  status: next[t.status]!,
                  expected: t.version,
                })
              }
            >
              {
                (
                  {
                    draft: 'Vahvista varaus',
                    planned: 'Merkitse pakatuksi',
                    packed: 'Lähetä keikalle',
                    out: 'Aloita palautus',
                    returning: 'Sulje palautettu keikka',
                  } as Record<string, string>
                )[t.status]
              }
            </button>
          )}
        </div>
      </div>
      {scan && <Scanner scan={scanSerial} close={() => setScan(false)} />}
    </>
  );
}
