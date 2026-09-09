import { useState } from 'react';
import type { State } from '../domain/model';
import { today, validDay, formatDay } from '../domain/calendar';
import { monthDays, monthTitle, shiftMonth, weekdays } from '../domain/month';
import { Dialog as Modal } from './shared';
import './month.css';
export function CalendarView({ state, select }: { state: State; select: (id: string) => void }) {
  const [month, setMonth] = useState(today()),
    [selected, setSelected] = useState('');
  const trip = state.trips[selected];
  const trips = Object.values(state.trips)
    .filter((t) => t.status !== 'cancelled' && validDay(t.start) && validDay(t.end))
    .sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  return (
    <>
      <div className="page-heading">
        <h1>Keikkakalenteri</h1>
        <div className="actions">
          <button
            className="secondary"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Edellinen kuukausi"
          >
            ←
          </button>
          <h2>{monthTitle(month)}</h2>
          <button
            className="secondary"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Seuraava kuukausi"
          >
            →
          </button>
          <button className="secondary" onClick={() => setMonth(today())}>
            Tämä kuukausi
          </button>
        </div>
      </div>
      <section className="panel month-scroll">
        <div className="month-grid">
          {weekdays.map((d) => (
            <strong className="weekday" key={d}>
              {d}
            </strong>
          ))}
          {monthDays(month).map((d) => (
            <div
              key={d}
              className={`month-day ${d.slice(0, 7) !== month.slice(0, 7) ? 'outside' : ''} ${d === today() ? 'today' : ''}`}
            >
              <time dateTime={d}>{Number(d.slice(-2))}</time>
              {trips
                .filter((t) => t.start <= d && t.end >= d)
                .map((t) => (
                  <button key={t.id} className="month-trip" onClick={() => setSelected(t.id)}>
                    {t.name}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </section>
      {trip && (
        <Modal title={trip.name} close={() => setSelected('')}>
          <p>
            {formatDay(trip.start)} – {formatDay(trip.end)}
          </p>
          <ul>
            {trip.items.map((i) => (
              <li key={i.id}>
                <strong>{i.quantity} ×</strong> {i.name}
              </li>
            ))}
          </ul>
          {!trip.items.length && <p>Keikalle ei ole vielä merkitty kalustoa.</p>}
          <button
            onClick={() => {
              select(trip.id);
              setSelected('');
            }}
          >
            Avaa keikka
          </button>
        </Modal>
      )}
    </>
  );
}
