import type { Trip } from '../domain/model';
import { KaariPreview } from './KaariPreview';
import type { LedSelection } from './LedProjectControls';
export function TripLedPlans({
  trip,
  open,
}: {
  trip: Trip;
  open: (selection: LedSelection) => void;
}) {
  const plans = Object.values(trip.ledPlans ?? {});
  if (!plans.length) return null;
  return (
    <section className="panel trip-led-plans">
      <h2>LED-suunnitelmat</h2>
      {plans.map((p) => (
        <article key={p.id}>
          <div className="actions">
            <h3>{p.name}</h3>
            <span>Versio {p.version}</span>
            <button
              className="secondary small no-print"
              onClick={() => open({ tripId: trip.id, planId: p.id })}
            >
              Avaa LED-suunnittelussa
            </button>
          </div>
          <p>
            {p.curve
              ? `${p.curve.angles.length} palaa rivissä`
              : `Leveys ${p.configuration.width} mm`}{' '}
            · tavoitekorkeus {p.configuration.height} mm
          </p>
          <p className="hint">
            {p.appliedVersion === p.version
              ? 'Tallennettu versio on viety kalustolistaan.'
              : p.appliedVersion
                ? `Kalustolistassa versio ${p.appliedVersion}; suunnitelman uudempi versio odottaa erillistä päivitystä.`
                : 'Suunnitelma tallennettu; kalustolistaa ei ole vielä päivitetty.'}
          </p>
          {p.curve && <KaariPreview document={p.curve} details />}
        </article>
      ))}
    </section>
  );
}
