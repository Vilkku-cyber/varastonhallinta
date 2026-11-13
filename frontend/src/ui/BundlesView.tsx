import { useState, useEffect } from 'react';
import { type State, type PackingBundle, statusLabels } from '../domain/model';
import { type Command } from '../domain/commands';
import { bundleForTrip, bundleRows, type BundleCommand } from '../domain/bundles';
import { findDevices } from '../domain/device';
import { formatDay } from '../domain/calendar';
import { Scanner } from './Scanner';
import { Field, uid } from './shared';

export function BundlesView({
  state,
  run,
  select,
}: {
  state: State;
  run: (c: Command) => Promise<void>;
  select: (id: string) => void;
}) {
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bundle = state.bundles?.[selected];
  if (bundle)
    return (
      <BundleDetail
        key={bundle.id}
        state={state}
        bundle={bundle}
        run={run}
        select={select}
        back={() => setSelected('')}
      />
    );
  const eligible = Object.values(state.trips)
    .filter((t) => ['planned', 'packed'].includes(t.status) && !bundleForTrip(state, t.id))
    .sort((a, b) => a.start.localeCompare(b.start));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">USEITA ASIAKKAITA · YKSI AUTOKUORMA</p>
          <h1>Pakkausniput</h1>
        </div>
      </div>
      <section className="panel">
        <h2>Uusi pakkausnippu</h2>
        <p>
          Valitse saman tapahtuman keikat. Keikat ja varaukset säilyvät erillisinä. Sarjanumerot voi
          kohdistaa asiakkaille vasta paikan päällä.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const id = uid();
            try {
              await run({ type: 'bundleCreate', id, name, tripIds: ids });
              setSelected(id);
              setName('');
              setIds([]);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Nipun nimi">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tapahtuma / auto"
            />
          </Field>
          {eligible.map((t) => (
            <label className="check" key={t.id}>
              <input
                type="checkbox"
                checked={ids.includes(t.id)}
                onChange={(e) =>
                  setIds(e.target.checked ? [...ids, t.id] : ids.filter((id) => id !== t.id))
                }
              />
              {t.name} · {t.contact || 'Ei yhteyshenkilöä'} · {formatDay(t.start)} –{' '}
              {formatDay(t.end)}
            </label>
          ))}
          {!eligible.length && <p>Ei niputettavia keikkoja. Luo ensin asiakkaiden keikat.</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button disabled={busy || ids.length < 2}>Luo pakkausnippu</button>
        </form>
      </section>
      <section className="panel">
        <h2>Pakkausniput</h2>
        {Object.values(state.bundles ?? {})
          .reverse()
          .map((b) => (
            <p key={b.id}>
              <button className="secondary" onClick={() => setSelected(b.id)}>
                {b.name} · {b.tripIds.length} keikkaa ·{' '}
                {b.closed ? 'Päätetty' : b.departed ? 'Tapahtumassa' : 'Pakkauksessa'}
              </button>
            </p>
          ))}
      </section>
    </>
  );
}
function BundleDetail({
  state,
  bundle: b,
  run,
  select,
  back,
}: {
  state: State;
  bundle: PackingBundle;
  run: (c: Command) => Promise<void>;
  select: (id: string) => void;
  back: () => void;
}) {
  const [target, setTarget] = useState('');
  const [serial, setSerial] = useState('');
  const [mode, setMode] = useState<'load' | 'assign' | 'returnUnit'>('load');
  const [damaged, setDamaged] = useState(false);
  const [returnConfirm, setReturnConfirm] = useState<{
    command: BundleCommand;
    count: number;
  } | null>(null);
  useEffect(() => {
    if (b.departed) setMode('assign');
  }, [b.departed]);
  const [camera, setCamera] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (c: BundleCommand) => {
    setBusy(true);
    setError('');
    try {
      await run(c);
      setSerial('');
      setReturnConfirm(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const command = (action: 'depart' | 'close'): BundleCommand => ({
    type: 'bundle',
    id: b.id,
    expected: b.version,
    action,
  });
  const scan = (code: string) => {
    const found = findDevices(state, code);
    if (found.length !== 1) {
      setError('Sarjanumerolla ei löytynyt yhtä yksiselitteistä laitetta.');
      return;
    }
    const { product, unit } = found[0];
    if (mode === 'returnUnit') {
      void act({
        type: 'bundle',
        id: b.id,
        expected: b.version,
        action: 'returnUnit',
        productId: product.id,
        unitId: unit.id,
        damaged,
      });
      return;
    }
    const t = state.trips[target];
    const i = t?.items.find((i) => i.type === 'inventory' && i.productId === product.id);
    if (mode === 'assign' && !i) {
      setError('Valitse asiakas, jonka keikalla on tämän mallin kalustorivi.');
      return;
    }
    void act({
      type: 'bundle',
      id: b.id,
      expected: b.version,
      action: mode,
      productId: product.id,
      unitId: unit.id,
      ...(mode === 'assign' ? { tripId: t.id, itemId: i!.id, tripVersion: t.version } : {}),
    });
  };
  const rows = bundleRows(state, b);
  return (
    <>
      <button className="text-button" onClick={back}>
        ← Pakkausniput
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {b.closed ? 'PÄÄTETTY' : b.departed ? 'TAPAHTUMASSA' : 'PAKKAUKSESSA'}
          </p>
          <h1>{b.name}</h1>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!b.closed && (
        <section className="panel">
          <h2>Skannaa tai syötä sarjanumero</h2>
          <Field label="Toiminto">
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="load" disabled={b.departed}>
                Pakkaa autoon, asiakas valitaan myöhemmin
              </option>
              <option value="assign">Kohdista nipusta asiakkaalle</option>
              <option value="returnUnit" disabled={!b.departed}>
                Palauta sarjanumerolla oikealle asiakkaalle
              </option>
            </select>
          </Field>
          {mode !== 'returnUnit' && (
            <Field label="Asiakkaan keikka">
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Valitse asiakkaan keikka</option>
                {b.tripIds.map((id) => (
                  <option key={id} value={id}>
                    {state.trips[id]?.name} · {state.trips[id]?.contact}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {mode === 'returnUnit' && (
            <>
              <p>
                Asiakkaan keikka tunnistetaan sarjanumerosta automaattisesti. Sama laite palautetaan
                vain kerran.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={damaged}
                  onChange={(e) => setDamaged(e.target.checked)}
                />
                Palautettava laite on vaurioitunut — siirrä huoltoon
              </label>
            </>
          )}
          <form
            className="filters"
            onSubmit={(e) => {
              e.preventDefault();
              scan(serial);
            }}
          >
            <input
              aria-label="Nipun sarjanumero"
              required
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Sarjanumero / USB-lukija"
            />
            <button disabled={busy}>
              {mode === 'load'
                ? 'Pakkaa autoon'
                : mode === 'returnUnit'
                  ? 'Palauta laite'
                  : 'Kohdista asiakkaalle'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setCamera(true)}
            >
              Lue QR-koodi
            </button>
          </form>
          <p className="hint">
            {mode === 'returnUnit'
              ? 'Skannaa varastoon palannut laite. Palautus kirjataan sen asiakkaan keikalle, jolle sarjanumero on kohdistettu.'
              : 'Pakkaa ensin nippuun. Valitse paikan päällä asiakkaan keikka, vaihda toiminnoksi kohdistus ja skannaa asiakkaalle annettava laite.'}
          </p>
        </section>
      )}
      <section className="panel">
        <h2>Yhteinen pakkauslista</h2>
        <p>
          Määrät sisältävät kaikkien nipun asiakkaiden kaluston. Kohdistus siirtää jo pakattua
          kalustoa asiakkaalle.
        </p>
        {rows.map((r) => {
          const h = b.holding[r.productId] ?? { quantity: 0, unitIds: [] };
          const p = state.products[r.productId];
          const t = state.trips[target];
          const i = t?.items.find((i) => i.type === 'inventory' && i.productId === r.productId);
          const n = Number(amounts[r.productId] ?? '1');
          return (
            <section className="panel" key={r.productId}>
              <h3>{r.name}</h3>
              <p>
                <strong>
                  Tarvitaan {r.quantity} · Pakattu {r.packed + r.holding} ·{' '}
                  {r.packed + r.holding >= r.quantity
                    ? `Ylimäärä ${r.packed + r.holding - r.quantity}`
                    : `Puuttuu ${r.quantity - r.packed - r.holding}`}
                </strong>{' '}
                · Kohdistamatta {h.quantity} · Asiakkaille {r.packed} · Palautettu {r.returned}
              </p>
              {!b.closed && (
                <div className="filters">
                  <input
                    aria-label={`Määrä ${r.name}`}
                    type="number"
                    min="1"
                    step="1"
                    value={amounts[r.productId] ?? '1'}
                    onChange={(e) => setAmounts({ ...amounts, [r.productId]: e.target.value })}
                  />
                  <button
                    disabled={busy || b.departed}
                    onClick={() =>
                      void act({
                        type: 'bundle',
                        id: b.id,
                        expected: b.version,
                        action: 'load',
                        productId: r.productId,
                        quantity: n,
                      })
                    }
                  >
                    Pakkaa määrä autoon
                  </button>
                  <button
                    disabled={busy || !i}
                    onClick={() =>
                      i &&
                      void act({
                        type: 'bundle',
                        id: b.id,
                        expected: b.version,
                        action: 'assign',
                        productId: r.productId,
                        quantity: n,
                        tripId: t.id,
                        itemId: i.id,
                        tripVersion: t.version,
                      })
                    }
                  >
                    Kohdista määrä asiakkaalle
                  </button>
                  <button
                    className="secondary"
                    disabled={busy || h.quantity === h.unitIds.length}
                    onClick={() =>
                      void act({
                        type: 'bundle',
                        id: b.id,
                        expected: b.version,
                        action: 'unload',
                        productId: r.productId,
                        quantity: n,
                      })
                    }
                  >
                    Pura määrä takaisin varastoon
                  </button>
                </div>
              )}
              {p?.tracking === 'serial' && (
                <p className="hint">
                  Ilman sarjanumeroa kohdistamatta: {h.quantity - h.unitIds.length}. Voit tunnistaa
                  myös määränä pakatun laitteen sarjanumerolla asiakkaalle kohdistettaessa.
                </p>
              )}
              {h.unitIds.map((id) => (
                <p key={id}>
                  {p?.units[id]?.serial ?? id}{' '}
                  {!b.closed && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        void act({
                          type: 'bundle',
                          id: b.id,
                          expected: b.version,
                          action: 'unload',
                          productId: r.productId,
                          unitId: id,
                        })
                      }
                    >
                      Pura takaisin varastoon
                    </button>
                  )}
                </p>
              ))}
            </section>
          );
        })}
      </section>
      <section className="panel">
        <h2>Asiakkaiden keikat ja kohdistetut laitteet</h2>
        {b.tripIds.map((id) => {
          const t = state.trips[id];
          return (
            t && (
              <details className="panel" key={id}>
                <summary>
                  {t.name} · {t.contact} · {statusLabels[t.status]}
                </summary>
                <button className="text-button" onClick={() => select(id)}>
                  Avaa keikka / palautus
                </button>
                {t.items.map((i) => (
                  <div key={i.id}>
                    <p>
                      <strong>{i.name}</strong> · {i.packed} / {i.quantity} kohdistettu ·{' '}
                      {i.returned} palautettu{' '}
                      {i.type !== 'inventory' && '· Pakkaa erikseen keikan näkymässä'}
                    </p>
                    {i.unitIds.map((unitId) => (
                      <p key={unitId}>
                        {state.products[i.productId]?.units[unitId]?.serial ?? unitId}{' '}
                        {!b.closed && !i.returnedUnitIds.includes(unitId) && (
                          <button
                            disabled={busy}
                            className="text-button"
                            onClick={() =>
                              void act({
                                type: 'bundle',
                                id: b.id,
                                expected: b.version,
                                action: 'unassign',
                                productId: i.productId,
                                unitId,
                                tripId: t.id,
                                itemId: i.id,
                                tripVersion: t.version,
                              })
                            }
                          >
                            Vapauta nippuun
                          </button>
                        )}
                      </p>
                    ))}
                    {!b.closed &&
                      i.type === 'inventory' &&
                      i.packed - i.unitIds.length > i.returned - i.returnedUnitIds.length && (
                        <button
                          disabled={busy}
                          className="text-button"
                          onClick={() =>
                            void act({
                              type: 'bundle',
                              id: b.id,
                              expected: b.version,
                              action: 'unassign',
                              productId: i.productId,
                              quantity: 1,
                              tripId: t.id,
                              itemId: i.id,
                              tripVersion: t.version,
                            })
                          }
                        >
                          Vapauta 1 ilman sarjanumeroa nippuun
                        </button>
                      )}
                    {!b.closed &&
                      b.departed &&
                      ['out', 'returning'].includes(t.status) &&
                      i.packed - i.unitIds.length > i.returned - i.returnedUnitIds.length && (
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            void act({
                              type: 'bundle',
                              id: b.id,
                              expected: b.version,
                              action: 'returnQuantity',
                              productId: i.productId,
                              quantity: 1,
                              tripId: t.id,
                              itemId: i.id,
                              tripVersion: t.version,
                            })
                          }
                        >
                          Palauta 1 ilman sarjanumeroa
                        </button>
                      )}
                  </div>
                ))}
              </details>
            )
          );
        })}
      </section>
      {!b.closed && (
        <section className="panel">
          <h2>Lähtö ja niputuksen päättäminen</h2>
          {!b.departed && (
            <button disabled={busy} onClick={() => void act(command('depart'))}>
              Merkitse nippu lähteneeksi
            </button>
          )}
          <p>
            Palauta laitteet tämän näkymän sarjanumerolukijalla. Palautukset päivittyvät
            automaattisesti oikeille asiakkaiden keikoille. Määrätuotteita voi palauttaa asiakkaan
            kohdalta yllä tai koko nipun mukana.
          </p>
          {b.departed && (
            <>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  setReturnConfirm({
                    command: {
                      type: 'bundle',
                      id: b.id,
                      expected: b.version,
                      action: 'returnAll',
                      tripVersions: Object.fromEntries(
                        b.tripIds.map((id) => [id, state.trips[id].version]),
                      ),
                    },
                    count:
                      b.tripIds.reduce(
                        (n, id) =>
                          n + state.trips[id].items.reduce((m, i) => m + i.packed - i.returned, 0),
                        0,
                      ) + Object.values(b.holding).reduce((n, h) => n + h.quantity, 0),
                  })
                }
              >
                Palauta koko nipun kalusto
              </button>
              {returnConfirm && (
                <section className="panel" role="region" aria-label="Vahvista nipun palautus">
                  <h3>Vahvista {returnConfirm.count} kappaleen palautus</h3>
                  <p>
                    Vahvistan, että kaikki nipun palauttamatta olevat tavarat ovat palanneet
                    varastoon. Palautus sisältää myös määrätuotteet ja kohdistamattoman kaluston.
                    Asiakkaiden keikat arkistoidaan ja niputus päätetään. Kirjaa vaurioituneet
                    laitteet ensin yksittäin huoltoon.
                  </p>
                  <button disabled={busy} onClick={() => void act(returnConfirm.command)}>
                    Vahvistan: kaikki tavarat palautettu
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => setReturnConfirm(null)}
                  >
                    Peruuta palautus
                  </button>
                </section>
              )}
            </>
          )}
          <details>
            <summary>Päätä niputus</summary>
            <p>
              Kaiken kaluston pitää olla kohdistettu asiakkaille tai purettu takaisin varastoon.
              Keikat ja niiden pakkaustiedot säilyvät, ja niitä voi tämän jälkeen muokata erikseen.
            </p>
            <button
              disabled={busy}
              className="secondary"
              onClick={() => void act(command('close'))}
            >
              Päätä tämä niputus
            </button>
          </details>
        </section>
      )}
      {camera && <Scanner scan={scan} close={() => setCamera(false)} />}
    </>
  );
}
