import { useState } from 'react';
import {
  ArrowUpRight,
  Plus,
  Search,
  Trash2,
  Download,
  Upload,
  ArrowRight,
  Check,
} from 'lucide-react';
import {
  type State,
  type Trip,
  type Item,
  type Product,
  statusLabels,
  open,
} from '../domain/model';
import { addDays, availability, days, formatDay, today, validDay } from '../domain/calendar';
import { type Command } from '../domain/commands';
import { type Repository } from '../data/repository';
import { importLegacy } from '../domain/importLegacy';
import { parseBackup } from '../domain/backup';
import { panelPlan } from '../domain/planner';
import { Empty, Field, download, uid } from './shared';
import { CloudImport } from './CloudImport';
export function TripCards({ trips, select }: { trips: Trip[]; select: (id: string) => void }) {
  return (
    <div className="trip-cards">
      {trips.map((t) => (
        <button className="trip-card" key={t.id} onClick={() => select(t.id)}>
          <div>
            <span className={`badge ${t.status}`}>{statusLabels[t.status]}</span>
            <ArrowUpRight size={20} />
          </div>
          <h3>{t.name}</h3>
          <p>
            {formatDay(t.start)} – {formatDay(t.end)}
          </p>
          <footer>
            <span>{t.items.length} kalustoriviä</span>
            <span>
              {t.items.reduce((n, i) => n + i.packed, 0)} /{' '}
              {t.items.reduce((n, i) => n + i.quantity, 0)} pakattu
            </span>
          </footer>
        </button>
      ))}
    </div>
  );
}
export function Dashboard({
  state,
  select,
  create,
}: {
  state: State;
  select: (id: string) => void;
  create: () => void;
}) {
  const now = today();
  const trips = Object.values(state.trips)
    .filter(open)
    .sort((a, b) => a.start.localeCompare(b.start));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">VARASTON TILANNE</p>
          <h1>Kalusto liikkeessä.</h1>
          <p className="subtitle">
            Suunnittele keikat. Pakkaa varmasti. Pidä kokonaisuus hallussa.
          </p>
        </div>
        <button onClick={create}>
          <Plus size={18} /> Uusi keikka
        </button>
      </div>
      <div className="metrics">
        {[
          ['Aktiiviset keikat', trips.length, 'Suunnittelusta palautukseen'],
          ['Tänään lähtevät', trips.filter((t) => t.start === now).length, formatDay(now)],
          [
            'Kalustonimikkeet',
            Object.values(state.products).filter((p) => !p.retired).length,
            'Yksi yhteinen kalustorekisteri',
          ],
          [
            'Palautettavat',
            trips.filter((t) => ['out', 'returning'].includes(t.status)).length,
            'Tarkista ennen seuraavaa keikkaa',
          ],
        ].map(([label, value, sub], n) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{String(value).padStart(2, '0')}</strong>
            <small>
              <i className={'dot d' + n} />
              {sub}
            </small>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <h2>Seuraavaksi työn alla</h2>
        <span>{trips.length} keikkaa</span>
      </div>
      {trips.length ? (
        <TripCards trips={trips.slice(0, 6)} select={select} />
      ) : (
        <Empty>Ei aktiivisia keikkoja. Luo ensimmäinen keikka.</Empty>
      )}
      <div className="dashboard-bottom">
        <section className="panel">
          <h2>Viimeisimmät tapahtumat</h2>
          {state.events.slice(0, 5).map((e) => (
            <div className="activity" key={e.id}>
              <i className="dot" />
              <span>{e.text}</span>
              <small>
                {new Date(e.at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
              </small>
            </div>
          ))}
          {!state.events.length && <p className="muted">Tallennetut muutokset tulevat tähän.</p>}
        </section>
        <section className="calendar-note">
          <span className="eyebrow">KALENTERI OHJAA SALDOJA</span>
          <h2>
            Sama laite.
            <br />
            Seuraava keikka.
          </h2>
          <p>
            Peräkkäisten päivien varaukset käyttävät samaa kalustoa. Päällekkäiset varaukset
            tarkistetaan ennen tallennusta.
          </p>
          <div>
            MA <b>6 / 10</b>
            <ArrowRight size={20} /> TI <b>6 / 10</b>
          </div>
        </section>
      </div>
    </>
  );
}
export function CalendarView({ state, select }: { state: State; select: (id: string) => void }) {
  const [start, ss] = useState(today());
  const dates = days(start, addDays(start, 13));
  const trips = Object.values(state.trips).filter(
    (t) => !['closed', 'cancelled'].includes(t.status) && t.end >= start && t.start <= dates[13],
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">VARAUKSET PÄIVITTÄIN</p>
          <h1>Kalenteri</h1>
          <p className="subtitle">Lähtö- ja loppupäivä kuuluvat varaukseen.</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => ss(addDays(start, -14))}>
            ←
          </button>
          <input
            aria-label="Kalenterin alkupäivä"
            type="date"
            value={start}
            onChange={(e) => {
              if (validDay(e.target.value)) ss(e.target.value);
            }}
          />
          <button className="secondary" onClick={() => ss(addDays(start, 14))}>
            →
          </button>
        </div>
      </div>
      <section className="panel calendar-scroll">
        <div
          className="calendar-grid"
          style={{ gridTemplateColumns: `220px repeat(14,minmax(70px,1fr))` }}
        >
          <div className="calendar-label">Keikka</div>
          {dates.map((d) => (
            <div key={d} className={d === today() ? 'is-today' : ''}>
              <small>{new Date(d).toLocaleDateString('fi-FI', { weekday: 'short' })}</small>
              <b>{formatDay(d)}</b>
            </div>
          ))}
          {trips.map((t) => (
            <div className="calendar-row" key={t.id}>
              <button className="calendar-name" onClick={() => select(t.id)}>
                {t.name}
                <small>{statusLabels[t.status]}</small>
              </button>
              {dates.map((d) => (
                <button
                  aria-label={`${t.name}, ${formatDay(d)}`}
                  key={d}
                  onClick={() => select(t.id)}
                  className={d >= t.start && d <= t.end ? 'occupied' : 'unoccupied'}
                >
                  {d === t.start ? 'Lähtö' : d === t.end ? 'Paluu' : ''}
                </button>
              ))}
            </div>
          ))}
        </div>
        {!trips.length && <Empty>Ei keikkoja tällä aikavälillä.</Empty>}
      </section>
      <div className="section-heading">
        <h2>Kaluston vapaa määrä</h2>
        <span>Päiväkohtainen saldo</span>
      </div>
      <section className="panel calendar-scroll">
        <table className="capacity-table">
          <thead>
            <tr>
              <th>Kalusto</th>
              {dates.map((d) => (
                <th key={d}>{formatDay(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.values(state.products)
              .filter((p) => !p.retired)
              .map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  {dates.map((d) => {
                    const a = availability(state, p.id, d, d);
                    return (
                      <td
                        key={d}
                        className={
                          a.available < 0
                            ? 'danger-text'
                            : a.available === 0
                              ? 'muted'
                              : 'success-text'
                        }
                      >
                        {a.available}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
export function InventoryView({ state, edit }: { state: State; edit: (p?: Product) => void }) {
  const [query, sq] = useState('');
  const [start, ss] = useState(today()),
    [end, se] = useState(today());
  const [category, sc] = useState('');
  const products = Object.values(state.products).filter(
    (p) =>
      (!category || p.category === category) &&
      `${p.name} ${p.notes} ${Object.values(p.units)
        .map((u) => u.serial)
        .join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">KALUSTOREKISTERI</p>
          <h1>Kaikki oikeilla paikoillaan.</h1>
        </div>
        <button onClick={() => edit()}>
          <Plus size={18} /> Lisää kalustoa
        </button>
      </div>
      <div className="filters">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Hae kalustoa"
            placeholder="Nimi, sarjanumero tai lisätieto…"
            value={query}
            onChange={(e) => sq(e.target.value)}
          />
        </div>
        <select aria-label="Kategoria" value={category} onChange={(e) => sc(e.target.value)}>
          <option value="">Kaikki kategoriat</option>
          {[...new Set(Object.values(state.products).map((p) => p.category))].sort().map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          aria-label="Saatavuus alkaa"
          type="date"
          value={start}
          onChange={(e) => ss(e.target.value)}
        />
        <span>—</span>
        <input
          aria-label="Saatavuus päättyy"
          type="date"
          value={end}
          min={start}
          onChange={(e) => se(e.target.value)}
        />
      </div>
      <section className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Kalusto</th>
              <th>Kategoria</th>
              <th>Yhteensä</th>
              <th>Varattu enimmillään</th>
              <th>Vapaana ajalle</th>
              <th>Hyllypaikat</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              let a;
              try {
                a = availability(state, p.id, start, end);
              } catch {}
              return (
                <tr key={p.id}>
                  <td>
                    <button className="text-button" onClick={() => edit(p)}>
                      {p.name}
                    </button>
                    <small>
                      {p.review
                        ? 'Tiedot tarkistettava'
                        : p.retired
                          ? 'Poistettu käytöstä'
                          : p.tracking === 'serial'
                            ? `${Object.keys(p.units).length} yksilöä`
                            : p.dimensions}
                    </small>
                  </td>
                  <td>
                    <span className="category-tag">{p.category}</span>
                  </td>
                  <td>{p.total}</td>
                  <td>{a?.reserved ?? '–'}</td>
                  <td>
                    <b className={a && a.available > 0 ? 'success-text' : 'danger-text'}>
                      {a?.available ?? '–'}
                    </b>
                  </td>
                  <td>
                    {Object.values(state.placements)
                      .filter((l) => l.productId === p.id)
                      .map((l) => state.locations[l.locationId])
                      .filter(Boolean)
                      .map((l) => `${l.shelf} / ${l.aisle} / ${l.level}`)
                      .join(', ') || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!products.length && <Empty>Hakua vastaavaa kalustoa ei löytynyt.</Empty>}
      </section>
    </>
  );
}
export function LocationsView({
  state,
  run,
}: {
  state: State;
  run: (c: Command) => Promise<void>;
}) {
  const [filter, sf] = useState('');
  const [error, se] = useState('');
  const [loc, sl] = useState('');
  const [pid, sp] = useState('');
  const [text, st] = useState('');
  const act = async (c: Command) => {
    try {
      await run(c);
      se('');
    } catch (e) {
      se((e as Error).message);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FYYSINEN VARASTO</p>
          <h1>Hyllyt ja sijainnit</h1>
        </div>
        <input
          aria-label="Hae hyllyistä"
          placeholder="Hae tuotetta tai hyllymerkintää…"
          value={filter}
          onChange={(e) => sf(e.target.value)}
        />
      </div>
      <div className="shelf-grid">
        {Object.values(state.locations).map((l) => {
          const rows = Object.values(state.placements).filter(
            (p) => p.locationId === l.id && p.label.toLowerCase().includes(filter.toLowerCase()),
          );
          if (filter && !rows.length) return null;
          return (
            <section className="shelf" key={l.id}>
              <header>
                <b>{l.shelf}</b>
                <span>
                  Väli {l.aisle} · taso {l.level}
                </span>
                <small>{l.direction === 'rtl' ? '←' : '→'}</small>
              </header>
              {rows.map((p) => (
                <div className="shelf-item" key={p.id}>
                  <span>
                    {p.label}
                    <small>{p.productId ? 'Kalustotuote' : 'Hyllymerkintä'}</small>
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Poista sijoittelu ${p.label}`}
                    onClick={() => void act({ type: 'placement', placement: null, id: p.id })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {!rows.length && <p className="muted">Ei sijoituksia</p>}
            </section>
          );
        })}
      </div>
      <div className="form-grid">
        <section className="panel">
          <h2>Lisää hyllypaikka</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act({
                type: 'location',
                location: {
                  id: uid(),
                  shelf: String(f.get('shelf')),
                  aisle: String(f.get('aisle')),
                  level: String(f.get('level')),
                  direction: String(f.get('direction')),
                },
              });
            }}
          >
            <div className="form-grid">
              <Field label="Hylly">
                <input name="shelf" required />
              </Field>
              <Field label="Väli">
                <input name="aisle" required />
              </Field>
              <Field label="Taso">
                <input name="level" required />
              </Field>
              <Field label="Suunta">
                <select name="direction">
                  <option value="ltr">Vasemmalta oikealle</option>
                  <option value="rtl">Oikealta vasemmalle</option>
                </select>
              </Field>
            </div>
            <button>Lisää paikka</button>
          </form>
        </section>
        <section className="panel">
          <h2>Sijoita tuote tai merkintä</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const id = uid();
              void act({
                type: 'placement',
                id,
                placement: {
                  id,
                  locationId: loc,
                  productId: pid,
                  label: state.products[pid]?.name ?? text,
                },
              });
            }}
          >
            <Field label="Hyllypaikka">
              <select required value={loc} onChange={(e) => sl(e.target.value)}>
                <option value="">Valitse paikka</option>
                {Object.values(state.locations).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.shelf} / {l.aisle} / {l.level}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tuote">
              <select value={pid} onChange={(e) => sp(e.target.value)}>
                <option value="">Vapaa hyllymerkintä</option>
                {Object.values(state.products).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            {!pid && (
              <Field label="Merkintä">
                <input required value={text} onChange={(e) => st(e.target.value)} />
              </Field>
            )}
            <button>Sijoita hyllyyn</button>
          </form>
        </section>
      </div>
      {error && <p className="error">{error}</p>}
    </>
  );
}
export function TasksView({ state, run }: { state: State; run: (c: Command) => Promise<void> }) {
  const [text, st] = useState('');
  const [error, se] = useState('');
  const act = async (c: Command) => {
    try {
      await run(c);
      se('');
    } catch (e) {
      se((e as Error).message);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YHTEINEN MUISTILISTA</p>
          <h1>Tehtävät</h1>
        </div>
      </div>
      <section className="panel">
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const id = uid();
            void act({ type: 'task', id, task: { id, text, done: false } }).then(() => st(''));
          }}
        >
          <input
            required
            aria-label="Uusi tehtävä"
            placeholder="Mitä pitää tehdä?"
            value={text}
            onChange={(e) => st(e.target.value)}
          />
          <button>
            <Plus size={17} /> Lisää
          </button>
        </form>
        {Object.values(state.tasks).map((t) => (
          <div className="task-row" key={t.id}>
            <button
              className={'task-check ' + (t.done ? 'done' : '')}
              aria-label={`Kuittaa ${t.text}`}
              onClick={() => void act({ type: 'task', id: t.id, task: { ...t, done: !t.done } })}
            >
              {t.done && <Check size={16} />}
            </button>
            <input
              aria-label="Tehtävän teksti"
              key={t.text}
              defaultValue={t.text}
              className={t.done ? 'completed' : ''}
              onBlur={(e) => {
                if (e.target.value !== t.text)
                  void act({ type: 'task', id: t.id, task: { ...t, text: e.target.value } });
              }}
            />
            <button
              className="icon-button"
              aria-label={`Poista tehtävä ${t.text}`}
              onClick={() => void act({ type: 'task', id: t.id, task: null })}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {error && <p className="error">{error}</p>}
      </section>
    </>
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
  const [surface, ss] = useState(false);
  const [w, sw] = useState(2500),
    [h, sh] = useState(500),
    [pw, spw] = useState(500),
    [ph, sph] = useState(500);
  const [long, sl] = useState(''),
    [half, sha] = useState(''),
    [trip, st] = useState('');
  const [error, se] = useState('');
  let plan: ReturnType<typeof panelPlan> | undefined;
  try {
    plan = panelPlan(w, h, surface ? 1000 : pw, surface ? 250 : ph, surface);
  } catch {}
  const items = () => {
    if (
      !plan ||
      !state.products[long] ||
      (surface && plan.half && !state.products[half]) ||
      (surface && half === long && plan.half)
    )
      throw Error('Valitse suunnitelman osille oikeat, erilliset kalustotuotteet.');
    return [
      [long, plan.long],
      [half, plan.half],
    ]
      .filter(([, n]) => Number(n) > 0)
      .map(([id, q]) => ({
        id: uid(),
        type: 'inventory' as const,
        productId: String(id),
        name: state.products[String(id)].name,
        quantity: Number(q),
        note: 'LED-suunnitelma',
        packed: 0,
        returned: 0,
        unitIds: [],
        returnedUnitIds: [],
        serialSnapshots: [],
      }));
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MITOITUKSESTA KALUSTOLISTAKSI</p>
          <h1>LED-suunnittelu</h1>
        </div>
        <span className="badge">Paneelimitoitus</span>
      </div>
      <div className="planner-layout">
        <section className="panel">
          <h2>Seinän rakenne</h2>
          <Field label="Paneelityyppi">
            <select
              value={surface ? 'surface' : 'standard'}
              onChange={(e) => ss(e.target.value === 'surface')}
            >
              <option value="standard">Tavallinen paneeli</option>
              <option value="surface">Pintaled 1000 / 500 × 250 mm</option>
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Leveys mm">
              <input type="number" min="1" value={w} onChange={(e) => sw(Number(e.target.value))} />
            </Field>
            <Field label="Korkeus mm">
              <input type="number" min="1" value={h} onChange={(e) => sh(Number(e.target.value))} />
            </Field>
            {!surface && (
              <>
                <Field label="Paneelin leveys mm">
                  <input
                    type="number"
                    min="1"
                    value={pw}
                    onChange={(e) => spw(Number(e.target.value))}
                  />
                </Field>
                <Field label="Paneelin korkeus mm">
                  <input
                    type="number"
                    min="1"
                    value={ph}
                    onChange={(e) => sph(Number(e.target.value))}
                  />
                </Field>
              </>
            )}
          </div>
          <Field label={surface ? '1000 × 250 mm tuote' : 'Paneelituote'}>
            <select value={long} onChange={(e) => sl(e.target.value)}>
              <option value="">Valitse kalustosta</option>
              {Object.values(state.products).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          {surface && (
            <Field label="500 × 250 mm tuote">
              <select value={half} onChange={(e) => sha(e.target.value)}>
                <option value="">Valitse kalustosta</option>
                {Object.values(state.products).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <p className="hint">
            Tuotteiden tunnisteita ei päätellä nimestä. Valitse oikeat paneelit ennen keikalle
            siirtoa.
          </p>
        </section>
        <section className="panel">
          <div className="led-visual">
            <div
              style={{
                aspectRatio: Math.max(0.3, Math.min(6, w / Math.max(h, 1))),
                backgroundSize: `${100 / Math.max(1, Math.ceil(w / (surface ? 500 : pw)))}% ${100 / Math.max(1, Math.ceil(h / (surface ? 250 : ph)))}%`,
              }}
            >
              <span>
                {plan?.widthMm ?? '—'} × {plan?.heightMm ?? '—'} mm
              </span>
            </div>
          </div>
          <h2>{plan?.panels ?? 0} paneelia</h2>
          {surface && (
            <p>
              {plan?.long ?? 0} × 1000 mm + {plan?.half ?? 0} × 500 mm
            </p>
          )}
          <p className="hint">
            Asennus-, prosessori- ja kaapelikaluston automaattinen valinta odottaa vahvistettuja
            tuoteprofiileja. Tässä siirretään paneelit.
          </p>
          <button
            onClick={() => {
              try {
                create(items());
              } catch (e) {
                se((e as Error).message);
              }
            }}
          >
            <Plus size={16} /> Luo keikka paneeleista
          </button>
          <Field label="Tai lisää olemassa olevalle keikalle">
            <select value={trip} onChange={(e) => st(e.target.value)}>
              <option value="">Valitse keikka</option>
              {Object.values(state.trips)
                .filter(open)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </Field>
          <button
            className="secondary"
            disabled={!trip}
            onClick={async () => {
              try {
                await append(state.trips[trip], items());
                se('Paneelit lisätty keikalle.');
              } catch (e) {
                se((e as Error).message);
              }
            }}
          >
            Lisää paneelit
          </button>
          {error && <p role="status">{error}</p>}
        </section>
      </div>
    </>
  );
}
export function SettingsView({ state, repo }: { state: State; repo: Repository }) {
  const [preview, sp] = useState<{ state: State; raw: unknown; name: string } | null>(null);
  const [error, se] = useState('');
  const [busy, sb] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">AINEISTO JA YMPÄRISTÖ</p>
          <h1>Tiedot ja asetukset</h1>
        </div>
      </div>
      <div className="form-grid">
        <section className="panel">
          <h2>{repo.mode === 'local' ? 'Paikallinen työtila' : 'Firebase Realtime Database'}</h2>
          <p>
            {repo.mode === 'local'
              ? 'Tiedot säilyvät tämän selaimen tietokannassa myös uudelleenkäynnistyksen jälkeen. Muut välilehdet päivittyvät automaattisesti.'
              : 'Yhteinen v2-tietokanta. Kirjoitukset tehdään transaktioina.'}
          </p>
          <p className="hint">
            Firebase Functionsia ei käytetä. Paikallisen työtilan tiedot eivät siirry toiselle
            koneelle ilman exporttia.
          </p>
          <button
            className="secondary"
            onClick={async () => {
              try {
                download(`av-arsenal-${today()}.json`, await repo.backup());
              } catch (e) {
                se((e as Error).message);
              }
            }}
          >
            <Download size={16} /> Vie varmuuskopio
          </button>
        </section>
        <section className="panel">
          <h2>Vanhan tietokannan tuonti</h2>
          {repo.mode === 'local' && (
            <p>
              Valitse RTDB-export tai 2.0-varmuuskopio. Näet yhteenvedon ennen paikallisen työtilan
              vaihtamista. Tuotantokantaan ei kirjoiteta.
            </p>
          )}
          {repo.mode === 'local' ? (
            <label className="upload">
              <Upload size={18} /> Valitse JSON-export
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 30 * 1024 * 1024) throw Error('Tiedosto ylittää 30 Mt rajan.');
                    const raw = JSON.parse(await file.text());
                    const parsed =
                      raw.format === 'av-arsenal-backup'
                        ? parseBackup(raw)
                        : { state: importLegacy(raw), source: raw };
                    sp({ state: parsed.state, raw: parsed.source, name: file.name });
                    se('');
                  } catch (e) {
                    se((e as Error).message);
                  }
                }}
              />
            </label>
          ) : (
            <CloudImport repo={repo} state={state} />
          )}
        </section>
      </div>
      {preview && (
        <section className="panel import-preview">
          <h2>Tuonnin esikatselu · {preview.name}</h2>
          <p>
            {Object.keys(preview.state.products).length} kalustotuotetta ·{' '}
            {Object.keys(preview.state.trips).length} keikkaa · {preview.state.reviews.length}{' '}
            tarkistusmerkintää
          </p>
          <p>
            Tuonti korvaa nykyisen paikallisen työtilan. Vie nykyinen varmuuskopio ensin.
            Alkuperäinen lähde tallennetaan tuonnin mukana; epäselviä rivejä ei hävitetä.
          </p>
          <div className="actions">
            <button
              disabled={busy}
              onClick={async () => {
                sb(true);
                try {
                  await repo.importLocal?.(preview.state, preview.raw);
                  sp(null);
                  se('Tuonti valmis. Tarkista määräristiriidat Kalusto-näkymässä.');
                } catch (e) {
                  se((e as Error).message);
                } finally {
                  sb(false);
                }
              }}
            >
              Ota esikatseltu aineisto paikalliseen käyttöön
            </button>
            <button className="secondary" onClick={() => sp(null)}>
              Peruuta
            </button>
          </div>
        </section>
      )}
      {error && (
        <p className="notice" role="status">
          {error}
        </p>
      )}
      <section className="panel">
        <h2>
          Tuonnin tarkistusjono <span className="count">{state.reviews.length}</span>
        </h2>
        <p className="hint">
          Tarkistusmerkinnät säilyttävät lähdepolun. Tuotteen määräristiriidan voi vahvistaa
          kaluston muokkauksessa. Historiallisten rivien yhdistely ei ole automaattinen.
        </p>
        {state.reviews.slice(0, 150).map((r) => (
          <div className="review-row" key={r.id}>
            <strong>{r.message}</strong>
            <small>{r.path}</small>
          </div>
        ))}
        {state.reviews.length > 150 && (
          <p>Ensimmäiset 150 merkintää. Täysi lista sisältyy varmuuskopioon.</p>
        )}
        {!state.reviews.length && <Empty>Ei tuontiaineiston tarkistusmerkintöjä.</Empty>}
      </section>
    </>
  );
}
