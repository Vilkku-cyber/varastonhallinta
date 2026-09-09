import { useRef, useState, useEffect, type InputHTMLAttributes, type ChangeEvent } from 'react';
import { today, validDay } from '../domain/calendar';
import { monthDays, monthTitle, shiftMonth, weekdays } from '../domain/month';
import './month.css';
export function DatePicker(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const value = String(props.value ?? ''),
    [month, setMonth] = useState(validDay(value) ? value : today());
  const details = useRef<HTMLDetailsElement>(null),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.setCustomValidity(
      value &&
        (!validDay(value) ||
          (props.min && value < String(props.min)) ||
          (props.max && value > String(props.max)))
        ? 'Anna kelvollinen päivämäärä muodossa VVVV-KK-PP.'
        : '',
    );
  }, [value, props.min, props.max]);
  return (
    <span className="date-picker">
      <input
        {...props}
        ref={input}
        type="text"
        placeholder="VVVV-KK-PP"
        pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
      />
      <details
        ref={details}
        onToggle={() => {
          if (details.current?.open) setMonth(validDay(value) ? value : today());
        }}
      >
        <summary aria-label="Avaa päivämääräkalenteri">▦</summary>
        <span className="date-popover">
          <span className="month-nav">
            <button
              type="button"
              aria-label="Edellinen kuukausi"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              ‹
            </button>
            <strong>{monthTitle(month)}</strong>
            <button
              type="button"
              aria-label="Seuraava kuukausi"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              ›
            </button>
          </span>
          <span className="date-grid">
            {weekdays.map((d) => (
              <b key={d}>{d}</b>
            ))}
            {monthDays(month).map((d) => (
              <button
                type="button"
                key={d}
                className={d.slice(0, 7) !== month.slice(0, 7) ? 'outside' : ''}
                aria-label={d}
                aria-pressed={d === value}
                disabled={
                  !!((props.min && d < String(props.min)) || (props.max && d > String(props.max)))
                }
                onClick={() => {
                  props.onChange?.({ target: { value: d } } as ChangeEvent<HTMLInputElement>);
                  details.current!.open = false;
                  input.current?.focus();
                }}
              >
                {Number(d.slice(-2))}
              </button>
            ))}
          </span>
        </span>
      </details>
    </span>
  );
}
