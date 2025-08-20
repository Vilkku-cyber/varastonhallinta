// src/helpers/PrintPackingList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { database, ref, get } from "../firebaseConfig";

export default function PrintPackingList() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [inventory, setInventory] = useState({});
  const [ready, setReady] = useState(false);

  // Lataa keikka + inventory
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [tripSnap, invSnap] = await Promise.all([
          get(ref(database, `keikat/${tripId}`)),
          get(ref(database, "inventory")),
        ]);
        if (!mounted) return;
        setTrip(tripSnap.exists() ? tripSnap.val() : null);
        setInventory(invSnap.exists() ? invSnap.val() : {});
      } catch (e) {
        console.error(e);
      } finally {
        setTimeout(() => mounted && setReady(true), 120);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [tripId]);

  // Printtaa automaattisesti kun data valmis
  useEffect(() => {
    if (ready && trip) window.print();
  }, [ready, trip]);

  const now = new Date();
  const formatDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString("fi-FI") : "—";

  const docId = useMemo(() => {
    const d = new Date();
    return `PKL-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}-${String(tripId).slice(-6)}`;
  }, [tripId]);

  if (!trip) {
    return (
      <div style={{ padding: 24 }}>
        <p>Ladataan pakkauslistaa…</p>
        <button className="no-print" onClick={() => navigate("/pakkaus")}>
          Palaa
        </button>
      </div>
    );
  }

  // Rivit tulostusta varten
  const packedRows = Object.entries(trip.packedItems || {})
    .filter(([, p]) => Number(p.quantity) > 0)
    .map(([pid, p]) => {
      const name =
        (pid && inventory[pid]?.name) || p.name || "Tuntematon tuote";
      const serials = p.isSerial && p.serials ? Object.keys(p.serials) : [];
      return { id: pid, qty: p.quantity, name, serials };
    });

  return (
    <div className="print-page">
      <style>{`
        @page { size: A4; margin: 14mm; }
        html, body { background: #fff !important; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

        /* Kaikki tekstit mustiksi vain tällä sivulla */
        .print-page, .print-page * { color: #000 !important; box-sizing: border-box; }

        /* Paperi + vesileima */
        .print-page {
          position: relative;
          min-height: 100vh;
          background-color: #fff;
          padding: 10mm 0;
        }
        .print-page::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: url("/arsenaalivesileima.png") no-repeat center 60%;
          background-size: 72%;
          opacity: 0.12;      /* vain vesileima on haalea */
          pointer-events: none;
          z-index: 0;
        }
        /* kaikki sisältö vesileiman yläpuolelle */
        .print-page > * { position: relative; z-index: 1; }

        .sheet { width: 180mm; margin: 0 auto; }

        .row-top {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          margin-bottom: 6px;
        }

        .title {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: .6px;
          margin: 0 0 2mm 0;
        }
        .sub { font-size: 11px; margin: 0 0 3mm 0; }

        /* Kehykset ja laatikot valkoisina vesileiman päällä */
        .box, .tbl, .section-head, .footer-notes, .signatures, .header-meta {
          background: rgba(255,255,255,0.98);
        }

        .header-meta {
          display: grid;
          grid-template-columns: 1.2fr 0.9fr 0.9fr 0.9fr;
          border: 2px solid #000;
          margin-bottom: 6mm;
        }
        .header-meta > div {
          border-left: 2px solid #000;
          padding: 6px 8px;
          min-height: 26px;
          font-size: 12px;
        }
        .header-meta > div:first-child { border-left: none; }

        .section-head {
          border: 2px solid #000;
          border-bottom: none;
          font-weight: 800;
          padding: 6px 10px;
        }

        table.tbl {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
        }
        .tbl th, .tbl td {
          border-top: 1px solid #000;
          border-left: 1px solid #000;
          padding: 7px 9px;
          vertical-align: top;
          font-size: 12px;
        }
        .tbl th:first-child, .tbl td:first-child { border-left: none; }
        .tbl thead th {
          background: #ececec;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .4px;
        }
        .qty { width: 80px; text-align: center; }

        .serials { font-size: 10px; opacity: .9; }

        .footer-notes {
          border: 2px solid #000;
          border-top: none;
          min-height: 22mm;
          padding: 6px 8px;
          margin-top: 1mm;
          font-size: 12px;
        }

        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18mm;
          margin-top: 14mm;
          align-items: end;
        }
        .sig {
          text-align: center;
          padding-top: 12mm;
          position: relative;
        }
        .sig::before {
          content: "";
          position: absolute;
          left: 0; right: 0; top: 0;
          border-top: 2px solid #000;
          height: 0;
        }
        .sig label { font-size: 12px; }

        footer.footer {
          font-size: 10px;
          display: flex;
          justify-content: space-between;
          margin-top: 6mm;
        }

        .no-print { margin-top: 8px; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div className="sheet">
        

        <h1 className="title">LÄHETYSLISTA</h1>
        <div className="sub">AV ARSENAALI – Rahtikirjaliite</div>
        {/* Lähettäjä heti otsikon jälkeen */}
        <div style={{ fontSize: "13px", marginBottom: "6mm" }}>
          <strong>Lähettäjä:</strong> Suomen AV-palvelu
        </div>

        {/* Metatiedot laatikossa */}
        <div className="header-meta">
          <div>
            <strong>Asiakas / Keikka</strong><br />
            {trip.name || "—"}
          </div>
          <div>
            <strong>Yhteyshenkilö</strong><br />
            {trip.contact || "—"}
          </div>
          <div>
            <strong>Lähettäjä</strong><br />
            Suomen AV-palvelu
          </div>
          
          
        </div>

        {/* PAKATUT TUOTTEET */}
        <div className="section-head">PAKATUT TUOTTEET</div>
        <table className="tbl">
          <thead>
            <tr>
              <th className="qty">MÄÄRÄ</th>
              <th>TUOTE</th>
            </tr>
          </thead>
          <tbody>
            {packedRows.length === 0 ? (
              <tr>
                <td className="qty">0</td>
                <td>Ei pakattuja tuotteita</td>
              </tr>
            ) : (
              packedRows.map((r) => (
                <tr key={r.id}>
                  <td className="qty">{r.qty}</td>
                  <td>
                    <div>{r.name}</div>
                    {r.serials.length > 0 && (
                      <div className="serials">
                        Sarjanumerot: {r.serials.join(", ")}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Huomiot */}
        <div className="footer-notes">
          <strong>Huomiot:</strong>
          {/* jätetään tilaa käsinkirjoitukselle */}
        </div>

        {/* Allekirjoitukset */}
        <div className="signatures">
          <div className="sig">
            <label>PAKKAAJA</label>
          </div>
          
        </div>

        

        {/* Ei tulostu: pikatoiminnot */}
        <div className="no-print">
          <button onClick={() => window.print()}>Tulosta uudelleen</button>
          <button style={{ marginLeft: 8 }} onClick={() => navigate(-1)}>
            Palaa
          </button>
        </div>
      </div>
    </div>
  );
}
