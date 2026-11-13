import React, { useEffect, useState } from 'react';
import { formatMinutes, formatSignedMinutes } from './engine.js';

const dayNames = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'];
export function BalanceOverview({
  balance,
  compact = false,
  onOpen,
  saveSettings,
  disabled = false,
}) {
  const [draft, setDraft] = useState(balance.settings);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const signature = JSON.stringify(balance.settings);
  useEffect(() => {
    setDraft(balance.settings);
  }, [signature]);
  return (
    <section className="wt-panel wt-balance" aria-label="Työaikasaldon yleisnäkymä">
      <div className="wt-section-title">
        <div>
          <h2>Työajan tilanne</h2>
          <small>
            {balance.startDate && balance.rows.length
              ? `${balance.startDate} – ${balance.through}`
              : 'Ei vielä päättyneitä seurantapäiviä'}{' '}
            · {formatMinutes(balance.settings.weeklyMinutes)} / viikko
          </small>
        </div>
        {compact && (
          <button type="button" onClick={onOpen}>
            Avaa työaika →
          </button>
        )}
      </div>
      <div className="wt-balance-grid">
        <details className="wt-balance-main">
          <summary>
            <span>Jäljellä oleva laskennallinen vapaasaldo</span>
            <strong className={balance.balance < 0 ? 'wt-negative' : ''}>
              {formatSignedMinutes(balance.balance)}
            </strong>
            <small>
              {balance.balance < 0
                ? 'Alijäämää suhteessa työaikatavoitteeseen'
                : `${balance.dailyTarget ? Math.floor(Math.max(0, balance.balance) / balance.dailyTarget) : 0} kokonaista työpäivää vapaana`}{' '}
              · Avaa laskenta
            </small>
          </summary>
          <p>
            Alkusaldo {formatSignedMinutes(balance.settings.openingMinutes)} + lisäaika{' '}
            {formatMinutes(balance.extra)} + ylityön korotusosat {formatMinutes(balance.premium)} −
            tasaukseen käytetty aika {formatMinutes(balance.used)} ={' '}
            {formatSignedMinutes(balance.balance)}.
          </p>
          <p>
            Tehdyt tunnit lasketaan kerran. Korotuksista lisätään vain 50 % / 100 % lisäosa.
            Sunnuntaikorotuksen osuutta ei siirretä tähän saldoon. Vapaaksi vaihtaminen perustuu
            sopimukseen.
          </p>
          <a
            href="https://www.finlex.fi/fi/lainsaadanto/2019/872#chp_5__sec_21"
            target="_blank"
            rel="noreferrer"
          >
            Finlex 21 §
          </a>
        </details>
        <div>
          <span>Pidetyt vapaapäivät</span>
          <strong>{balance.freeDays} pv</strong>
          <small>
            {balance.weekdayFreeDays} työpäivälle osuvaa · {balance.restDays} normaalia
            viikkovapaata
          </small>
        </div>
        <div>
          <span>Vapaiden ja lyhyiden päivien tasaus</span>
          <strong>−{formatMinutes(balance.used)}</strong>
          <small>Viikkovapaat eivät kuluta saldoa</small>
        </div>
        <div>
          <span>Tunnit / tavoite</span>
          <strong>
            {formatMinutes(balance.actual)} / {formatMinutes(balance.target)}
          </strong>
          <small>
            Tavallinen tuntiero {formatSignedMinutes(balance.rawBalance)} · ilman ylityökorotuksia
          </small>
        </div>
      </div>
      {!compact && (
        <>
          <details>
            <summary>Viikkokohtainen tasaus ja vapaapäivät</summary>
            <div className="wt-balance-table">
              <table>
                <thead>
                  <tr>
                    <th>Viikko alkaa</th>
                    <th>Tehty / tavoite</th>
                    <th>Vapaat</th>
                    <th>Korotusosat</th>
                    <th>Saldo viikon jälkeen</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.weeks.map((w) => (
                    <tr key={w.date}>
                      <td>{w.date}</td>
                      <td>
                        {formatMinutes(w.actual)} / {formatMinutes(w.target)}
                      </td>
                      <td>
                        {w.freeDays} pv ({w.weekdayFreeDays} työpäivää)
                      </td>
                      <td>+{formatMinutes(w.premium)}</td>
                      <td>{formatSignedMinutes(w.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Seuranta alkaa {balance.startDate || 'ensimmäisestä työmerkinnästä'}. Mukana ovat
              päättyneet päivät; tämä päivä otetaan mukaan, kun sen työmerkinnät ovat valmistuneet.
              Käynnissä olevan vuoron päiviä ja tulevia päiviä ei veloiteta.
            </p>
            <details>
              <summary>Päivien erittely</summary>
              {balance.rows.map((row) => (
                <p key={row.date}>
                  {row.date} ·{' '}
                  {row.free ? (row.scheduled ? 'vapaa työpäivänä' : 'viikkovapaa') : 'työpäivä'} ·
                  tehty {formatMinutes(row.actual)}, tavoite {formatMinutes(row.target)}, korotusosa
                  +{formatMinutes(row.premium)}, tasaus −{formatMinutes(row.used)}, saldo{' '}
                  {formatSignedMinutes(row.balance)}
                </p>
              ))}
            </details>
          </details>
          {saveSettings && (
            <details>
              <summary>Seurannan ja viikkotyöajan asetukset</summary>
              <form
                className="wt-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError('');
                  setSaved(false);
                  try {
                    if (await saveSettings(draft)) setSaved(true);
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                <div className="wt-fields">
                  <label>
                    Seurannan aloituspäivä
                    <input
                      type="date"
                      value={draft.startDate}
                      onChange={(e) => setDraft((s) => ({ ...s, startDate: e.target.value }))}
                    />
                    <small>Tyhjä = ensimmäinen merkintä. Tätä aiempia vapaita ei vähennetä.</small>
                  </label>
                  <label>
                    Viikkotyöaika (h)
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      required
                      value={draft.weeklyMinutes / 60}
                      onChange={(e) =>
                        setDraft((s) => ({ ...s, weeklyMinutes: Number(e.target.value) * 60 }))
                      }
                    />
                  </label>
                  <label>
                    Alkusaldo (h)
                    <input
                      type="number"
                      step="0.25"
                      required
                      value={draft.openingMinutes / 60}
                      onChange={(e) =>
                        setDraft((s) => ({ ...s, openingMinutes: Number(e.target.value) * 60 }))
                      }
                    />
                  </label>
                </div>
                <fieldset>
                  <legend>Säännölliset työpäivät</legend>
                  <div className="wt-actions">
                    {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                      <label key={day} className="wt-check">
                        <input
                          type="checkbox"
                          checked={draft.workDays.includes(day)}
                          onChange={(e) =>
                            setDraft((s) => ({
                              ...s,
                              workDays: e.target.checked
                                ? [...s.workDays, day]
                                : s.workDays.filter((d) => d !== day),
                            }))
                          }
                        />
                        {dayNames[day]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <small>
                  Valittu viikkotyöaika jaetaan tasan työpäiville. Seurannassa työmerkinnätön
                  työpäivä käyttää saldoa; lomia ja muita poissaololajeja ei erotella
                  automaattisesti.
                </small>
                {error && (
                  <p role="alert" className="wt-error">
                    {error}
                  </p>
                )}
                {saved && <p role="status">Asetukset tallennettu.</p>}
                <button type="submit" disabled={disabled}>
                  Tallenna saldoasetukset
                </button>
              </form>
            </details>
          )}
        </>
      )}
    </section>
  );
}
