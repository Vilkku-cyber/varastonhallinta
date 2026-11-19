import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculate,
  dateKey,
  localTime,
  toInstant,
  addDays,
  entryMinutes,
  formatMinutes,
  validateEntry,
  validateBalanceSettings,
} from './engine.js';
import { RULES } from './rules.js';
import { freshForm, formFrom, entryFrom } from './forms.js';
import './Worktime.css';
import { BalanceOverview } from './BalanceOverview.jsx';
import { calculateRest } from './rest.js';
import { RestOverview } from './RestOverview.jsx';

function MealChoice({ meal, minutes, onChange, disabled }) {
  return (
    <div className="wt-fields">
      <label>
        Ruokailu
        <select
          value={meal || 'legacy'}
          disabled={disabled}
          onChange={(e) => onChange('meal', e.target.value)}
        >
          {(!meal || meal === 'legacy') && (
            <option value="legacy">Säilytä aiemmat taukotiedot</option>
          )}
          <option value="with-work">Ruokailu työn ohessa – ei vähennystä</option>
          <option value="duty-free">Varsinainen ruokatauko – vähennetään työajasta</option>
          <option value="none">Ei ruokailua – ei vähennystä</option>
        </select>
      </label>
      {meal === 'duty-free' && (
        <label>
          Ruokatauko (min)
          <input
            type="number"
            min="1"
            required
            value={minutes}
            disabled={disabled}
            onChange={(e) => onChange('mealMinutes', Number(e.target.value))}
          />
        </label>
      )}
    </div>
  );
}

function LawLinks({ sections }) {
  return (
    <span className="wt-laws">
      {sections.map((number) => {
        const law = RULES.sections.find((s) => s.section === number);
        return (
          <a key={number} href={law.url} target="_blank" rel="noreferrer" title={law.title}>
            Finlex {number} §
          </a>
        );
      })}
    </span>
  );
}
function Stat({ title, value, children, sections }) {
  return (
    <details className="wt-stat">
      <summary>
        <span>{title}</span>
        <strong>{formatMinutes(value)}</strong>
        <small>Avaa laskenta</small>
      </summary>
      <p>{children}</p>
      <LawLinks sections={sections} />
    </details>
  );
}
function Occurrence({ label, value, onChange }) {
  return (
    <label>
      {label}
      <select value={value || 'first'} onChange={(e) => onChange(e.target.value)}>
        <option value="first">Ensimmäinen esiintymä</option>
        <option value="last">Toinen esiintymä</option>
      </select>
    </label>
  );
}
function isAmbiguous(value) {
  try {
    return toInstant(value) !== toInstant(value, 'last');
  } catch {
    return false;
  }
}

export function WorktimeView({ store }) {
  const {
    state,
    ready,
    connected,
    busy,
    error,
    perform,
    employees = [],
    actorId,
    selectedUserId,
    selectEmployee,
    canWrite = true,
    directoryError = '',
    local = false,
  } = store;
  const [now, setNow] = useState(Date.now());
  const [form, setForm] = useState(freshForm);
  const [mode, setMode] = useState('timer');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [copyDates, setCopyDates] = useState([]);
  const [copyDate, setCopyDate] = useState(dateKey());
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [timerMeal, setTimerMeal] = useState({ meal: 'with-work', mealMinutes: 30 });
  const editorRef = useRef(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const entries = Object.values(state.entries || {});
  const visible = entries.filter((e) => !e.deleted);
  const result = useMemo(
    () => calculate(Object.values(state.entries || {}), now, state.active, state.settings || {}),
    [state.entries, state.active, state.settings, Math.floor(now / 60000)],
  );
  const active = state.active;
  useEffect(() => {
    setTimerMeal({ meal: 'with-work', mealMinutes: 30 });
  }, [active?.id]);
  const restReport = useMemo(
    () => calculateRest(entries, now, state.active, state.rest, state.settings),
    [state.entries, state.active, state.rest, state.settings, Math.floor(now / 60000)],
  );
  const activeBreaks = active
    ? [
        ...(active.breaks || []),
        ...(active.pause ? [{ ...active.pause, end: new Date(now).toISOString() }] : []),
      ]
    : [];
  const activeMinutes = active
    ? Math.max(
        0,
        entryMinutes({
          start: active.start,
          end: new Date(now).toISOString(),
          breaks: activeBreaks,
        }),
      )
    : 0;
  const summary =
    selectedWeek === 'all' ? result.totals : result.weeks[selectedWeek] || result.totals;
  const allWeeks = Object.keys(result.weeks).sort().reverse();
  const shownEntries = visible
    .filter(
      (e) =>
        selectedWeek === 'all' ||
        (e.kind === 'off'
          ? e.date >= selectedWeek && e.date < addDays(selectedWeek, 7)
          : result.weeks[selectedWeek]?.days.some((d) => result.days[d].entryIds.includes(e.id))),
    )
    .sort((a, b) => (b.date || b.start).localeCompare(a.date || a.start));
  let preview = null;
  try {
    const candidate = entryFrom(form, '__preview');
    validateEntry(candidate);
    preview = candidate.kind === 'off' ? 0 : entryMinutes(candidate);
  } catch {
    /* Form may be incomplete while typing. */
  }
  const change = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setMessage('');
    setFormError('');
  };
  const edit = (entry) => {
    setForm(formFrom(entry));
    setCopyDates([]);
    setMode('manual');
    setFormError('');
    editorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  async function action(type) {
    setMessage('');
    if (
      await perform({ type, activeId: active?.id, activeRevision: active?.revision, ...timerMeal })
    ) {
      setMessage(
        type === 'stop'
          ? 'Työpäivä tallennettu. Tarkista tauot ja mahdolliset ylityöt merkinnän Muokkaa-painikkeesta.'
          : 'Ajastimen tila tallennettu.',
      );
    }
  }
  async function save(e) {
    e.preventDefault();
    setFormError('');
    setMessage('');
    try {
      const entry = entryFrom(form);
      validateEntry(entry);
      const items = [entry];
      for (const date of copyDates.filter(
        (d) => d !== (entry.kind === 'off' ? entry.date : dateKey(entry.start)),
      )) {
        const offset = Math.round(
          (Date.parse(`${date}T12:00Z`) - Date.parse(`${form.date}T12:00Z`)) / 86400000,
        );
        const shift = (value) => `${addDays(value.slice(0, 10), offset)}${value.slice(10)}`;
        const copied = {
          ...form,
          id: crypto.randomUUID(),
          revision: 0,
          date,
          employerApproved: 'unknown',
          employeeConsent: 'unknown',
          start: form.start ? shift(form.start) : '',
          end: form.end ? shift(form.end) : '',
          breaks: form.breaks.map((b) =>
            b.start ? { ...b, start: shift(b.start), end: shift(b.end) } : b,
          ),
        };
        const copy = entryFrom(copied);
        validateEntry(copy);
        items.push(copy);
      }
      if (await perform({ type: 'save', entries: items })) {
        setForm(freshForm());
        setCopyDates([]);
        setMessage(`${items.length} merkintää tallennettu.`);
      }
    } catch (e) {
      setFormError(e.message);
    }
  }
  function copyPrevious() {
    const previous = visible
      .filter((e) => e.kind !== 'off' && (e.date || dateKey(e.start)) < form.date)
      .sort((a, b) => (b.date || dateKey(b.start)).localeCompare(a.date || dateKey(a.start)))[0];
    if (!previous) {
      setFormError('Valittua päivää edeltävää merkintää ei löytynyt.');
      return;
    }
    const source = formFrom(previous),
      target = form.date;
    const offset = Math.round(
      (Date.parse(`${target}T12:00Z`) - Date.parse(`${source.date}T12:00Z`)) / 86400000,
    );
    const shift = (value) =>
      value ? `${addDays(value.slice(0, 10), offset)}${value.slice(10)}` : '';
    setForm({
      ...source,
      id: undefined,
      revision: 0,
      date: target,
      start: shift(source.start),
      end: shift(source.end),
      employerApproved: 'unknown',
      employeeConsent: 'unknown',
      breaks: source.breaks.map((b) =>
        b.start ? { ...b, start: shift(b.start), end: shift(b.end) } : b,
      ),
    });
    setFormError('');
    setMessage('Edellinen merkintä kopioitu lomakkeelle. Tarkista ajat ja tallenna.');
  }
  const unavailable = busy || !ready || !connected || !canWrite;
  return (
    <section className="wt-page">
      <header className="wt-header">
        <div>
          <h1>Työaika</h1>
          <p>Kirjaa päivä. Näe tunnit ja niiden perusteet.</p>
        </div>
        <span className={`wt-status ${connected && ready ? 'wt-online' : ''}`}>
          {busy
            ? 'Tallennetaan…'
            : connected && ready
              ? local
                ? 'Tallennus tähän selaimeen'
                : 'Yhteys tietokantaan'
              : 'Odotetaan tietokantayhteyttä'}
        </span>
      </header>
      <section className="wt-panel wt-employee">
        <label>
          Työntekijä / käyttäjä
          <select
            value={selectedUserId || ''}
            disabled={busy || !employees.length}
            onChange={(e) => selectEmployee(e.target.value)}
          >
            {employees.map((employee) => (
              <option key={employee.uid} value={employee.uid}>
                {employee.name}
                {employee.uid === actorId ? ' (minä)' : ''}
              </option>
            ))}
          </select>
        </label>
        <p>
          {canWrite
            ? 'Kirjaukset tallennetaan valitulle työntekijälle.'
            : 'Vain katselu – sinulla ei ole tämän työntekijän kirjausoikeutta.'}
        </p>
        {directoryError && <p role="status">{directoryError}</p>}
      </section>
      <div aria-live="polite" role="status">
        {message && <p className="wt-success">{message}</p>}
      </div>
      {(error || formError) && (
        <p className="wt-error" role="alert">
          {error || formError}
        </p>
      )}
      <BalanceOverview
        balance={result.balance}
        disabled={unavailable}
        saveSettings={
          canWrite
            ? async (settings) => {
                validateBalanceSettings(settings);
                return perform({
                  type: 'settings',
                  settings,
                  expectedRevision: state.revision || 0,
                });
              }
            : undefined
        }
      />
      <details className="wt-panel">
        <summary>
          Lepoaikojen seuranta · korvaamatta {formatMinutes(restReport.remaining)} · tarkistamatta{' '}
          {formatMinutes(restReport.observed)}
        </summary>
        <RestOverview report={restReport} state={state} perform={perform} disabled={unavailable} />
      </details>
      {canWrite ? (
        <section className="wt-panel" ref={editorRef}>
          <div className="wt-tabs" role="group" aria-label="Kirjaustapa">
            <button type="button" aria-pressed={mode === 'timer'} onClick={() => setMode('timer')}>
              Käynnistä ja pysäytä
            </button>
            <button
              type="button"
              aria-pressed={mode === 'manual'}
              onClick={() => setMode('manual')}
            >
              Kirjaa jälkikäteen / kopioi
            </button>
          </div>
          {mode === 'timer' ? (
            <div className="wt-timer">
              <p>{active ? 'Työpäivä käynnissä' : 'Valmis uuteen työpäivään'}</p>
              <strong className="wt-clock">
                {active ? formatMinutes(Math.floor(activeMinutes)) : '0 h 00 min'}
              </strong>
              {active && <p>Alkoi {localTime(active.start).replace('T', ' klo ')}</p>}
              {active && (
                <MealChoice
                  meal={timerMeal.meal}
                  minutes={timerMeal.mealMinutes}
                  disabled={unavailable}
                  onChange={(key, value) => setTimerMeal((m) => ({ ...m, [key]: value }))}
                />
              )}
              <div className="wt-actions">
                {!active ? (
                  <button
                    className="wt-primary"
                    disabled={unavailable}
                    onClick={() => action('start')}
                  >
                    Aloita työpäivä
                  </button>
                ) : (
                  <>
                    <button
                      className="wt-primary"
                      disabled={unavailable}
                      onClick={() => action('stop')}
                    >
                      Lopeta työpäivä
                    </button>
                  </>
                )}
              </div>
              <p className="wt-muted">
                Ajastin säilyy sivun sulkemisen yli. Tarkista ruokailu ennen työpäivän lopettamista.
              </p>
            </div>
          ) : (
            <form onSubmit={save} className="wt-form">
              <h2>{form.id ? 'Muokkaa merkintää' : 'Uusi merkintä'}</h2>
              <div className="wt-fields">
                <label>
                  Päivämäärä
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => {
                      const target = e.target.value;
                      if (!target) {
                        change('date', target);
                        return;
                      }
                      const offset = Math.round(
                        (Date.parse(`${target}T12:00Z`) - Date.parse(`${form.date}T12:00Z`)) /
                          86400000,
                      );
                      const shift = (value) =>
                        value && Number.isFinite(offset)
                          ? `${addDays(value.slice(0, 10), offset)}${value.slice(10)}`
                          : value;
                      setForm((f) => ({
                        ...f,
                        date: target,
                        start: shift(f.start),
                        end: shift(f.end),
                        breaks: f.breaks.map((b) =>
                          b.start ? { ...b, start: shift(b.start), end: shift(b.end) } : b,
                        ),
                      }));
                    }}
                  />
                </label>
                <button type="button" onClick={copyPrevious}>
                  Kopioi edellinen merkintä
                </button>
              </div>
              {form.kind !== 'off' && (
                <>
                  <div className="wt-fields">
                    <label>
                      Aloitusaika
                      <input
                        type="datetime-local"
                        required
                        value={form.start}
                        onChange={(e) => {
                          change('start', e.target.value);
                          if (e.target.value) change('date', e.target.value.slice(0, 10));
                        }}
                      />
                    </label>
                    <label>
                      Lopetusaika
                      <input
                        type="datetime-local"
                        required
                        value={form.end}
                        onChange={(e) => change('end', e.target.value)}
                      />
                    </label>
                  </div>
                  {(isAmbiguous(form.start) || isAmbiguous(form.end)) && (
                    <div className="wt-fields">
                      <p>Talviaikaan siirtyessä sama kellonaika esiintyy kahdesti.</p>
                      {isAmbiguous(form.start) && (
                        <Occurrence
                          label="Aloitusajan esiintymä"
                          value={form.startOccurrence}
                          onChange={(value) => change('startOccurrence', value)}
                        />
                      )}
                      {isAmbiguous(form.end) && (
                        <Occurrence
                          label="Lopetusajan esiintymä"
                          value={form.endOccurrence}
                          onChange={(value) => change('endOccurrence', value)}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
              {form.kind !== 'off' && (
                <MealChoice
                  meal={form.meal}
                  minutes={form.mealMinutes}
                  onChange={change}
                  disabled={unavailable}
                />
              )}
              {form.breaks.length > 0 && (
                <fieldset>
                  <legend>Aiemmin kirjatut muut tauot</legend>
                  {form.breaks.map((b, i) => (
                    <div className="wt-actions" key={i}>
                      <span>
                        {b.start
                          ? `${b.start.replace('T', ' ')} – ${b.end.replace('T', ' ')}`
                          : `${b.minutes} min`}
                      </span>
                      <label>
                        <input
                          type="checkbox"
                          checked={b.paid}
                          onChange={(e) =>
                            change(
                              'breaks',
                              form.breaks.map((item, j) =>
                                j === i ? { ...item, paid: e.target.checked } : item,
                              ),
                            )
                          }
                        />{' '}
                        Työaikaa
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          change(
                            'breaks',
                            form.breaks.filter((_, j) => j !== i),
                          )
                        }
                      >
                        Poista tauko
                      </button>
                    </div>
                  ))}
                </fieldset>
              )}
              <label>
                Muistiinpano
                <textarea
                  rows="2"
                  value={form.note}
                  onChange={(e) => change('note', e.target.value)}
                />
              </label>
              {!form.id && (
                <details>
                  <summary>Lisää sama vuoro usealle päivälle</summary>
                  <p>
                    Jokainen valittu päivä tallentuu uutena merkintänä. Jokaiselle päivälle voi
                    tehdä korjaukset erikseen.
                  </p>
                  <div className="wt-actions">
                    <label>
                      Kopiointipäivä
                      <input
                        type="date"
                        value={copyDate}
                        onChange={(e) => setCopyDate(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        copyDate && setCopyDates((dates) => [...new Set([...dates, copyDate])])
                      }
                    >
                      Lisää päivä
                    </button>
                    {copyDates.map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-label={`Poista kopiointipäivä ${d}`}
                        onClick={() => setCopyDates((dates) => dates.filter((x) => x !== d))}
                      >
                        {d} ×
                      </button>
                    ))}
                  </div>
                </details>
              )}
              <div className="wt-actions">
                <strong>
                  Työaika: {preview === null ? 'Tarkista ajat' : formatMinutes(preview)}
                </strong>
                <button className="wt-primary" disabled={unavailable} type="submit">
                  {form.id
                    ? 'Tallenna korjaus'
                    : `Tallenna${copyDates.length ? ' merkinnät' : ' päivä'}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(freshForm());
                    setCopyDates([]);
                    setFormError('');
                  }}
                >
                  Tyhjennä lomake
                </button>
              </div>
            </form>
          )}
        </section>
      ) : (
        active && (
          <section className="wt-panel">
            <p>
              {'Työpäivä käynnissä'} · alkoi {localTime(active.start).replace('T', ' ')} ·{' '}
              {formatMinutes(Math.floor(activeMinutes))} työtä
            </p>
          </section>
        )
      )}
      <section className="wt-panel">
        <div className="wt-section-title">
          <h2>Työajan yhteenveto</h2>
          <label>
            Tarkastelu
            <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
              <option value="all">Kaikki kirjaukset</option>
              {allWeeks.map((w) => (
                <option key={w} value={w}>
                  Viikko {w} – {addDays(w, 6)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="wt-stats">
          <Stat title="Tehty työaika" value={summary.minutes} sections={[3, 24]}>
            Ruokailu työn ohessa on työaikaa. Varsinainen työvelvoitteista vapaa ruokatauko
            vähennetään valitun keston mukaan. Aiemmat taukotiedot säilyvät.
          </Stat>
          <Stat title="Normaali työaika" value={summary.regular} sections={[5, 16]}>
            Enintään 8 h päivässä ja 40 h viikossa. Päivittäinen ja viikoittainen ylityö on
            erotettu.
          </Stat>
          <Stat title="Vuorokautinen ylityö +50 %" value={summary.daily50} sections={[16, 20, 21]}>
            {formatMinutes(summary.daily50)} × 1,5 = {formatMinutes(summary.daily50 * 1.5)}{' '}
            laskennallista vapaata. Päivän ensimmäiset 2 h yli 8 tunnin.
          </Stat>
          <Stat
            title="Vuorokautinen ylityö +100 %"
            value={summary.daily100}
            sections={[16, 20, 21]}
          >
            {formatMinutes(summary.daily100)} × 2 = {formatMinutes(summary.daily100 * 2)}{' '}
            laskennallista vapaata. Päivän 10 h ylittävä työ.
          </Stat>
          <Stat title="Viikoittainen ylityö +50 %" value={summary.weekly50} sections={[16, 20, 21]}>
            {formatMinutes(summary.weekly50)} × 1,5 = {formatMinutes(summary.weekly50 * 1.5)}{' '}
            laskennallista vapaata. 40 h ylittävä työ, joka ei ole vuorokautista ylityötä.
          </Stat>
          <Stat title="Laskennallinen ylityökorvausvapaa" value={summary.leave} sections={[20, 21]}>
            50 % tunnit × 1,5 + 100 % tunnit × 2. Vapaasta on sovittava työnantajan kanssa. Tämä on
            laskelma, ei vahvistettu vapaasaldo.
          </Stat>
          <Stat
            title="Sunnuntai- ja juhlapäiväkorotus +100 %"
            value={summary.sunday}
            sections={[20, 21]}
          >
            Sunnuntain tai kansallisen juhlapäivän työ × 1 lisätään vapaasaldoon ylityön
            korotusosien lisäksi. Samalle päivälle osuva sunnuntai ja juhlapäivä lasketaan kerran.
            TES-lisiä ei käytetä. Korotukset käsitellään vapaana, ei rahana.
          </Stat>
        </div>
      </section>
      <section className="wt-panel">
        <h2>Merkinnät</h2>
        {!ready ? (
          <p>Tietoja ladataan…</p>
        ) : !shownEntries.length ? (
          <p>Ei vielä merkintöjä. Aloita ajastin tai kirjaa ensimmäinen työpäivä.</p>
        ) : (
          shownEntries.map((entry) => (
            <article className="wt-entry" key={entry.id}>
              <div>
                <strong>
                  {entry.kind === 'off'
                    ? `${entry.date} · Vapaapäivä`
                    : `${localTime(entry.start).replace('T', ' ')} – ${localTime(entry.end).replace('T', ' ')}`}
                </strong>
                <p>
                  {entry.kind !== 'off' && `${formatMinutes(entryMinutes(entry))} työtä`}
                  {entry.note && ` · ${entry.note}`}
                </p>
                <small>
                  Versio {entry.revision} · {entry.ruleVersion}
                </small>
              </div>
              <button disabled={busy || !canWrite} onClick={() => edit(entry)}>
                Muokkaa
              </button>
              <button
                disabled={unavailable}
                onClick={async () => {
                  if (await perform({ type: 'save', entries: [{ ...entry, deleted: true }] }))
                    setMessage('Merkintä siirretty poistettuihin. Voit palauttaa sen historiasta.');
                }}
              >
                Siirrä poistettuihin
              </button>
              <details>
                <summary>Päivien laskenta ja muutoshistoria</summary>
                {Object.values(result.days)
                  .filter((d) => d.entryIds.includes(entry.id))
                  .map((d) => (
                    <p key={d.date}>
                      {d.date}: yhteensä {formatMinutes(d.minutes)}, normaali{' '}
                      {formatMinutes(d.regular)}, päivä +50 % {formatMinutes(d.daily50)}, päivä +100
                      % {formatMinutes(d.daily100)}, viikko +50 % {formatMinutes(d.weekly50)}.{' '}
                      {d.entryIds.length > 1 && 'Päivään sisältyy useita merkintöjä.'}
                      <LawLinks sections={[16, 20, 42]} />
                    </p>
                  ))}
                {Object.values(state.history || {})
                  .filter((h) => (h.changes || []).some((c) => c.entryId === entry.id))
                  .sort((a, b) => b.revision - a.revision)
                  .map((h) => (
                    <details key={h.id}>
                      <summary>
                        {localTime(h.at).replace('T', ' ')} · muutos {h.revision}
                      </summary>
                      <p>
                        Tekijä: {h.actor} · sääntö {h.ruleSnapshot.id} · lakiversio{' '}
                        {h.ruleSnapshot.lawVersion}
                      </p>
                      <pre>
                        {JSON.stringify(
                          h.changes.find((c) => c.entryId === entry.id),
                          null,
                          2,
                        )}
                      </pre>
                      <details>
                        <summary>Tallennushetken laskelma ja lähteet</summary>
                        <pre>
                          {JSON.stringify(
                            { ...h.calculation, lepoajat: h.restCalculation },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </details>
                  ))}
              </details>
            </article>
          ))
        )}
      </section>
      <section className="wt-panel">
        <h2>Huomautukset</h2>
        <p>
          Huomautukset eivät estä todellisten aikojen tallennusta. Päivät ilman työmerkintää
          tulkitaan vapaapäiviksi. Vuorokausilepoa tarkastellaan vuoron alusta seuraavan 24 tunnin
          sisältä. Lepovajeiden perusteet ja korvaukset löytyvät lepoaikojen seurannasta.
        </p>
        {result.warnings
          .filter(
            (w) =>
              !['daily-rest', 'weekly-rest'].includes(w.code) &&
              (selectedWeek === 'all' ||
                !w.entryId ||
                shownEntries.some((e) => e.id === w.entryId)),
          )
          .map((w, i) => (
            <details className="wt-warning" key={`${w.code}-${i}`}>
              <summary>{w.text}</summary>
              <p>
                {w.entryId
                  ? `Merkintä: ${localTime(state.entries[w.entryId].start).replace('T', ' ')}`
                  : 'Viikkotason tarkastelu'}{' '}
                · sääntö {RULES.id}
              </p>
              <LawLinks sections={w.sections} />
            </details>
          ))}
        <LawLinks sections={[18, 24, 25, 27, 28]} />
      </section>
      <section className="wt-panel">
        <details>
          <summary>Poistetut merkinnät ({entries.filter((e) => e.deleted).length})</summary>
          {entries
            .filter((e) => e.deleted)
            .map((entry) => (
              <p key={entry.id}>
                {entry.date || dateKey(entry.start)} · {entry.note || 'Merkintä'}{' '}
                <button
                  disabled={unavailable}
                  onClick={() => perform({ type: 'save', entries: [{ ...entry, deleted: false }] })}
                >
                  Palauta merkintä
                </button>
              </p>
            ))}
        </details>
        <details>
          <summary>Kaikki lakiviitteet ja sääntöversio</summary>
          <p>
            {RULES.id} · {RULES.lawVersion} · tarkistettu {RULES.checkedAt}
          </p>
          {RULES.sections.map((law) => (
            <p key={law.section}>
              <a href={law.url} target="_blank" rel="noreferrer">
                {law.section} § · {law.title}
              </a>
            </p>
          ))}
        </details>
      </section>
    </section>
  );
}
