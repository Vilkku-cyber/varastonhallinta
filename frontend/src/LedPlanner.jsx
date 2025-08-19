// src/LedPlanner.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue, get, update } from "./firebaseConfig";
import CreateTripModal from "./CreateTripModal";
import "./Pakkaus.css"; // sisältää topbar/container peruslayoutin

/*
  LED Planner – 5 vaihetta
  1) Paneeli (valitaan inventoriosta LED-kategoriasta + pintaled special)
  2) Koko metreinä (L x K) -> lasketaan palojen määrä paneelin fyysisen koon perusteella
  3) Asennustapa (jaloilla / ripustus / seinä / tassut)
     - Jaloilla: tolpat joka TOISEN palan kohdalle leveys-suunnassa.
       Yhdessä “positiossa” 2 tolppaa + 1 plate. Positioiden määrä = ceil(palojen_lkm_leveydessä / 2).
       Kokonaismäärä (oletus): tolpat = pos * 2, platet = pos.
     - Tolppien pituussuositus aiemman logiikan mukaan (lähtökorkeus + ledin korkeus)
     - Tassut: lisätään yhteenvetoon varastotuote "kiilat/lisut/pumput/tassut" 
  4) Prosessori + kaapelit
     - Välikaapelit (DATA ja VIRTA) = totalPanels + 5, pyöristys ylöspäin seuraavaan kymmeneen.
     - Virtasyötöt: vähintään 1 per rivi; jos rivi > 20 palaa leveä, 2 per rivi.
  5) Yhteenveto + “Luo uusi keikka” (avaa CreateTripModal ja palaa Homeen tallennuksen jälkeen)
*/

const TASSU_ID = "-OPjmirEW4lMeqVC7zqW";
const SHORT_POLE_ID = "-OKfTdGlfsaN-R3xt9FJ"; // LED tolppa lyhyt
const LONG_POLE_ID = "-OKfT8_SHYGM9P0KUCyg";  // LED tolppa pitkä
const PLATE_OLD_ID = "-OKeRqQ2m35kxM4ez6XF"; // LED Plate vanha
const PLATE_NEW_ID = "-OKeRz8GnpD7sk5iBTpq"; // LED Plate uusi (käytetään oletuksena)
const DATA_MID_ID = "-OJXJ6E56XO1N5XUquNG";  // DATA-väli
const POWER_MID_ID = "-OJXJSDQchN5n01ZW5RL"; // VIRTA-väli
const DATA_FEED_ID = "-OKfXOBW5_CLfuLx0O2-"; // DATA syöttö
const POWER_FEED_ID = "-OKfXHHe0pahKrU5EbpH"; // VIRTA syöttö


function ceilToNext10(n) {
  if (n <= 0) return 0;
  return Math.ceil(n / 10) * 10;
}

function safeNumber(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export default function LedPlanner() {
  const navigate = useNavigate();

  // Vaihe
  const [step, setStep] = useState(1);

  // Firebase inventory
  const [inventory, setInventory] = useState({});

  // Keikat (trips)
  const [trips, setTrips] = useState({});
  const [selectedTripId, setSelectedTripId] = useState("");

  useEffect(() => {
    const invRef = ref(database, "inventory");
    const unsub = onValue(invRef, (snap) => setInventory(snap.val() || {}));
    return () => unsub();
  }, []);

  useEffect(() => {
    const tripsRef = ref(database, "keikat");
    return onValue(tripsRef, (snap) => setTrips(snap.val() || {}));
  }, []);

  // Paneeli (ID inventoriosta) TAI erikoisvaihtoehto “pintaled”
  const [selectedPanelId, setSelectedPanelId] = useState("");
  const [isSurfaceLed, setIsSurfaceLed] = useState(false);

  // Koko metreinä
  const [widthMeters, setWidthMeters] = useState("");
  const [heightMeters, setHeightMeters] = useState("");

  // Asennustapa ja liittyvät
  const [mountType, setMountType] = useState("jaloilla"); // jaloilla | ripustus | seinä | tassut
  const [startHeightM, setStartHeightM] = useState(0);    // lähtökorkeus metreinä

  // Prosessori
  const [selectedProcessorId, setSelectedProcessorId] = useState("");

  // CreateTrip modal
  const [showCreateTrip, setShowCreateTrip] = useState(false);

  // Scroll mahdolliseksi tällä sivulla
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => (document.body.style.overflow = prev);
  }, []);

  // Paneelien mitat metreinä (normi LED-paneeli inventoriosta, esim. “50x50cm”)
  const panelSizeM = useMemo(() => {
    if (isSurfaceLed) {
      // Pintaled lasketaan dynaamisesti muodostus-funktiossa -> käytämme 1m/0.5m paloja,
      // mutta tässä näytämme “per paneeli” arvoksi 0.5m leveys ja 0.25m korkeus oletuksena,
      // jotta laskenta (rows/cols) kiloituu. Varsinainen erittely hoidetaan yhteenvedossa.
      return { w: 0.5, h: 0.25, label: "Pintaled (erikoislogiikka)" };
    }
    const p = inventory[selectedPanelId];
    if (!p) return { w: 0.5, h: 0.5, label: "" };

    // Yritetään lukea esim. "50x50cm" / "1000x250 mm" jne.
    const dim = String(p.dimensions || p.details || "").toLowerCase();
    // Tunnista muodot:
    // 1) "50x50cm"
    let mW = 0.5, mH = 0.5;
    const cmMatch = dim.match(/(\d+)\s*x\s*(\d+)\s*cm/);
    const mmMatch = dim.match(/(\d+)\s*x\s*(\d+)\s*mm/);
    if (cmMatch) {
      mW = Number(cmMatch[1]) / 100;
      mH = Number(cmMatch[2]) / 100;
    } else if (mmMatch) {
      mW = Number(mmMatch[1]) / 1000;
      mH = Number(mmMatch[2]) / 1000;
    } else {
      // fallback: 50x50cm
      mW = 0.5;
      mH = 0.5;
    }
    return { w: mW, h: mH, label: p.name || "" };
  }, [inventory, isSurfaceLed, selectedPanelId]);

  // Leveyden ja korkeuden paneelimäärät (pyöristys ylöspäin)
  const sizeCalc = useMemo(() => {
    const Wm = safeNumber(widthMeters);
    const Hm = safeNumber(heightMeters);
    if (Wm <= 0 || Hm <= 0) return { cols: 0, rows: 0, total: 0 };

    if (isSurfaceLed) {
      // Pintaled: käytetään 1.0m ja 0.5m “palikoita” – mitoitamme päässä.
      // Jotta ruudukko näkyisi järkevästi, voidaan käyttää puolen metrin “perusruutua”.
      const cols = Math.ceil(Wm / 0.5);
      const rows = Math.ceil(Hm / 0.25);
      return { cols, rows, total: cols * rows };
    }

    const cols = Math.ceil(Wm / Math.max(panelSizeM.w, 0.0001));
    const rows = Math.ceil(Hm / Math.max(panelSizeM.h, 0.0001));
    return { cols, rows, total: cols * rows };
  }, [widthMeters, heightMeters, isSurfaceLed, panelSizeM.w, panelSizeM.h]);

  // Pintaled-erittely: käytä ensisijaisesti 1m paloja; jäämä hoidetaan 0.5m paloilla.
  // LEFT/RIGHT jätetään varalle (0 oletuksena).
  const surfaceBreakdown = useMemo(() => {
    if (!isSurfaceLed) return null;

    const Wm = safeNumber(widthMeters);
    const Hm = safeNumber(heightMeters);
    if (Wm <= 0 || Hm <= 0) return null;

    const oneW = 1.0;    // 1000mm leveä
    const halfW = 0.5;   // 500mm leveä
    const segH = 0.25;   // 250mm korkea “moduulirivi”

    const rows = Math.ceil(Hm / segH);

    // Leveyssuunta – max 1m paloja, ja mahdollinen loppu 0.5m
    const oneCountPerRow = Math.floor(Wm / oneW);
    const leftoverW = Wm - oneCountPerRow * oneW;
    const halfCountPerRow = leftoverW > 0 ? Math.ceil(leftoverW / halfW) : 0;

    const total1m = oneCountPerRow * rows;
    const total0_5m = halfCountPerRow * rows;

    return {
      rows,
      perRow: { oneM: oneCountPerRow, halfM: halfCountPerRow },
      totals: { oneM: total1m, halfM: total0_5m, left: 0, right: 0 },
    };
  }, [isSurfaceLed, widthMeters, heightMeters]);

  // Asennus – tolpat ja platet
  const mountingItems = useMemo(() => {
    const cols = sizeCalc.cols;
    const rows = sizeCalc.rows;
    const total = sizeCalc.total;

    // Tolppien pituussuositus: lähtökorkeus + ledin korkeus
    const ledHeightM = rows * (isSurfaceLed ? 0.25 : panelSizeM.h);
    const neededTopM = safeNumber(startHeightM) + ledHeightM;

    // yksinkertainen heuristiikka: jos ≤ ~3.5 m, käytä lyhyt, muuten pitkää
    const useShort = neededTopM <= 3.5;

    // JALOILLA: positioita joka toisen palan kohdalla leveydessä
    let poleQty = 0;
    let plateQty = 0;

    if (mountType === "jaloilla") {
      const positions = Math.ceil(cols / 2); // joka toinen pala leveydessä
      poleQty = positions * 2;               // kussakin positiossa 2 tolppaa
      plateQty = positions * 1;              // yksi plate / positio
    }

    return {
      neededTopM,
      useShort,
      shortPoles: useShort ? poleQty : 0,
      longPoles: useShort ? 0 : poleQty,
      plates: plateQty,
      // tassut lisätään yhteenvedossa mountType-tarkistuksella
      summaryOnlyTassu: mountType === "tassut",
      cols,
      rows,
      total,
    };
  }, [sizeCalc, mountType, startHeightM, isSurfaceLed, panelSizeM.h]);

  // Kaapelit – vaihe 4
  const cableCalc = useMemo(() => {
    const total = sizeCalc.total;
    const cols = sizeCalc.cols;
    const rows = sizeCalc.rows;

    const midBase = total + 5;
    const midRounded = ceilToNext10(midBase);

    // syöttö per rivi – jos rivi > 20 palaa leveä, 2 / rivi, muuten 1 / rivi
    const feedsPerRow = cols > 20 ? 2 : 1;
    const powerFeeds = rows * feedsPerRow;

    return {
      dataMidQty: midRounded,
      powerMidQty: midRounded, // sama kaava molemmille
      dataFeedQty: rows,       // oletus: 1 data feed / rivi
      powerFeedQty: powerFeeds,
    };
  }, [sizeCalc]);

  // LED prosessorit inventoriosta (category: "LED prosessori")
  const processors = useMemo(() => {
    const list = Object.entries(inventory)
      .filter(([_, v]) => String(v.category || "").toLowerCase() === "led prosessori")
      .map(([id, v]) => ({ id, name: v.name || id }));
    return list;
  }, [inventory]);

  // LED paneelit inventoriosta (category: "LED")
  const ledPanels = useMemo(() => {
    const list = Object.entries(inventory)
      .filter(([_, v]) => String(v.category || "").toLowerCase() === "led")
      .filter(([id, v]) => {
        const n = String(v.name || "").toLowerCase();
        // Poissulje pintaledin osat: 1000x250, 500x250, left/right jne.
        return !/(1000x250|500x250|left|right|pinta)/.test(n);
      })
      .map(([id, v]) => ({ id, name: v.name || id, dimensions: v.dimensions || "" }));
    return list;
  }, [inventory]);

  // --- Yhteenveto – kerätään valitut / lasketut nimikkeet ---
  const summaryItems = useMemo(() => {
    const items = [];

    // 1) LED-paneelit
    if (isSurfaceLed && surfaceBreakdown) {
      const oneM = surfaceBreakdown.totals.oneM;
      const halfM = surfaceBreakdown.totals.halfM;
      if (oneM > 0) items.push({ id: null, name: "Pintaled 1000x250", qty: oneM });
      if (halfM > 0) items.push({ id: null, name: "Pintaled 500x250", qty: halfM });
    } else {
      const chosen = inventory[selectedPanelId];
      if (chosen) {
        items.push({ id: selectedPanelId, name: chosen.name || "LED-paneeli", qty: sizeCalc.total });
      }
    }

    // 2) Asennustarvikkeet – jaloilla
    if (mountType === "jaloilla") {
      if (mountingItems.shortPoles > 0) {
        const item = inventory[SHORT_POLE_ID];
        items.push({
          id: SHORT_POLE_ID,
          name: item?.name || "LED tolppa lyhyt",
          qty: mountingItems.shortPoles,
        });
      }
      if (mountingItems.longPoles > 0) {
        const item = inventory[LONG_POLE_ID];
        items.push({
          id: LONG_POLE_ID,
          name: item?.name || "LED tolppa pitkä",
          qty: mountingItems.longPoles,
        });
      }
      if (mountingItems.plates > 0) {
        const plate = inventory[PLATE_NEW_ID] || inventory[PLATE_OLD_ID];
        items.push({
          id: plate ? (inventory[PLATE_NEW_ID] ? PLATE_NEW_ID : PLATE_OLD_ID) : null,
          name: plate?.name || "LED Plate",
          qty: mountingItems.plates,
        });
      }
    }

    // 3) Tassut – vain yhteenvetoon
    if (mountingItems.summaryOnlyTassu && TASSU_ID !== "FILL_ME_WITH_REAL_ID") {
      const tassu = inventory[TASSU_ID];
      items.push({
        id: TASSU_ID,
        name: tassu?.name || "Kiilat/Lisut/Pumput/Tassut",
        qty: 1,
      });
    } else if (mountingItems.summaryOnlyTassu) {
      items.push({
        id: null,
        name: "Kiilat/Lisut/Pumput/Tassut (täydennä ID)",
        qty: 1,
      });
    }

    // 4) Prosessori
    if (selectedProcessorId) {
      const proc = inventory[selectedProcessorId];
      items.push({
        id: selectedProcessorId,
        name: proc?.name || "LED prosessori",
        qty: 1,
      });
    }

    // 5) Kaapelit
    const dataMid = inventory[DATA_MID_ID];
    const powerMid = inventory[POWER_MID_ID];
    const dataFeed = inventory[DATA_FEED_ID];
    const powerFeed = inventory[POWER_FEED_ID];

    items.push({
      id: DATA_MID_ID,
      name: dataMid?.name || "DATA-väli",
      qty: cableCalc.dataMidQty,
    });
    items.push({
      id: POWER_MID_ID,
      name: powerMid?.name || "VIRTA-väli",
      qty: cableCalc.powerMidQty,
    });
    items.push({
      id: DATA_FEED_ID,
      name: dataFeed?.name || "DATA syöttö",
      qty: cableCalc.dataFeedQty,
    });
    items.push({
      id: POWER_FEED_ID,
      name: powerFeed?.name || "VIRTA syöttö",
      qty: cableCalc.powerFeedQty,
    });

    return items;
  }, [
    inventory,
    selectedPanelId,
    isSurfaceLed,
    surfaceBreakdown,
    sizeCalc.total,
    mountingItems,
    selectedProcessorId,
    cableCalc,
  ]);

  // --- Esitäytettävät tuotteet CreateTripModalille ---
  const initialItemsForTrip = useMemo(() => {
    // Vain tuotteet, joilla on id ja määrä > 0
    return summaryItems
      .filter(it => !!it.id && Number(it.qty) > 0)
      .map(it => ({ id: it.id, quantity: it.qty, name: it.name }));
  }, [summaryItems]);

  // tee seed molemmilla muodoilla, jotta CreateTrip:n molemmat variantit ymmärtävät
  const tripSeed = useMemo(() => {
    const items = initialItemsForTrip || [];
    return {
      name: "LED-suunnitelma",
      items, // CreateTrip (versio A) lukee tämän
      suggestedItems: items.map(({ id, quantity, name }) => ({
        productId: id, quantity, name,   // CreateTrip (versio B) lukee tämän
      })),
    };
  }, [initialItemsForTrip]);

  // Render helpers
  const Stepper = () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => setStep(n)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: step === n ? "#222" : "#f3f3f3",
            color: step === n ? "#fff" : "#222",
            cursor: "pointer",
          }}
        >
          {n}.
        </button>
      ))}
    </div>
  );

const Step1 = () => (
  <div>
    <h3>1) Paneeli</h3>

    <div style={{ marginTop: 8 }}>
      <select
        value={isSurfaceLed ? "__SURFACE__" : (selectedPanelId || "")}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__SURFACE__") {
            setIsSurfaceLed(true);
            setSelectedPanelId("");
          } else {
            setIsSurfaceLed(false);
            setSelectedPanelId(v);
          }
        }}
        style={{ width: 360 }}
      >
        <option value="">Valitse LED-paneeli…</option>
        <option value="__SURFACE__">Pintaled (1000x250 / 500x250 – erikoislogiikka)</option>
        {ledPanels.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {p.dimensions ? `— ${p.dimensions}` : ""}
          </option>
        ))}
      </select>

      {!isSurfaceLed && panelSizeM.label && (
        <p style={{ marginTop: 6, color: "#555" }}>
          Mitat: {Math.round(panelSizeM.w * 100)} x {Math.round(panelSizeM.h * 100)} cm
        </p>
      )}
    </div>

    {isSurfaceLed && (
      <div style={{ marginTop: 10, fontSize: 13, color: "#555" }}>
        Pintaled lasketaan ensisijaisesti 1m paloilla, tarvittaessa 0.5m paloilla.
        LEFT/RIGHT varataan kulmiin, ei oletuksena käytössä.
      </div>
    )}
  </div>
);


  const Step2 = () => (
    <div>
      <h3>2) Koko metreinä</h3>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "160px 160px" }}>
        <label>
          Leveys (m)
          <input
            type="number"
            step="0.01"
            min="0"
            value={widthMeters}
            onChange={(e) => setWidthMeters(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Korkeus (m)
          <input
            type="number"
            step="0.01"
            min="0"
            value={heightMeters}
            onChange={(e) => setHeightMeters(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ marginTop: 10, background: "#eee", padding: 8, borderRadius: 8 }}>
        <div>Leveyden paneelit: <b>{sizeCalc.cols}</b></div>
        <div>Korkeuden paneelit: <b>{sizeCalc.rows}</b></div>
        <div>Yhteensä paneeleita: <b>{sizeCalc.total}</b></div>
      </div>
    </div>
  );

const Step3 = () => {
  const requiresStartHeight = mountType === "jaloilla";

  // Nollaa lähtökorkeus, jos sitä ei tarvita
  useEffect(() => {
    if (!requiresStartHeight) setStartHeightM(0);
  }, [requiresStartHeight]);

  return (
    <div>
      <h3>3) Asennustapa</h3>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {["jaloilla", "ripustus", "seinä", "tassut"].map((t) => (
          <button
            key={t}
            onClick={() => setMountType(t)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: mountType === t ? "#222" : "#f3f3f3",
              color: mountType === t ? "#fff" : "#222",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Lähtökorkeus vain jaloilla-asennuksessa */}
      {requiresStartHeight && (
        <div style={{ marginTop: 8, display: "grid", gap: 8, gridTemplateColumns: "200px" }}>
          <label>
            Lähtökorkeus (m)
            <input
              type="number"
              step="0.01"
              min="0"
              value={Number.isFinite(startHeightM) ? startHeightM : 0}
              onChange={(e) => setStartHeightM(Math.max(0, parseFloat(e.target.value) || 0))}
              style={{ width: "100%" }}
            />
          </label>
        </div>
      )}

      {mountType === "jaloilla" && (
        <div style={{ marginTop: 10, background: "#eef7ff", padding: 10, borderRadius: 8 }}>
          <p style={{ margin: 0 }}>
            Jalka-asennus: tolpat joka <b>toisen palan</b> kohdalle <b>leveyssuunnassa</b>.
            Yhdessä positiossa 2 tolppaa + 1 plate.
          </p>
          <div style={{ marginTop: 8 }}>
            <div>Leveyden paneelit: <b>{mountingItems.cols}</b></div>
            <div>Positioita: <b>{Math.ceil(mountingItems.cols / 2)}</b></div>
            <div>Suositeltu tolppa: <b>{mountingItems.useShort ? "Lyhyt" : "Pitkä"}</b></div>
            <div>Lyhyitä tolppia: <b>{mountingItems.shortPoles}</b></div>
            <div>Pitkiä tolppia: <b>{mountingItems.longPoles}</b></div>
            <div>Plateja: <b>{mountingItems.plates}</b></div>
          </div>
        </div>
      )}

      {mountType === "tassut" && (
        <div style={{ marginTop: 10, background: "#fff8e6", padding: 10, borderRadius: 8 }}>
          <p style={{ margin: 0 }}>
            Tassuasennus: yhteenvetoon lisätään tuote{" "}
            <b>“Kiilat/Lisut/Pumput/Tassut”</b> varastosta
          </p>
        </div>
      )}
    </div>
  );
};

  const Step4 = () => (
    <div>
      <h3>4) Prosessori ja kaapelit</h3>
      <div style={{ marginBottom: 12 }}>
        <label>LED prosessori</label>
        <br />
        <select
          value={selectedProcessorId}
          onChange={(e) => setSelectedProcessorId(e.target.value)}
          style={{ minWidth: 360 }}
        >
          <option value="">Valitse prosessori…</option>
          {processorsWithCapacity.map(p => (
            <option
              key={p.id}
              value={p.id}
              disabled={p.maxPixels != null && requiredPixels > 0 && !p.allowed}
            >
              {p.name}
              {p.maxPixels ? ` — kapasiteetti ${p.maxPixels.toLocaleString()} px` : " — (tuntematon)"}
              {requiredPixels > 0 && p.maxPixels && !p.allowed ? " — ei riitä tälle seinälle" : ""}
            </option>
          ))}
        </select>

        {requiredPixels > 0 && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
            Tarvitaan ~ <b>{requiredPixels.toLocaleString()} px</b>.
            {selectedProcessorId && (() => {
              const sel = processorsWithCapacity.find(x => x.id === selectedProcessorId);
              return sel?.maxPixels
                ? <> Valitun kapasiteetti: <b>{sel.maxPixels.toLocaleString()} px</b>.</>
                : <> Valitun kapasiteetti: <b>tuntematon</b>.</>;
            })()}
          </div>
        )}
      </div>
      <div style={{ background: "#eee", padding: 10, borderRadius: 8 }}>
        <div><b>Välikaapelit</b> (DATA &amp; VIRTA): {sizeCalc.total}+5 → seuraavaan kymmeneen = <b>{cableCalc.dataMidQty}</b> kpl / tyyppi</div>
        <div><b>Syötöt</b>:</div>
        <ul style={{ marginTop: 4 }}>
          <li>DATA syöttö: <b>{cableCalc.dataFeedQty}</b> kpl (oletus 1/rivi)</li>
          <li>VIRTA syöttö: <b>{cableCalc.powerFeedQty}</b> kpl (≥1/rivi; jos rivi &gt; 20 palaa, 2/rivi)</li>
        </ul>
      </div>
    </div>
  );

  const Step5 = () => (
    <div>
      <h3>5) Yhteenveto</h3>
      <div style={{ maxHeight: 320, overflow: "auto", background: "#f7f7f7", padding: 10, borderRadius: 8 }}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {summaryItems.map((it, i) => (
            <li key={i}>
              {it.qty} x {it.name} {it.id ? <small style={{ color: "#666" }}>({it.id})</small> : null}
            </li>
          ))}
        </ul>
      </div>

     <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
  <button
    onClick={() => setShowCreateTrip(true)}
    style={{
      background: "#0a7",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: 8,
      border: "none"
    }}
  >
    Luo uusi keikka
  </button>
  <button
    onClick={() => navigate("/")}
    style={{ padding: "8px 12px", borderRadius: 8 }}
  >
    Palaa kotiin
  </button>
</div>

{/* Lisää olemassa olevalle keikalle */}
<div
  style={{
    marginTop: 12,
    padding: 10,
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 8
  }}
>
  <div style={{ fontWeight: 600, marginBottom: 6 }}>
    Lisää olemassa olevalle keikalle
  </div>

  <div
    style={{
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap"
    }}
  >
    <select
      value={selectedTripId}
      onChange={(e) => setSelectedTripId(e.target.value)}
    >
      <option value="">Valitse keikka…</option>
      {Object.entries(trips).map(([id, t]) => (
        <option key={id} value={id}>
          {t.name || id}
        </option>
      ))}
    </select>

    <button
      disabled={!selectedTripId || summaryItems.length === 0}
      onClick={addCurrentPlanToTrip}   
      style={{ padding: "6px 10px" }}
    >
      Lisää keikalle
    </button>
  </div>

  <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
    Määrät yhdistetään: jos sama ID löytyy, quantity kasvaa; muuten luodaan{" "}
    <code>manual-&lt;nimi&gt;</code>.
  </div>
</div>


      {showCreateTrip && (
        <CreateTripModal
          isOpen={showCreateTrip}
          onRequestClose={() => setShowCreateTrip(false)}
          initialSeed={tripSeed}               // ← OIKEA PROP-NIMI
          onCreated={() => {                   // ← OIKEA CALLBACK-NIMI
            setShowCreateTrip(false);
            navigate("/");
          }}
        />
      )}
    </div>
  );

  // Lisää nykyinen suunnitelma valitulle keikalle
  async function addCurrentPlanToTrip() {
    if (!selectedTripId) {
      alert("Valitse keikka ensin!");
      return;
    }
    // Hae nykyiset tuotteet keikalta
    const snap = await get(ref(database, `keikat/${selectedTripId}/items`));
    const prevItems = snap.val() || {};

    // Luo yhdistetty lista: jos sama id, summataan määrät
    const merged = { ...prevItems };
    initialItemsForTrip.forEach(it => {
      const key = it.id;
      const prev = prevItems[key];
      const nextQty = (prev?.quantity || 0) + (it.quantity || 0);

      merged[key] = {
        id: key,
        name: it.name || prev?.name || "",
        quantity: nextQty,
      };
    });

    await update(ref(database, `keikat/${selectedTripId}`), { items: merged });
    alert("Lisätty keikalle ✔");
  }


  // requiredPixels, parsePanelPixels käytössä vain tässä tiedostossa, joten siirretään parsePanelPixels tähän
  const requiredPixels = useMemo(() => {
    function parsePanelPixels(invItem) {
      const info = String(invItem?.additionalInfo || invItem?.details || "").toUpperCase();
      const mm = info.match(/(\d+)\s*[X×]\s*(\d+)\s*P?X/);
      if (mm) return { w: +mm[1], h: +mm[2] };
      const sq = info.match(/(\d+)\s*P?X/);
      if (sq) return { w: +sq[1], h: +sq[1] };
      return null;
    }
    // Pintaled – käytä 1000x250 palan resoluutiota + surfaceBreakdownia
    if (isSurfaceLed && surfaceBreakdown) {
      const surfItem = inventory["-OKeOUObTlHbliJp2dws"];
      const px = parsePanelPixels(surfItem) || { w: 512, h: 128 };
      const { oneM, halfM } = surfaceBreakdown.totals;
      const totalWpx = oneM * px.w + halfM * Math.round(px.w / 2);
      const rows = surfaceBreakdown.rows;
      const heightPx = rows * px.h;
      const widthPx = Math.ceil(totalWpx / rows);
      return widthPx * heightPx;
    }
    // Tavallinen moduuli
    const p = inventory[selectedPanelId];
    const panelPx = parsePanelPixels(p);
    if (panelPx) {
      return (sizeCalc.cols * panelPx.w) * (sizeCalc.rows * panelPx.h);
    }
    return 0;
  }, [isSurfaceLed, surfaceBreakdown, inventory, selectedPanelId, sizeCalc]);


  // getProcessorCapacity, parseMaxPixelsFromText, parseProcessorCapacityPx käytössä vain tässä tiedostossa, joten siirretään getProcessorCapacity tähän
  const processorsWithCapacity = useMemo(() => {
    function parseProcessorCapacityPx(invItem) {
      const info = String(invItem?.additionalInfo || invItem?.details || "").replace(/,/g, "");
      const m = info.match(/(\d[\d ]+)\s*(pixels|px)/i);
      if (m) return parseInt(m[1].replace(/\s+/g, ""), 10);
      const FALLBACK = {
        "-OKfPeB_3SA9njkYQAQL": 2300000,
        "-OKfQPJVPDNL_sFztyTk":3900000,
        "-ONKAWIH9Hgp0e8YBrfi": 13000000,
        "-OKV7hl6DYaYbIXRTiI8": 9000000,
        "-OMQuhjYu26rElpeI45i": 10400000,
        "-OKVFp8b2pLd32dJfwOd": 10400000,
      };
      return FALLBACK[invItem?.id] || null;
    }
    function parseMaxPixelsFromText(txt = "") {
      const s = String(txt);
      const m1 = s.match(/MaxPixels\s*=\s*([\d\s.,_]+)/i);
      if (m1) return Number(String(m1[1]).replace(/[^\d]/g, ""));
      const m2 = s.match(/(?:max\s*pixels?|pixel\s*capacity)\D*([\d\s.,_]+)/i);
      if (m2) return Number(String(m2[1]).replace(/[^\d]/g, ""));
      const m3 = s.match(/([\d\s.,_]+)\s*(?:px|pixels)/i);
      if (m3) return Number(String(m3[1]).replace(/[^\d]/g, ""));
      return null;
    }
    function getProcessorCapacity(inv, id) {
      const node = inv?.[id];
      if (!node) return null;
      if (typeof node.maxPixels === "number") return node.maxPixels;
      const parsed = parseMaxPixelsFromText(node.details || node.additionalInfo || "");
      if (parsed) return parsed;
      return parseProcessorCapacityPx({ ...node, id });
    }
    // Suodata inventoriosta LED prosessorit (sovita tarvittaessa kategoriaan)
    const procs = Object.entries(inventory)
      .filter(([, v]) => String(v.category || "").toLowerCase().includes("led prosessori"))
      .map(([id, v]) => ({ id, name: v.name || id, details: v.details || v.additionalInfo || "" }));
    return procs.map(p => {
      const cap = getProcessorCapacity(inventory, p.id);
      const allowed = cap == null || requiredPixels === 0 ? true : cap >= requiredPixels;
      return { ...p, maxPixels: cap, allowed };
    });
  }, [inventory, requiredPixels]);

  return (
    <div style={{ height: "100vh", overflow: "auto", background: "#f2f2f2" }}>
  {/* Yläpalkki */}
  <div className="topBar">
    <button 
      onClick={() => navigate("/")}
      style={{
        background: "navy",
        color: "white",
        padding: "6px 12px",
        borderRadius: 6,
        border: "none",
        cursor: "pointer"
      }}
    >
      Koti
    </button>
    <div style={{ fontWeight: 600 }}>LED Planner</div>
  </div>

  <div className="container" style={{ alignItems: "flex-start" }}>
    {/* Vasemmalla sisältö */}
    <div className="leftPanel" style={{ overflow: "auto", maxHeight: "calc(100vh - 80px)" }}>
      <Stepper />

      <div style={{ display: step === 1 ? "block" : "none" }}>
        <Step1 />
      </div>
      <div style={{ display: step === 2 ? "block" : "none" }}>
        <Step2 />
      </div>
      <div style={{ display: step === 3 ? "block" : "none" }}>
        <Step3 />
      </div>
      <div style={{ display: step === 4 ? "block" : "none" }}>
        <Step4 />
      </div>
      <div style={{ display: step === 5 ? "block" : "none" }}>
        <Step5 />
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {step > 1 && (
          <button 
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            style={{
              background: "navy",
              color: "white",
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer"
            }}
          >
            ← Takaisin
          </button>
        )}
        {step < 5 && (
          <button
            onClick={() => setStep((s) => Math.min(5, s + 1))}
            disabled={step === 1 && !(isSurfaceLed || selectedPanelId)}
            style={{
              background: "navy",
              color: "white",
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer"
            }}
          >
            Seuraava →
          </button>
        )}
      </div>
    </div>

        {/* Oikealla pikayhteenveto */}
        <div className="rightPanel" style={{ overflow: "auto", maxHeight: "calc(100vh - 80px)" }}>
          <h3>Nopea yhteenveto</h3>
          <div style={{ background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #e5e5e5" }}>
            <div style={{ marginBottom: 8 }}>
              <div><b>Paneeli:</b> {isSurfaceLed ? "Pintaled (1m/0.5m)" : (panelSizeM.label || "-")}</div>
              <div><b>Koko (m):</b> {widthMeters || 0} × {heightMeters || 0}</div>
              <div><b>Ruudukko:</b> {sizeCalc.cols} × {sizeCalc.rows} ({sizeCalc.total} kpl)</div>
              <div><b>Asennus:</b> {mountType}</div>
              {mountType === "jaloilla" && (
                <div style={{ marginTop: 4 }}>
                  <div>Suositus tolppa: <b>{mountingItems.useShort ? "Lyhyt" : "Pitkä"}</b></div>
                  <div>Lyhyitä: <b>{mountingItems.shortPoles}</b>, Pitkiä: <b>{mountingItems.longPoles}</b></div>
                  <div>Plateja: <b>{mountingItems.plates}</b></div>
                </div>
              )}
            </div>

            <h4>Kaapelit</h4>
            <ul style={{ marginTop: 4 }}>
              <li>DATA-väli: <b>{cableCalc.dataMidQty}</b> kpl</li>
              <li>VIRTA-väli: <b>{cableCalc.powerMidQty}</b> kpl</li>
              <li>DATA syöttö: <b>{cableCalc.dataFeedQty}</b> kpl</li>
              <li>VIRTA syöttö: <b>{cableCalc.powerFeedQty}</b> kpl</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
