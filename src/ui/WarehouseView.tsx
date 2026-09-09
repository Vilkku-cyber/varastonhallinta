import { useEffect, useRef, useState } from 'react';
import { Map, Search, Settings2, MapPin, ArrowLeft } from 'lucide-react';
import type { State } from '../domain/model';
import type { Command } from '../domain/commands';
import { locationLabel, searchWarehouse, shelfElevation } from '../domain/warehouse';
import { LocationsView } from './Views';
import { Empty } from './shared';
import './warehouse.css';

// Coordinates follow the original floor-plan image. Unmapped shelves remain in the list.
const mapShelves = [
  { id: 'A', x: 10.3, y: 28 },
  { id: 'B', x: 15.4, y: 28 },
  { id: 'C', x: 38.7, y: 46 },
  { id: 'D', x: 43, y: 46 },
  { id: 'E', x: 53, y: 40 },
  { id: 'F', x: 57.5, y: 40 },
  { id: 'G', x: 92.5, y: 44 },
  { id: 'H', x: 80.5, y: 89 },
  { id: 'J', x: 60, y: 89 },
  { id: 'K', x: 12, y: 66 },
  { id: 'L', x: 12, y: 76 },
  { id: 'M', x: 14, y: 92 },
];
export function WarehouseView({
  state,
  run,
}: {
  state: State;
  run: (c: Command) => Promise<void>;
}) {
  const [mode, setMode] = useState<'map' | 'search' | 'manage'>('map');
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState('');
  const [highlight, setHighlight] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const results = searchWarehouse(state, query);
  const matchedLocations = new Set(results.map((r) => r.location.id));
  const matchedShelves = new Set(results.map((r) => r.location.shelf));
  const shelves = [...new Set(Object.values(state.locations).map((l) => l.shelf))].sort((a, b) =>
    a.localeCompare(b, 'fi', { numeric: true }),
  );
  const elevation = shelfElevation(state, shelf);
  useEffect(() => {
    if (shelf && mode === 'map') heading.current?.focus({ preventScroll: true });
  }, [shelf, highlight, mode]);
  const show = (shelf: string, locationId = '') => {
    setShelf(shelf);
    setHighlight(locationId);
    setMode('map');
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FYYSINEN VARASTO</p>
          <h1>Varastokartta ja hyllyhaku</h1>
          <p className="subtitle">
            Etsi tuote, sarjanumero tai hyllypaikka. Näet missä tavara sijaitsee.
          </p>
        </div>
      </div>
      <div className="warehouse-toolbar">
        <div className="tabs" aria-label="Varaston näkymä">
          <button
            className={mode === 'map' ? 'selected' : ''}
            aria-pressed={mode === 'map'}
            onClick={() => setMode('map')}
          >
            <Map size={16} /> Kartta
          </button>
          <button
            className={mode === 'search' ? 'selected' : ''}
            aria-pressed={mode === 'search'}
            onClick={() => setMode('search')}
          >
            <Search size={16} /> Hyllyhaku
          </button>
          <button
            className={mode === 'manage' ? 'selected' : ''}
            aria-pressed={mode === 'manage'}
            onClick={() => setMode('manage')}
          >
            <Settings2 size={16} /> Hallinta
          </button>
        </div>
      </div>
      {mode === 'manage' ? (
        <LocationsView state={state} run={run} />
      ) : (
        <>
          <form
            className="warehouse-search"
            onSubmit={(e) => {
              e.preventDefault();
              setMode('search');
            }}
          >
            <div className="search">
              <Search size={18} />
              <input
                aria-label="Hyllyhaku"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tuote, sarjanumero tai hyllypaikka (esim. A11)…"
              />
            </div>
            <button type="submit">Hae hyllyistä</button>
            {query && (
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setQuery('');
                  setHighlight('');
                }}
              >
                Tyhjennä
              </button>
            )}
          </form>
          {mode === 'search' ? (
            <section className="panel warehouse-results">
              <div className="section-heading">
                <h2>Hakutulokset</h2>
                <span role="status">{results.length} osumaa</span>
              </div>
              {!query.trim() ? (
                <Empty>Kirjoita tuotteen nimi, sarjanumero tai hyllypaikka.</Empty>
              ) : !results.length ? (
                <Empty>Hakua vastaavaa hyllypaikkaa ei löytynyt.</Empty>
              ) : (
                results.map((r) => (
                  <article
                    className="warehouse-result"
                    key={`${r.location.id}/${r.placement?.id ?? 'empty'}`}
                  >
                    <MapPin size={20} />
                    <div>
                      <strong>{r.name}</strong>
                      <p>
                        Hylly {r.location.shelf} · väli {r.location.aisle} · taso {r.location.level}
                      </p>
                      <small>
                        {r.placement?.productId
                          ? 'Kalustotuote'
                          : r.placement
                            ? 'Hyllymerkintä'
                            : 'Tyhjä paikka'}
                      </small>
                    </div>
                    <button
                      className="secondary small"
                      onClick={() => show(r.location.shelf, r.location.id)}
                      aria-label={`Näytä kartalla ${r.name}, ${locationLabel(r.location)}`}
                    >
                      Näytä kartalla
                    </button>
                  </article>
                ))
              )}
            </section>
          ) : (
            <>
              <section className="panel warehouse-map-panel">
                <div className="section-heading">
                  <h2>Varaston pohjakartta</h2>
                  <span>{shelf ? `Valittu hylly ${shelf}` : 'Valitse hylly kartalta'}</span>
                </div>
                <div className="warehouse-map-scroll">
                  <div className="warehouse-map">
                    <img
                      src="/images/VARASTOKARTTA.png"
                      alt="Varaston pohjapiirros ja valittavat hyllyt"
                      width="1320"
                      height="610"
                    />
                    {mapShelves.map((m) => (
                      <button
                        key={m.id}
                        className={`warehouse-map-marker ${shelf === m.id ? 'chosen' : ''} ${matchedShelves.has(m.id) ? 'matched' : ''} ${shelves.includes(m.id) ? '' : 'unrecorded'}`}
                        style={{ left: `${m.x}%`, top: `${m.y}%` }}
                        aria-pressed={shelf === m.id}
                        aria-label={`Avaa hylly ${m.id}`}
                        onClick={() => show(m.id)}
                      >
                        {m.id}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="hint map-help">
                  Vihreä: tallennettu hylly. Keltainen: haun osuma tai valittu hylly. Katkoviiva:
                  hyllylle ei ole tallennettu paikkoja. Karttaa voi vierittää pienellä näytöllä.
                </p>
                <div className="warehouse-shelf-buttons" aria-label="Kaikki tallennetut hyllyt">
                  {shelves.map((id) => (
                    <button
                      key={id}
                      className={`secondary small ${id === shelf ? 'selected-shelf' : ''}`}
                      aria-pressed={id === shelf}
                      onClick={() => show(id)}
                    >
                      Hylly {id}
                    </button>
                  ))}
                </div>
              </section>
              {shelf && (
                <section className="panel shelf-elevation-panel">
                  <div className="section-heading">
                    <h2 tabIndex={-1} ref={heading}>
                      Hylly {shelf}
                    </h2>
                    <div className="actions">
                      <span className="hint">
                        {elevation.direction === 'rtl'
                          ? 'Välit oikealta vasemmalle'
                          : 'Välit vasemmalta oikealle'}
                      </span>
                      {query && (
                        <button className="secondary small" onClick={() => setMode('search')}>
                          <ArrowLeft size={14} /> Takaisin hakutuloksiin
                        </button>
                      )}
                    </div>
                  </div>
                  {!elevation.aisles.length ? (
                    <Empty>
                      Tälle hyllylle ei ole tallennettu paikkoja. Lisää paikat Hallinta-näkymässä.
                    </Empty>
                  ) : (
                    <div className="shelf-elevation-scroll">
                      <div
                        className="shelf-elevation"
                        style={{
                          gridTemplateColumns: `repeat(${elevation.aisles.length}, minmax(190px, 1fr))`,
                        }}
                      >
                        {elevation.aisles.map((a) => (
                          <div className="shelf-aisle" key={a.aisle}>
                            <h3>Väli {a.aisle}</h3>
                            {a.levels.map((l) => (
                              <article
                                key={l.id}
                                data-location-id={l.id}
                                className={`shelf-level ${highlight === l.id ? 'focused-location' : ''} ${matchedLocations.has(l.id) ? 'search-location' : ''}`}
                                aria-label={`Hyllypaikka ${locationLabel(l)}${highlight === l.id ? ', valittu hakutulos' : ''}`}
                              >
                                <header>
                                  <strong>{locationLabel(l)}</strong>
                                  <small>Taso {l.level}</small>
                                </header>
                                <ul>
                                  {Object.values(state.placements)
                                    .filter((p) => p.locationId === l.id)
                                    .map((p) => (
                                      <li key={p.id}>
                                        {state.products[p.productId]?.name ?? p.label}
                                      </li>
                                    ))}
                                </ul>
                                {!Object.values(state.placements).some(
                                  (p) => p.locationId === l.id,
                                ) && <p className="muted">Tyhjä paikka</p>}
                              </article>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
