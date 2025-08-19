import React, { useEffect, useMemo, useState } from "react";
import { database, ref, onValue } from "./firebaseConfig";
import { useNavigate } from "react-router-dom";
import styles from "./Calendar.module.css";

/* --- Helpers --- */
function startOfMonth(d) {
  const dt = new Date(d.getFullYear(), d.getMonth(), 1);
  const day = (dt.getDay() + 6) % 7; // maanantai=0
  dt.setDate(dt.getDate() - day);
  return dt;
}
function addDays(d, n) { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd; }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
/* Päivä klo 00:00 (ilman kellonaikaa) */
function dayOnly(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

/* ✅ Päivä-tason sisältyvyys (toimii myös 00:00–00:00 -keikoille) */
function overlaps(dayDate, startISO, endISO) {
  if (!startISO || !endISO) return false;
  const s = new Date(startISO);
  const e = new Date(endISO);
  const d = dayOnly(dayDate);
  const s0 = dayOnly(s);
  const e0 = dayOnly(e);
  return s0.getTime() <= d.getTime() && d.getTime() <= e0.getTime();
}

export default function Calendar() {
  const today = dayOnly(new Date());

  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [trips, setTrips] = useState([]);
  const [selectedDay, setSelectedDay] = useState(() => today);   // ✅ valitse tänään oletuksena
  const navigate = useNavigate();

  /* ✅ Lataa aktiiviset + arkistoidut */
  useEffect(() => {
    const activeRef = ref(database, "keikat");
    const archivedRef = ref(database, "archived-trips");

    const offA = onValue(activeRef, (snap) => {
      const data = snap.val() || {};
      const active = Object.entries(data).map(([id, v]) => ({
        id,
        name: v.name || "(nimetön keikka)",
        startDate: v.startDate || null,
        endDate: v.endDate || null,
        status: v.status || "pakkaamatta",
        contact: v.contact || "",
        archived: false,
        returned: !!v.returned,
      }));
      setTrips(prev => [...active, ...prev.filter(t => t.archived)]);
    });

    const offB = onValue(archivedRef, (snap) => {
      const data = snap.val() || {};
      const archived = Object.entries(data).map(([id, v]) => ({
        id,
        name: v.name || "(nimetön keikka)",
        startDate: v.startDate || null,
        endDate: v.endDate || null,
        status: v.status || "pakkaamatta",
        contact: v.contact || "",
        archived: true,
        returned: v.returned === true,
      }));
      setTrips(prev => [...prev.filter(t => !t.archived), ...archived]);
    });

    return () => { offA(); offB(); };
  }, []);

  /* 6 viikkoa → ei scrollia */
  const first = useMemo(() => startOfMonth(month), [month]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(first, i)), [first]);
  const monthLabel = useMemo(
    () => month.toLocaleDateString("fi-FI", { year: "numeric", month: "long" }),
    [month]
  );

  /* Päivän keikat */
  const tripsByDay = useMemo(() => {
    const map = new Map();
    days.forEach((d) => map.set(d.toDateString(), []));
    for (const t of trips) {
      for (const d of days) {
        if (overlaps(d, t.startDate, t.endDate)) {
          map.get(d.toDateString()).push(t);
        }
      }
    }
    return map;
  }, [days, trips]);

  const selectedList = selectedDay ? (tripsByDay.get(selectedDay.toDateString()) || []) : [];

  const goPrev = () => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const goNext = () => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));

  /* ✅ "Tänään" vie kuluvan kuukauden alkuun ja valitsee tämän päivän */
  const goToday = () => {
    const t = dayOnly(new Date());
    setMonth(new Date(t.getFullYear(), t.getMonth(), 1));
    setSelectedDay(t);
  };

  const isOtherMonth = (d) => d.getMonth() !== month.getMonth();
  const now = new Date();

  return (
    <div className={styles.calendarPage}>
      {/* Vasen: kalenteri */}
      <div className={styles.left}>
        <div className={styles.topbar}>
          <button className={styles.btn} onClick={() => navigate("/")}>← Etusivu</button>
          <button className={styles.btn} onClick={goPrev}>◀</button>
          <div className={styles.title}>{monthLabel}</div>
          <button className={styles.btn} onClick={goNext}>▶</button>
          <button className={styles.btn} onClick={goToday}>Tänään</button> {/* ✅ */}
        </div>

        <div className={styles.weekdayRow}>
          {["Ma", "Ti", "Ke", "To", "Pe", "La", "Su"].map((d) => <div key={d}>{d}</div>)}
        </div>

        <div className={styles.grid}>
          {days.map((d) => {
            const list = tripsByDay.get(d.toDateString()) || [];
            const todayFlag = isSameDay(d, now);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDay(d)}
                className={[
                  styles.day,
                  todayFlag ? styles.dayToday : "",
                  isOtherMonth(d) ? styles.dayOtherMonth : "",
                ].join(" ")}
                title={list.length ? `${list.length} keikka(a)` : "Ei keikkoja"}
              >
                <div className={styles.dateNum}>{d.getDate()}</div>
                <div className={styles.tags}>
                  {list.slice(0, 3).map((t) => {
                    const isArchived = t.archived || t.returned;
                    const tagClass = isArchived ? styles.archived : (styles[t.status] || "");
                    return (
                      <span key={t.id} className={`${styles.tag} ${tagClass}`}>
                        {t.name}
                      </span>
                    );
                  })}
                  {list.length > 3 && (
                    <span className={styles.tagMore}>+{list.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selite */}
        <div className={styles.legend}>
          {["pakkaamatta","pakattu","keikalla","purkamatta"].map((k) => (
            <div key={k} className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles[k]}`} />
              <span style={{ fontSize: 12 }}>{k}</span>
            </div>
          ))}
          <div className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.archived}`} />
            <span style={{ fontSize: 12 }}>arkistoitu / palautettu</span>
          </div>
        </div>
      </div>

      {/* Oikea: valitun päivän lista (desktop) */}
      <div className={styles.side}>
        <div className={styles.sideTitle}>
          {selectedDay ? `Valittu päivä: ${selectedDay.toLocaleDateString("fi-FI")}` : "Valitse päivä"}
        </div>

        {!selectedDay ? (
          <div style={{ opacity: .8 }}>Klikkaa kalenterista päivää nähdäksesi keikat.</div>
        ) : selectedList.length === 0 ? (
          <div style={{ opacity: .8 }}>Ei keikkoja tälle päivälle.</div>
        ) : (
          selectedList
            .slice()
            .sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0))
            .map((t) => {
              const isArchived = t.archived || t.returned;
              const borderClass = isArchived ? styles.cardArchived : (styles[`card_${t.status}`] || "");
              return (
                <div key={t.id} className={`${styles.card} ${borderClass}`}>
                  <div className={styles.cardTitle}>
                    {t.name} {isArchived && <span className={styles.badge}>Arkistoitu</span>}
                  </div>
                  <div className={styles.cardRow}>
                    <span>Ajat:</span>
                    <strong>
                      {t.startDate ? new Date(t.startDate).toLocaleString("fi-FI") : "–"}
                      {" — "}
                      {t.endDate ? new Date(t.endDate).toLocaleString("fi-FI") : "–"}
                    </strong>
                  </div>
                  {t.contact && (
                    <div className={styles.cardRow}>
                      <span>Yhteyshenkilö:</span><strong>{t.contact}</strong>
                    </div>
                  )}
                  <div className={styles.cardRow}>
                    <span>Status:</span>
                    <strong>{isArchived ? "arkistoitu" : (t.status || "–")}</strong>
                  </div>
                </div>
              );
            })
        )}
      </div>

      {/* Mobiili: overlay (CSS rajoittaa mobiiliin) */}
      <div className={`${styles.sideOverlay} ${selectedDay ? styles.sideOpen : ""}`}>
        {selectedDay && (
          <>
            <button className={styles.sideCloseBtn} onClick={() => setSelectedDay(null)}></button>
            <div className={styles.sideTitle}>
              Valittu päivä: {selectedDay.toLocaleDateString("fi-FI")}
            </div>
            {selectedList.length === 0 && <div>Ei keikkoja tälle päivälle.</div>}
            {selectedList.map((t) => {
              const isArchived = t.archived || t.returned;
              const borderClass = isArchived ? styles.cardArchived : (styles[`card_${t.status}`] || "");
              return (
                <div key={t.id} className={`${styles.card} ${borderClass}`}>
                  <div className={styles.cardTitle}>
                    {t.name} {isArchived && <span className={styles.badge}>Arkistoitu</span>}
                  </div>
                  <div className={styles.cardRow}>
                    <span>Ajat:</span>
                    <strong>
                      {t.startDate ? new Date(t.startDate).toLocaleString("fi-FI") : "–"}
                      {" — "}
                      {t.endDate ? new Date(t.endDate).toLocaleString("fi-FI") : "–"}
                    </strong>
                  </div>
                  {t.contact && (
                    <div className={styles.cardRow}>
                      <span>Yhteyshenkilö:</span><strong>{t.contact}</strong>
                    </div>
                  )}
                  <div className={styles.cardRow}>
                    <span>Status:</span>
                    <strong>{isArchived ? "arkistoitu" : (t.status || "–")}</strong>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
