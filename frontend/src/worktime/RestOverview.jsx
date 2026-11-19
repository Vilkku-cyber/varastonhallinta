import React, { useState } from 'react';
import { formatMinutes, localTime, toInstant } from './engine.js';
import { RULES } from './rules.js';

const stamp = (value) => localTime(value).replace('T', ' ');
function Debt({ debt, report, perform, revision, disabled }) {
  const [review, setReview] = useState({
    confirmed: false,
    reason: '',
    deferralReason: '',
    minutes: 0,
    ...debt.review,
    basis: debt.type === 'daily' ? 'continuity25' : 'exception28',
  });
  const [receipt, setReceipt] = useState({ start: '', end: '', minutes: debt.remaining });
  const [error, setError] = useState('');
  const send = (payload) =>
    perform({ type: 'rest', expectedRevision: revision, debtId: debt.id, ...payload });
  const field = (name, value) => setReview((r) => ({ ...r, [name]: value }));
  return (
    <details className="wt-warning">
      <summary>
        {debt.date} · {debt.type === 'daily' ? 'Vuorokausilepo' : 'Viikkolepo'} ·{' '}
        {formatMinutes(debt.remaining)}
        {' · '}
        {!debt.remaining
          ? 'Korvattu'
          : debt.overdue
            ? 'Määräaika ohitettu'
            : debt.confirmed
              ? 'Korvaamatta'
              : 'Peruste tarkistamatta'}
      </summary>
      <p>
        Tarkastelu {stamp(debt.start)} – {stamp(debt.end)}. Pisin yhtenäinen lepo{' '}
        {formatMinutes(debt.observed)}. Havaittu vajaus {formatMinutes(debt.minutes)}. Vahvistettu
        korvaustarve {debt.confirmed ? formatMinutes(debt.required) : 'tarkistamatta'}. Korvattu{' '}
        {formatMinutes(debt.repaid)}. Seurannan takaraja {debt.deadline}.
      </p>
      {debt.type === 'weekly' && (
        <p>
          Vajaus on havainto, ei automaattinen korvausmäärä. Kirjaa §28:n perusteella viikkolevon
          aikana tehtyä työtä vastaava aika. Kolmen kuukauden seurantaraja lasketaan varovaisesti
          viikon alusta; korvaus annetaan mahdollisimman pian.
        </p>
      )}
      {!debt.exceptionEligible && (
        <p>
          Tämä lyhennys ei täytä käytössä olevan §25:n poikkeuksen rajoja: vähintään 5 h lepoa ja
          enintään kolme peräkkäistä lyhennystä. Havainto säilyy näkyvissä.
        </p>
      )}
      <form
        className="wt-form"
        onSubmit={(e) => {
          e.preventDefault();
          send({ review });
        }}
      >
        <label>
          Poikkeuksen peruste
          <textarea
            required
            rows="2"
            value={review.reason}
            disabled={disabled}
            onChange={(e) => field('reason', e.target.value)}
            placeholder={
              debt.type === 'daily'
                ? 'Miksi työ oli välttämätöntä toiminnan jatkuvuuden turvaamiseksi?'
                : 'Miksi viikkolevosta poikkeaminen oli §28:n mukaan välttämätöntä?'
            }
          />
        </label>
        <label>
          Painava työn järjestelyihin liittyvä syy korvaavan vuorokausilevon siirtämiseen
          <textarea
            rows="2"
            value={review.deferralReason}
            onChange={(e) => field('deferralReason', e.target.value)}
            disabled={disabled}
          />
        </label>
        {debt.type === 'weekly' && (
          <label>
            Vahvistettu viikkolevon korvaus (min)
            <input
              type="number"
              min="1"
              max="10080"
              value={review.minutes}
              disabled={disabled}
              onChange={(e) => field('minutes', Number(e.target.value))}
            />
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={review.confirmed}
            disabled={disabled || !debt.exceptionEligible}
            onChange={(e) => field('confirmed', e.target.checked)}
          />{' '}
          Poikkeuksen edellytykset on tarkistettu ja korvaustarve vahvistettu
        </label>
        <button disabled={disabled}>Tallenna peruste</button>
      </form>
      {debt.confirmed && debt.remaining > 0 && (
        <form
          className="wt-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            try {
              await send({
                allocation: {
                  start: toInstant(receipt.start),
                  end: toInstant(receipt.end, 'last'),
                  minutes: Number(receipt.minutes),
                },
              });
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          <h3>Kohdista toteutunut korvaava lepo</h3>
          <p>
            Vuorokausilepoon lisätään korvaus yhtenäisenä normaalin 11 h levon päälle. Vähintään 35
            h jaksoissa varataan ensin 35 h viikkolepoon. Viikkolevon korvaus kohdistetaan tässä
            seurannassa 35 h ylittävään lepo-osaan. Sama lisäaika voidaan käyttää vain kerran.
          </p>
          <label>
            Kirjauksista löytyvä lepojakso
            <select
              defaultValue=""
              onChange={(e) => {
                const gap = report.gaps[Number(e.target.value)];
                if (gap)
                  setReceipt((r) => ({
                    ...r,
                    start: localTime(gap.start),
                    end: localTime(gap.end),
                  }));
              }}
            >
              <option value="">Valitse tai anna ajat</option>
              {report.gaps.map((gap, i) => (
                <option key={gap.start} value={i}>
                  {stamp(gap.start)} – {stamp(gap.end)} ({formatMinutes(gap.minutes)})
                </option>
              ))}
            </select>
          </label>
          <div className="wt-fields">
            <label>
              Yhtenäisen levon alku
              <input
                required
                type="datetime-local"
                value={receipt.start}
                onChange={(e) => setReceipt((r) => ({ ...r, start: e.target.value }))}
              />
            </label>
            <label>
              Yhtenäisen levon loppu
              <input
                required
                type="datetime-local"
                value={receipt.end}
                onChange={(e) => setReceipt((r) => ({ ...r, end: e.target.value }))}
              />
            </label>
            <label>
              Korvaukseen kohdistetaan (min)
              <input
                required
                type="number"
                min="0.1"
                step="0.1"
                max={debt.remaining}
                value={receipt.minutes}
                onChange={(e) => setReceipt((r) => ({ ...r, minutes: e.target.value }))}
              />
            </label>
          </div>
          <p>
            Vahvistamalla kirjaat, ettei korvaavaa lepoa pidetty varallaoloaikana eikä sitä käytetä
            muuhun lepokorvaukseen. Viikkolevon korvaus on annettava säännöllistä työaikaa
            lyhentämällä.
          </p>
          <button disabled={disabled}>Vahvista pidetty korvaava lepo</button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
      {debt.receipts.map((receipt) => (
        <p key={receipt.at}>
          Korvaus {stamp(receipt.start)} – {stamp(receipt.end)}: {formatMinutes(receipt.minutes)}
        </p>
      ))}
      <p>
        Sääntö {RULES.id}.{' '}
        <a
          target="_blank"
          rel="noreferrer"
          href={RULES.sections.find((s) => s.section === (debt.type === 'daily' ? 25 : 28)).url}
        >
          Finlex {debt.type === 'daily' ? 25 : 28} §
        </a>
      </p>
    </details>
  );
}

export function RestOverview({ report, state, perform, disabled = false, compact = false }) {
  return (
    <section className="wt-panel" aria-label="Lepoaikojen seuranta">
      <h2>Lepoaikojen seuranta</h2>
      <div className="wt-rest-summary">
        <div>
          <span>Vahvistettu, vielä korvaamatta</span>
          <strong>{formatMinutes(report.remaining)}</strong>
        </div>
        <div>
          <span>Havaitut vajaukset, peruste tarkistamatta</span>
          <strong>{formatMinutes(report.observedDaily)} vuorokausilepoa</strong>
          <span>{formatMinutes(report.observedWeekly)} viikkolepoa (arvio)</span>
        </div>
        <div>
          <span>Kohdistettu korvaava lepo</span>
          <strong>{formatMinutes(report.repaid)}</strong>
        </div>
      </div>
      {report.debts.some((d) => d.remaining > 0) && (
        <p>
          Seuraava seurannan takaraja:{' '}
          <strong>
            {
              report.debts
                .filter((d) => d.remaining > 0)
                .map((d) => d.deadline)
                .sort()[0]
            }
          </strong>
          . Vuorokausi- ja viikkolevon havainnot tarkistetaan erikseen.
        </p>
      )}
      <p>
        Viikkolevon tasaus: keskimäärin 35 h / 14 vrk, vähintään 24 h kummassakin 7 vrk jaksossa.
        Jaksot alkavat seurannan ensimmäisen viikon maanantaista. Työvuorojen muuttuminen laskee
        havainnot ja kohdistukset uudelleen.
      </p>
      {!compact && (
        <>
          <p>
            Tapahtuman kiire ei yksin vahvista poikkeuksen laillisuutta. Vuorokausilevon korvaus
            annetaan ensisijaisesti seuraavan levon yhteydessä, painavasta työn järjestelysyystä
            viimeistään 14 vrk:ssa. Vapaapäivä ei automaattisesti kuittaa vajetta. Lakisääteinen
            korvaava lepo seurataan erillään ylityön vapaasaldosta.
          </p>
          <details>
            <summary>Viikkolevon 14 vrk jaksot</summary>
            <p>
              Tarkastelu käyttää jaksojen sisään osuvia lepo-osia. Rajan yli jatkuva lepo ja
              mahdollinen päivystys tarkistetaan perusteita vahvistettaessa. Keskeneräistä tai ennen
              seurannan alkua alkanutta jaksoa ei hyväksytä valmiiksi.
            </p>
            {report.pairs.map((p) => (
              <p key={p.date}>
                {p.date} – {p.endDate}: {formatMinutes(p.first)} /{' '}
                {p.second === null ? 'kesken' : formatMinutes(p.second)} ·{' '}
                {p.complete
                  ? p.valid
                    ? '35 h keskiarvo ja 24 h vähimmäiset täyttyvät kirjauksissa'
                    : 'Tarkistettava'
                  : 'Jakso kesken / seurannan alkuraja'}
              </p>
            ))}
          </details>
          {report.debts.length === 0 ? (
            <p>Päättyneissä tarkastelujaksoissa ei havaittuja lepovajeita.</p>
          ) : (
            report.debts.map((debt) => (
              <Debt
                key={`${debt.id}-${state.revision}`}
                debt={debt}
                report={report}
                perform={perform}
                revision={state.revision || 0}
                disabled={disabled}
              />
            ))
          )}
          {report.invalidAllocations.length > 0 && (
            <p role="alert">
              {report.invalidAllocations.length} aiempaa lepokohdistusta ei enää vastaa laskennan
              ehtoja. Niitä ei lasketa pidetyksi korvaukseksi.
            </p>
          )}
          <details>
            <summary>Korvaavan levon kohdistukset ja korjaukset</summary>
            {Object.entries(state.rest?.allocations || {}).map(([id, a]) => (
              <p key={id}>
                {stamp(a.start)} – {stamp(a.end)} · {formatMinutes(a.minutes)}{' '}
                <button
                  disabled={disabled}
                  onClick={() =>
                    perform({
                      type: 'rest',
                      expectedRevision: state.revision || 0,
                      removeAllocation: id,
                    })
                  }
                >
                  Poista kohdistus
                </button>
              </p>
            ))}
          </details>
          <details>
            <summary>Lepoaikojen muutoshistoria</summary>
            {Object.values(state.history || {})
              .filter((h) => h.type === 'rest')
              .sort((a, b) => b.revision - a.revision)
              .map((h) => (
                <details key={h.id}>
                  <summary>
                    {stamp(h.at)} · muutos {h.revision} · tekijä {h.actor}
                  </summary>
                  <p>
                    Korvaamatta tallennushetkellä {formatMinutes(h.restCalculation?.remaining)}.
                    Sääntö {h.ruleSnapshot.id}.
                  </p>
                  <details>
                    <summary>Alkuperäiset tiedot, korjaus ja laskennan perusteet</summary>
                    <pre>
                      {JSON.stringify(
                        {
                          ennen: h.restBefore,
                          jälkeen: h.restAfter,
                          laskelma: h.restCalculation,
                          sääntö: h.ruleSnapshot,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </details>
              ))}
          </details>
          <p>
            {[25, 27, 28].map((n) => (
              <a
                key={n}
                style={{ marginRight: '1rem' }}
                target="_blank"
                rel="noreferrer"
                href={RULES.sections.find((s) => s.section === n).url}
              >
                Finlex {n} §
              </a>
            ))}
          </p>
        </>
      )}
    </section>
  );
}
