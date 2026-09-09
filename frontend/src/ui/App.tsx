import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Package,
  Warehouse,
  ListTodo,
  SlidersHorizontal,
  Monitor,
  BriefcaseBusiness,
  Plus,
  ArrowUpRight,
  Menu,
  LogOut,
} from 'lucide-react';
import { type State, type Product, type Trip, type Item, open } from '../domain/model';
import { type Command } from '../domain/commands';
import { type Repository, LocalRepository } from '../data/repository';
import {
  Dashboard,
  CalendarView,
  InventoryView,
  TasksView,
  SettingsView,
  PlannerView,
  TripCards,
} from './Views';
import { TripEditor } from './TripEditor';
import { ProductEditor } from './ProductEditor';
import { TripDetail } from './TripDetail';
import { Empty, Field } from './shared';
import { WarehouseView } from './WarehouseView';
type Page =
  'dashboard' | 'trips' | 'calendar' | 'inventory' | 'locations' | 'planner' | 'tasks' | 'settings';
const nav = [
  ['dashboard', 'Etusivu', LayoutDashboard],
  ['trips', 'Keikat', BriefcaseBusiness],
  ['calendar', 'Kalenteri', CalendarDays],
  ['inventory', 'Kalusto', Package],
  ['locations', 'Varasto', Warehouse],
  ['planner', 'LED-suunnittelu', Monitor],
  ['tasks', 'Tehtävät', ListTodo],
  ['settings', 'Tiedot ja asetukset', SlidersHorizontal],
] as const;
let local: LocalRepository | undefined;
export function App() {
  const [repo, sr] = useState<Repository | null>(null);
  const [state, ss] = useState<State | null>(null);
  const [error, se] = useState('');
  const [missing, setMissing] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [authReady, sar] = useState(false);
  const [signed, sg] = useState(false);
  const [email, sem] = useState(''),
    [password, spw] = useState('');
  const [page, sp] = useState<Page>('dashboard');
  const [menu, sm] = useState(false);
  const [selected, sel] = useState('');
  const [editor, setEditor] = useState<{ trip?: Trip; seed?: Item[] } | null>(null);
  const [product, setProduct] = useState<{ product?: Product } | null>(null);
  const [archive, sa] = useState(false);
  const [query, sq] = useState('');
  const [toast, st] = useState('');
  const firebase = import.meta.env.VITE_STORAGE === 'firebase';
  useEffect(() => {
    if (!firebase) {
      local ??= new LocalRepository();
      sr(local);
      sar(true);
      return;
    }
    let off: undefined | (() => void);
    let alive = true;
    import('../data/firebaseRepository')
      .then((m) => {
        if (!alive) return;
        off = m.observeAuth(m.auth, (user) => {
          sg(!!user);
          sar(true);
          ss(null);
          sr(user ? new m.FirebaseRepository() : null);
        });
      })
      .catch((e) => {
        se(e.message);
        sar(true);
      });
    return () => {
      alive = false;
      off?.();
    };
  }, []);
  useEffect(() => {
    setMissing(false);
    return repo?.subscribe(
      (s) => {
        ss(s);
        se('');
        setMissing(false);
      },
      (e) => {
        se(e.message);
        setMissing((e as Error & { code?: string }).code === 'workspace/missing');
      },
    );
  }, [repo]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => st(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const run = async (c: Command) => {
    await repo!.dispatch(c);
    st('Tallennettu');
  };
  const go = (p: Page) => {
    sp(p);
    sel('');
    sm(false);
  };
  if (firebase && !signed && authReady)
    return (
      <main className="login-page">
        <div className="login-card">
          <div className="brand">
            AV<span>arsenal</span>
            <i>2.0</i>
          </div>
          <h1>Tervetuloa takaisin.</h1>
          <p>Kirjaudu yhteiseen kalustotyötilaan.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await (await import('../data/firebaseRepository')).login(email, password);
              } catch {
                se('Kirjautuminen ei onnistunut. Tarkista tunnus ja salasana.');
              }
            }}
          >
            <Field label="Sähköposti">
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => sem(e.target.value)}
              />
            </Field>
            <Field label="Salasana">
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => spw(e.target.value)}
              />
            </Field>
            <button>Kirjaudu sisään</button>
          </form>
          <button
            className="text-button"
            onClick={async () => {
              try {
                await (await import('../data/firebaseRepository')).resetPassword(email);
                se('Jos tunnus on käytössä, palautusohje lähetetään sähköpostiin.');
              } catch {
                se('Anna kelvollinen sähköpostiosoite.');
              }
            }}
          >
            Unohtuiko salasana?
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </div>
      </main>
    );
  if (!state || !repo)
    return (
      <main className="loading">
        <div className="brand">
          AV<span>arsenal</span>
          <i>2.0</i>
        </div>
        <p>{error || 'Avataan työtilaa…'}</p>
        {missing && signed && import.meta.env.VITE_DEMO_SETUP === 'enabled' && (
          <div>
            <p>
              Luo 8 testituotetta ja 3 testikeikkaa yhteiseen 2.0-työtilaan. Vanhaa varastoa ei
              muuteta.
            </p>
            <button
              disabled={initializing}
              onClick={async () => {
                setInitializing(true);
                try {
                  await repo?.initializeDemo?.();
                } catch (e) {
                  se(e instanceof Error ? e.message : 'Alustus epäonnistui.');
                } finally {
                  setInitializing(false);
                }
              }}
            >
              {initializing ? 'Alustetaan…' : 'Alusta verkkotestin esimerkkiaineisto'}
            </button>
          </div>
        )}
      </main>
    );
  const detail = state.trips[selected];
  const trips = Object.values(state.trips)
    .filter((t) => (archive ? !open(t) : open(t)))
    .filter((t) =>
      `${t.name} ${t.contact} ${t.items.map((i) => `${i.name} ${i.serialSnapshots.join(' ')}`).join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => (archive ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
  return (
    <div className="app-shell">
      <aside className={'sidebar no-print ' + (menu ? 'show' : '')}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go('dashboard');
          }}
        >
          AV<span>arsenal</span>
          <i>2.0</i>
        </a>
        <div className="workspace-label">
          <i className="dot" /> KALUSTO & TUOTANTO
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)}>
              <Icon size={19} />
              {label}
              {id === 'trips' && <span>{Object.values(state.trips).filter(open).length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-icon">AV</div>
          <div>
            <strong>{firebase ? 'Yhteinen työtila' : 'Paikallinen työtila'}</strong>
            <small>{firebase ? 'Firebase RTDB' : 'Tiedot tässä selaimessa'}</small>
          </div>
          {firebase && (
            <button
              className="icon-button"
              aria-label="Kirjaudu ulos"
              onClick={() => void import('../data/firebaseRepository').then((m) => m.logout())}
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar no-print">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="Avaa valikko"
              onClick={() => sm(!menu)}
            >
              <Menu size={22} />
            </button>
            <span>Työtila</span>
            <span className="slash">/</span>
            <b>{nav.find((n) => n[0] === page)?.[1]}</b>
          </div>
          <div>
            <span className="environment">
              <i className="dot" />
              {firebase ? 'Yhteinen tietokanta' : 'Paikallinen · 2.0 alpha'}
            </span>
            <span className="avatar">AV</span>
          </div>
        </header>
        <main className="content">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {detail ? (
            <TripDetail
              state={state}
              trip={detail}
              back={() => sel('')}
              edit={() => setEditor({ trip: detail })}
              run={run}
            />
          ) : (
            <>
              {page === 'dashboard' && (
                <Dashboard
                  state={state}
                  select={(id) => {
                    sel(id);
                    sp('trips');
                  }}
                  create={() => setEditor({})}
                />
              )}
              {page === 'trips' && (
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">SUUNNITTELE, PAKKAA, PALAUTA</p>
                      <h1>Keikat</h1>
                    </div>
                    <button onClick={() => setEditor({})}>
                      <Plus size={18} /> Uusi keikka
                    </button>
                  </div>
                  <div className="filters">
                    <div className="tabs">
                      <button className={!archive ? 'selected' : ''} onClick={() => sa(false)}>
                        Aktiiviset
                      </button>
                      <button className={archive ? 'selected' : ''} onClick={() => sa(true)}>
                        Arkisto
                      </button>
                    </div>
                    <input
                      aria-label="Hae keikkaa"
                      placeholder="Keikka, tuote tai sarjanumero…"
                      value={query}
                      onChange={(e) => sq(e.target.value)}
                    />
                  </div>
                  {trips.length ? (
                    <TripCards trips={trips} select={sel} />
                  ) : (
                    <Empty>Ei hakua vastaavia keikkoja.</Empty>
                  )}
                </>
              )}
              {page === 'calendar' && <CalendarView state={state} select={sel} />}
              {page === 'inventory' && (
                <InventoryView state={state} edit={(p) => setProduct({ product: p })} />
              )}
              {page === 'locations' && <WarehouseView state={state} run={run} />}
              {page === 'tasks' && <TasksView state={state} run={run} />}
              {page === 'settings' && <SettingsView state={state} repo={repo} />}
              {page === 'planner' && (
                <PlannerView
                  state={state}
                  create={(seed) => setEditor({ seed })}
                  append={async (t, rows) => {
                    const items = structuredClone(t.items);
                    for (const row of rows) {
                      const previous = items.find((i) => i.productId === row.productId);
                      if (previous) previous.quantity += row.quantity;
                      else items.push(row);
                    }
                    await run({ type: 'trip', trip: { ...t, items }, expected: t.version });
                  }}
                />
              )}
            </>
          )}
          <footer className="app-footer no-print">
            <span>
              AV-arsenal <b>2.0</b> · Kalusto hallinnassa.
            </span>
            <button className="text-button" onClick={() => go('settings')}>
              Työtilan tiedot <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast no-print" role="status">
          ✓ {toast}
        </div>
      )}
      {editor && (
        <TripEditor
          state={state}
          trip={editor.trip}
          seed={editor.seed}
          close={() => setEditor(null)}
          save={async (t) => {
            await run({ type: 'trip', trip: t, expected: editor.trip?.version ?? 0 });
            sel(t.id);
            sp('trips');
          }}
        />
      )}
      {product && (
        <ProductEditor
          product={product.product}
          close={() => setProduct(null)}
          save={async (p) =>
            run({ type: 'product', product: p, expected: product.product?.version ?? 0 })
          }
        />
      )}
    </div>
  );
}
