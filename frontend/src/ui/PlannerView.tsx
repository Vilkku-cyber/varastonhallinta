import { useEffect, useState } from 'react';
import type { State, Trip, Item, Product } from '../domain/model';
import {
  panelPlan,
  panelKind,
  mounting,
  legacyLedIds,
  panelPixels,
  processorCapacity,
  suitableProcessors,
  ledItems,
  type PanelPlan,
} from '../domain/led';
import { Field } from './shared';
import './planner.css';

function Drawing({ plan, mode }: { plan: PanelPlan; mode: string }) {
  if (plan.panels > 3000)
    return <p>Piirroksen raja on 3000 palaa. Laskenta toimii koko seinälle.</p>;
  const height = plan.surface ? 250 : 500;
  const cells = [];
  let x = 0;
  for (let col = 0; col < plan.columns; col++) {
    const width = plan.columnWidths[col];
    for (let row = 0; row < plan.rows; row++)
      cells.push(
        <rect
          key={`${col}-${row}`}
          x={x}
          y={row * height}
          width={width}
          height={height}
          fill={width === 1000 ? '#8fa780' : '#c4cfa5'}
          stroke="#18352c"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        >
          <title>
            {width} × {height} mm · sarake {col + 1} · rivi {row + 1}
          </title>
        </rect>,
      );
    x += width;
  }
  const chains = [];
  if (mode !== 'panels') {
    const limit = mode === 'data' ? (plan.surface ? 8 : plan.columns) : plan.powerChain;
    if (limit) {
      if (plan.surface) {
        let left = 0;
        plan.columnWidths.forEach((width, col) => {
          for (let from = 0; from < plan.rows; from += limit) {
            const bottom = plan.heightMm - from * height - height * 0.18;
            const top = plan.heightMm - Math.min(from + limit, plan.rows) * height + height * 0.18;
            chains.push(
              <path key={`${col}-${from}`} d={`M ${left + width / 2} ${bottom} V ${top}`} />,
            );
            chains.push(
              <circle key={`dot-${col}-${from}`} cx={left + width / 2} cy={bottom} r={16} />,
            );
          }
          left += width;
        });
      } else
        for (let row = 0; row < plan.rows; row++)
          for (let from = 0; from < plan.columns; from += limit) {
            const y = row * height + height / 2;
            chains.push(
              <path
                key={`${row}-${from}`}
                d={`M ${from * 500 + 90} ${y} H ${Math.min(from + limit, plan.columns) * 500 - 90}`}
              />,
            );
            chains.push(<circle key={`dot-${row}-${from}`} cx={from * 500 + 90} cy={y} r={16} />);
          }
    }
  }
  return (
    <svg
      role="img"
      aria-label={`${plan.widthMm} × ${plan.heightMm} mm, ${plan.panels} paneelia. ${plan.surface ? 'Pintaledin johdotus alhaalta ylöspäin.' : 'Johdotus riveittäin.'}`}
      viewBox={`-10 -10 ${plan.widthMm + 20} ${plan.heightMm + 20}`}
    >
      <defs>
        <marker id="led-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" fill={mode === 'data' ? '#183e96' : '#9e3415'} />
        </marker>
      </defs>
      {cells}
      <g
        stroke={mode === 'data' ? '#183e96' : '#9e3415'}
        fill={mode === 'data' ? '#183e96' : '#9e3415'}
        strokeWidth="4"
      >
        {chains.map((c) =>
          c.type === 'path' ? (
            <g key={c.key} markerEnd="url(#led-arrow)">
              {c}
            </g>
          ) : (
            c
          ),
        )}
      </g>
    </svg>
  );
}
export function PlannerView({
  state,
  create,
  append,
}: {
  state: State;
  create: (items: Item[]) => void;
  append: (trip: Trip, items: Item[]) => Promise<void>;
}) {
  const [selectedPanel, setSelectedPanel] = useState(''),
    [width, setWidth] = useState(2500),
    [height, setHeight] = useState(500);
  const [long, setLong] = useState(''),
    [half, setHalf] = useState(''),
    [processor, setProcessor] = useState('');
  const [powerLimit, setPowerLimit] = useState(''),
    [mount, setMount] = useState('none'),
    [start, setStart] = useState(0);
  const [mode, setMode] = useState('panels'),
    [trip, setTrip] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [bindings, setBindings] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(legacyLedIds).map(([key, id]) => [
        key,
        state.products[id]
          ? id
          : key === 'plate' && state.products['-OKeRqQ2m35kxM4ez6XF']
            ? '-OKeRqQ2m35kxM4ez6XF'
            : '',
      ]),
    ),
  );
  const products = Object.values(state.products).filter((p) => !p.retired);
  const selectedKind = panelKind(state.products[selectedPanel]);
  const surface = selectedKind === 'long' || selectedKind === 'half';
  const candidates = (kind: string) => products.filter((p) => panelKind(p) === kind);
  let plan: PanelPlan | undefined,
    mountPlan: ReturnType<typeof mounting> | undefined,
    invalid = '';
  try {
    plan = panelPlan(
      width,
      height,
      500,
      500,
      surface,
      powerLimit.trim() ? Number(powerLimit) : null,
    );
    mountPlan = mounting(plan, mount, start);
  } catch (e) {
    invalid = (e as Error).message;
  }
  const rows =
    plan && mountPlan
      ? [
          {
            key: 'panel',
            label: surface ? 'Pintaled 1000 × 250 mm' : 'LED 500 × 500 mm',
            productId: long,
            quantity: plan.long,
          },
          { key: 'half', label: 'Pintaled 500 × 250 mm', productId: half, quantity: plan.half },
          {
            key: 'dataMid',
            label: 'DATA-välikaapeli',
            productId: bindings.dataMid,
            quantity: plan.midCables,
          },
          {
            key: 'powerMid',
            label: 'VIRTA-välikaapeli',
            productId: bindings.powerMid,
            quantity: plan.midCables,
          },
          {
            key: 'dataFeed',
            label: 'DATA-syöttökaapeli',
            productId: bindings.dataFeed,
            quantity: plan.dataFeeds,
          },
          {
            key: 'powerFeed',
            label: 'VIRTA-syöttökaapeli',
            productId: bindings.powerFeed,
            quantity: plan.powerFeeds ?? 0,
          },
          {
            key: 'shortPole',
            label: 'LED tolppa lyhyt',
            productId: bindings.shortPole,
            quantity: mountPlan.shortPoles,
          },
          {
            key: 'longPole',
            label: 'LED tolppa pitkä',
            productId: bindings.longPole,
            quantity: mountPlan.longPoles,
          },
          {
            key: 'plate',
            label: 'LED Plate',
            productId: bindings.plate,
            quantity: mountPlan.plates,
          },
          {
            key: 'feet',
            label: 'Kiilat / lisut / pumput / tassut',
            productId: bindings.feet,
            quantity: mountPlan.feet,
          },
          {
            key: 'processor',
            label: 'LED-prosessori',
            productId: processor,
            quantity: processor ? 1 : 0,
          },
        ].filter((r) => r.quantity > 0)
      : [];
  const lp = panelPixels(state.products[long]),
    hp = panelPixels(state.products[half]);
  const pixels =
    plan && (!plan.long || lp) && (!plan.half || hp)
      ? {
          w: (plan.long ? (lp!.w * plan.long) / plan.rows : 0) + (plan.half ? hp!.w : 0),
          h: (plan.long ? lp!.h : hp!.h) * plan.rows,
        }
      : null;
  const capacity = processorCapacity(state.products[processor]);
  const over = !!(pixels && capacity && pixels.w * pixels.h > capacity);
  const processors = suitableProcessors(products, pixels ? pixels.w * pixels.h : null);
  useEffect(() => {
    if (processor && !processors.some((p) => p.id === processor)) setProcessor('');
  }, [processor, processors.map((p) => p.id).join('|')]);
  const selectedValid =
    (!plan?.long || panelKind(state.products[long]) === (surface ? 'long' : 'standard')) &&
    (!plan?.half || panelKind(state.products[half]) === 'half');
  const material = () => {
    if (!plan || !selectedPanel || !selectedValid) throw Error('Valitse tarvittavat LED-paneelit.');
    if (processor && !processors.some((p) => p.id === processor))
      throw Error('Valitse seinän pikselimäärälle riittävä prosessori.');
    if (plan.powerFeeds === null) throw Error('Vahvista Pintaledin virtaketjun enimmäispalamäärä.');
    if (over) throw Error('Valitun prosessorin pikselikapasiteetti ylittyy.');
    return ledItems(
      rows,
      state.products,
      `LED ${plan.widthMm} × ${plan.heightMm} mm; ${surface ? 'pystydata 2 m/ketju' : 'rivijohdotus'}; asennus ${mount}`,
    );
  };
  const selectProduct = (
    label: string,
    value: string,
    update: (v: string) => void,
    options: Product[],
  ) => (
    <Field label={label}>
      <select value={value} onChange={(e) => update(e.target.value)}>
        <option value="">Valitse varastotuote</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MITOITUKSESTA KALUSTOLISTAKSI</p>
          <h1>LED-suunnittelu</h1>
          <p>Leveys × korkeus. Paneelit, johdotus, asennus ja prosessori samaan suunnitelmaan.</p>
        </div>
        <button className="secondary no-print" onClick={() => window.print()}>
          Tulosta suunnitelma
        </button>
      </div>
      <div className="planner-layout">
        <section className="panel">
          <h2>Seinän rakenne</h2>
          {selectProduct(
            'LED-tuote',
            selectedPanel,
            (id) => {
              setSelectedPanel(id);
              setProcessor('');
              const kind = panelKind(state.products[id]);
              const longs = candidates('long'),
                halves = candidates('half');
              setLong(
                kind === 'standard' || kind === 'long'
                  ? id
                  : kind === 'half' && longs.length === 1
                    ? longs[0].id
                    : '',
              );
              setHalf(
                kind === 'half' ? id : kind === 'long' && halves.length === 1 ? halves[0].id : '',
              );
            },
            products.filter((p) => panelKind(p) !== null),
          )}
          {selectedKind && (
            <p className="hint">
              {surface
                ? 'Pintaled · 1000 / 500 × 250 mm · pystysuuntainen johdotus'
                : 'LED · 500 × 500 mm · vaakasuuntainen johdotus'}
            </p>
          )}
          <div className="form-grid">
            <Field label="Leveys mm">
              <input
                type="number"
                min="1"
                max="100000"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </Field>
            <Field label="Korkeus mm">
              <input
                type="number"
                min="1"
                max="100000"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </Field>
          </div>
          {selectedKind === 'half' &&
            (!plan || plan.long > 0) &&
            selectProduct(
              surface ? '1000 × 250 mm tuote' : '500 × 500 mm paneeli',
              long,
              setLong,
              candidates(surface ? 'long' : 'standard'),
            )}
          {selectedKind === 'long' &&
            !!plan?.half &&
            selectProduct('500 × 250 mm tuote', half, setHalf, candidates('half'))}
          <p className="hint">
            Paneelivalinnoissa vain LED-kategorian oikeankokoiset tuotteet. Left/right-erikoispalat
            eivät korvaa suoria paloja.
          </p>
          <h2>Syötöt ja kaapelit</h2>
          <p>
            {surface
              ? 'Pintaled johdotetaan pystysarakkeittain alhaalta ylöspäin. Yksi datasyöttö kattaa enintään 8 palaa eli 2 metriä; jokaiselle 1000/500 mm sarakkeelle omat ketjut.'
              : 'Data: yksi syöttö per vaakarivi. Virta: enintään 20 palaa per ketju, tarvittaessa useita syöttöjä samalla rivillä.'}
          </p>
          {surface && (
            <Field label="Pintaled: paloja enintään / virtasyöttö">
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Vahvistettava raja"
                value={powerLimit}
                onChange={(e) => setPowerLimit(e.target.value)}
              />
            </Field>
          )}
          <p className="hint">
            DATA- ja VIRTA-välikaapeleita kumpaakin: palojen määrä + 3, pyöristettynä ylöspäin
            kymmeneen.
          </p>
          <h2>Asennus</h2>
          <Field label="Asennustapa">
            <select value={mount} onChange={(e) => setMount(e.target.value)}>
              <option value="none">Ei asennustarvikkeita</option>
              <option value="legs">Jaloilla: tolpat ja platet</option>
              <option value="feet">Kiilat / lisut / pumput / tassut</option>
              <option value="hanging">Ripustus – tarvikkeet erikseen</option>
              <option value="wall">Seinäasennus – tarvikkeet erikseen</option>
            </select>
          </Field>
          {mount === 'legs' && (
            <>
              <Field label="Seinän alareunan korkeus mm">
                <input
                  type="number"
                  min="0"
                  value={start}
                  onChange={(e) => setStart(Number(e.target.value))}
                />
              </Field>
              <p className="hint">
                Vanhan työkalun määräarvio: yksi positio / alkava metri, 2 tolppaa ja 1 plate /
                positio. Yläreuna ≤ 3,5 m: lyhyt tolppa; muuten pitkä. Tämä määräarvio ei vahvista
                rakenteen kantavuutta.
              </p>
            </>
          )}
          {['hanging', 'wall'].includes(mount) && (
            <p className="notice">
              Lisää kohteen ripustus- tai seinäkiinnitystarvikkeet keikalle erikseen.
            </p>
          )}
          <h2>Prosessori</h2>
          {selectProduct('LED-prosessori (valinnainen)', processor, setProcessor, processors)}
          <p className="hint">
            {pixels
              ? `${(pixels.w * pixels.h).toLocaleString('fi')} pikseliä: ${processors.length} kapasiteetiltaan riittävää prosessoria. Lista on järjestetty kapasiteetin mukaan.`
              : 'Valitse paneelit, joiden pikselimitat löytyvät tuotetiedoista. Prosessorit näytetään, kun seinän pikselimäärä tunnetaan.'}
          </p>
          {pixels && !processors.length && (
            <p className="notice">
              Kalustosta ei löytynyt prosessoria, jonka tunnettu pikselikapasiteetti riittäisi.
              Tarkista prosessorien tuotetiedot.
            </p>
          )}
          {processor && (
            <p>
              {capacity
                ? `Kapasiteetti ${capacity.toLocaleString('fi')} px`
                : 'Pikselikapasiteetti ei ole tiedossa.'}
            </p>
          )}
          {processor && <p className="hint">{state.products[processor]?.notes}</p>}
        </section>
        <section className="panel led-plan-result">
          {invalid && (
            <p role="alert" className="error">
              {invalid}
            </p>
          )}
          {plan && (
            <>
              <div className="actions no-print">
                {[
                  ['panels', 'Palajako'],
                  ['data', 'Data ↑ / →'],
                  ['power', 'Virta ↑ / →'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className="secondary small"
                    aria-pressed={mode === key}
                    onClick={() => setMode(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="led-drawing">
                <Drawing plan={plan} mode={mode} />
              </div>
              <h2>
                {plan.widthMm} × {plan.heightMm} mm · {plan.panels} palaa
              </h2>
              <p>
                {plan.rows} riviä · {plan.columns} fyysistä saraketta
                {surface ? ` · ${plan.long} × 1000 mm + ${plan.half} × 500 mm` : ''}
              </p>
              {(plan.widthMm !== width || plan.heightMm !== height) && (
                <p className="notice">
                  Pyydetty {width} × {height} mm pyöristyy ylöspäin toteutuvaan kokoon.
                </p>
              )}
              <p>
                {pixels
                  ? `Resoluutio ${pixels.w} × ${pixels.h} px · ${(pixels.w * pixels.h).toLocaleString('fi')} pikseliä`
                  : 'Resoluutio ei ole tiedossa: valitse paneelit, joiden tuotetiedoissa on pikselimitat.'}
              </p>
              {over && (
                <p className="error" role="alert">
                  Prosessorin pikselikapasiteetti ei riitä tähän seinään.
                </p>
              )}
              <p className="hint">
                Prosessorin portti-, leveys-, korkeus- ja yhteensopivuusrajat tarkistetaan erikseen
                tuotetiedoista. Pikselimäärä yksin ei vahvista yhteensopivuutta.
              </p>
              <div className="led-feed-counts">
                <strong>DATA-syötöt {plan.dataFeeds}</strong>
                <strong>VIRTA-syötöt {plan.powerFeeds ?? 'raja puuttuu'}</strong>
              </div>
              {plan.powerFeeds === null && (
                <p className="notice">
                  Pintaledin virtaketjun raja puuttuu. Virtasyöttömäärää tai kokonaista
                  kalustolistaa ei vielä vahvisteta.
                </p>
              )}
              <h2>Kalustolista</h2>
              <div className="led-materials">
                {rows.map((r) => (
                  <div className="led-material-row" key={r.key}>
                    <div>
                      <strong>{r.label}</strong>
                      <span>{r.quantity} kpl</span>
                    </div>
                    {['panel', 'half', 'processor'].includes(r.key) ? (
                      <small>{state.products[r.productId]?.name ?? 'Valitse tuote'}</small>
                    ) : (
                      <select
                        aria-label={`Varastotuote: ${r.label}`}
                        value={r.productId}
                        onChange={(e) => setBindings({ ...bindings, [r.key]: e.target.value })}
                      >
                        <option value="">Valitse varastotuote</option>
                        {products
                          .filter((p) =>
                            /Mid|Feed/.test(r.key)
                              ? /kaapeli/i.test(p.category)
                              : /asennus/i.test(p.category),
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
              <p className="hint">
                Keikalle siirtyvät kaikki listan paneelit, kaapelit, valitut asennustarvikkeet ja
                prosessori. Saatavuus tarkistetaan keikan päivämäärille tallennettaessa.
              </p>
              <button
                disabled={busy || plan.powerFeeds === null}
                onClick={() => {
                  try {
                    create(material());
                    setError('');
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Luo keikka koko kalustolistasta
              </button>
              <Field label="Tai lisää olemassa olevalle keikalle">
                <select value={trip} onChange={(e) => setTrip(e.target.value)}>
                  <option value="">Valitse keikka</option>
                  {Object.values(state.trips)
                    .filter((t) => ['draft', 'planned', 'packed'].includes(t.status))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </Field>
              <button
                className="secondary"
                disabled={busy || !trip || plan.powerFeeds === null}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await append(state.trips[trip], material());
                    setError('Kalustolista lisätty keikalle.');
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Lisää koko kalustolista
              </button>
            </>
          )}
          {error && <p role="status">{error}</p>}
        </section>
      </div>
    </>
  );
}
