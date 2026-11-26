import { useEffect, useState } from 'react';
import type { State } from '../domain/model';
import type { Command } from '../domain/commands';
import {
  parseLedProject,
  projectChanges,
  type CurveDocument,
  type LedConfiguration,
  type LedProjectDraft,
} from '../domain/ledProjects';
import { availability } from '../domain/calendar';
import { bundleForTrip } from '../domain/bundles';
import { Field, uid } from './shared';
export type LedSelection = { tripId: string; planId: string };
export function LedProjectControls({
  state,
  configuration,
  curve,
  load,
  run,
  initialSelection,
}: {
  state: State;
  configuration: LedConfiguration;
  curve: CurveDocument | null;
  load: (project: LedProjectDraft) => void;
  run: (command: Command) => Promise<void>;
  initialSelection?: LedSelection;
}) {
  const [tripId, setTrip] = useState(initialSelection?.tripId ?? ''),
    [planId, setPlanId] = useState<string>(uid),
    [name, setName] = useState('LED-seinä');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [preview, setPreview] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState(0);
  const [previewVersion, setPreviewVersion] = useState({ trip: 0, plan: 0 });
  const trip = state.trips[tripId],
    existing = trip?.ledPlans?.[planId];
  const openProject = (id: string, target = tripId) => {
    const project = state.trips[target]?.ledPlans?.[id];
    if (!project) return;
    setTrip(target);
    setPlanId(id);
    setLoadedVersion(project.version);
    setName(project.name);
    setPreview(false);
    setMessage('Tallennettu suunnitelma avattu.');
    load(structuredClone(project));
  };
  useEffect(() => {
    if (initialSelection) openProject(initialSelection.planId, initialSelection.tripId);
  }, [initialSelection?.tripId, initialSelection?.planId]);
  const draft = { id: planId, name, configuration, curve };
  let dirty = true,
    validation = '',
    changes: ReturnType<typeof projectChanges> = [],
    materialError = '';
  try {
    const parsed = parseLedProject(draft);
    dirty = !existing || JSON.stringify(parsed) !== JSON.stringify(parseLedProject(existing));
    if (trip && existing) {
      try {
        changes = projectChanges(trip, existing, state.products);
      } catch (e) {
        materialError = (e as Error).message;
      }
    }
  } catch (e) {
    validation = (e as Error).message;
  }
  const allowed = trip && !['closed', 'cancelled'].includes(trip.status);
  const canApply =
    allowed &&
    trip.status !== 'returning' &&
    (trip.status !== 'out' || !!bundleForTrip(state, trip.id));
  const changed = changes.some((c) => c.before !== c.after);
  const perform = async (command: Command, text: string) => {
    setBusy(true);
    setMessage('');
    try {
      await run(command);
      setPreview(false);
      setMessage(text);
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="led-project-controls">
      <h2>Suunnitelma keikalle</h2>
      <p className="hint">
        Suunnitelman tallennus säilyttää muodon ja asetukset. Kalustolista päivitetään erillisellä
        painikkeella.
      </p>
      <Field label="Keikka">
        <select
          value={tripId}
          onChange={(e) => {
            setTrip(e.target.value);
            setPlanId(uid());
            setLoadedVersion(0);
            setPreview(false);
            setMessage('');
          }}
        >
          <option value="">Valitse keikka</option>
          {Object.values(state.trips)
            .filter((t) => !['closed', 'cancelled'].includes(t.status))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </Field>
      {!!Object.keys(trip?.ledPlans ?? {}).length && (
        <Field label="Avaa keikan LED-suunnitelma">
          <select value={existing ? planId : ''} onChange={(e) => openProject(e.target.value)}>
            <option value="">Uusi suunnitelma</option>
            {Object.values(trip.ledPlans!).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · versio {p.version}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Suunnitelman nimi">
        <input maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="actions no-print">
        <button
          disabled={busy || !allowed || !!validation || !dirty}
          onClick={() =>
            trip &&
            void perform(
              {
                type: 'ledPlanSave',
                tripId,
                plan: parseLedProject(draft),
                planVersion: loadedVersion,
                expected: trip.version,
              },
              'Suunnitelma tallennettu. Keikan kalustomäärät säilyivät ennallaan.',
            ).then((saved) => {
              if (saved) setLoadedVersion(loadedVersion + 1);
            })
          }
        >
          Tallenna suunnitelma keikalle
        </button>
        <button
          className="secondary"
          disabled={
            busy ||
            !existing ||
            dirty ||
            !!materialError ||
            !canApply ||
            (!changed && existing.appliedVersion === existing.version)
          }
          onClick={() => {
            if (trip && existing) {
              setPreviewVersion({ trip: trip.version, plan: existing.version });
              setPreview(true);
            }
          }}
        >
          Päivitä keikan kalustolista
        </button>
        {existing && (
          <button
            className="secondary small"
            disabled={busy}
            onClick={() => {
              setPlanId(uid());
              setLoadedVersion(0);
              setName(name + ' – kopio');
              setPreview(false);
            }}
          >
            Uusi tästä pohjasta
          </button>
        )}
      </div>
      {existing && (
        <p className="hint">
          Tallennettu versio {existing.version} · kalustoon viety{' '}
          {existing.appliedVersion ? `versio ${existing.appliedVersion}` : 'ei vielä'}.{' '}
          {dirty ? 'Tallenna muutokset ennen kalustopäivitystä.' : ''}
        </p>
      )}
      {validation && <p className="hint">{validation}</p>}
      {existing && loadedVersion !== existing.version && (
        <p className="notice">
          Suunnitelmasta on uudempi tallennettu versio. Avaa se ennen jatkamista.{' '}
          <button className="secondary small" disabled={busy} onClick={() => openProject(planId)}>
            Avaa uusin tallennettu versio
          </button>
        </p>
      )}
      {existing && materialError && (
        <p className="notice">
          Kalustopäivitys odottaa: {materialError} Asetukset voi silti tallentaa.
        </p>
      )}
      {preview && trip && existing && !dirty && (
        <div className="led-update-preview">
          <h3>Kalustolistan muutokset</h3>
          <p>
            Vain suunnitelman ”{existing.name}” rivit päivitetään. Muut kalustorivit ja
            pakkaustiedot säilyvät.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tuote</th>
                  <th>Ennen</th>
                  <th>Jälkeen</th>
                  <th>Keikalla yhteensä</th>
                  <th>Vapaana ajalle</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.productId}>
                    <td>{c.name}</td>
                    <td>{c.before}</td>
                    <td>{c.after}</td>
                    <td>
                      {trip.items
                        .filter(
                          (i) =>
                            i.type === 'inventory' &&
                            i.productId === c.productId &&
                            i.ledPlanId !== planId,
                        )
                        .reduce((s, i) => s + i.quantity, 0) + c.after}
                    </td>
                    <td>
                      {availability(state, c.productId, trip.start, trip.end, trip.id).available}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            Saatavuus tarkistetaan uudelleen tallennuksessa. Pakattua määrää ei pienennetä; nipussa
            ylimääräinen kalusto jää pakatuksi.
          </p>
          <div className="actions">
            <button
              disabled={
                busy ||
                previewVersion.trip !== trip.version ||
                previewVersion.plan !== existing.version
              }
              onClick={() =>
                void perform(
                  {
                    type: 'ledPlanApply',
                    tripId,
                    planId,
                    planVersion: previewVersion.plan,
                    expected: previewVersion.trip,
                  },
                  'Suunnitelman kalustolista päivitetty.',
                )
              }
            >
              Vahvista kalustolistan päivitys
            </button>
            <button className="secondary" onClick={() => setPreview(false)}>
              Peruuta
            </button>
          </div>
          {(previewVersion.trip !== trip.version || previewVersion.plan !== existing.version) && (
            <p className="notice">
              Keikka muuttui esikatselun jälkeen. Avaa muutosesikatselu uudelleen ennen vahvistusta.
            </p>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
