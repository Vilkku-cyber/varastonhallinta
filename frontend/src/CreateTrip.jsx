import React, { useState, useEffect } from "react";
import { database, ref, push, onValue } from "./firebaseConfig";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import ProductSearchDropdown from "./ProductSearchDropdown";


import "react-datepicker/dist/react-datepicker.css";

function CreateTrip({ onRequestClose, initialSeed, onCreated }) {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [status, setStatus] = useState("pakkaamatta");

  const [categorizedInventory, setCategorizedInventory] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  const [contact, setContact] = useState(""); // Lisätty yhteyshenkilön kenttä
  const [globalReservedCounts, setGlobalReservedCounts] = useState({});
  const [showProductList, setShowProductList] = useState(false);
  const [showLedWizard, setShowLedWizard] = useState(false);

  // 1) Haetaan varaston tuotteet ja kategorisoidaan ne
  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val() || {};
      const categorized = Object.entries(data).reduce((acc, [id, item]) => {
        const category = item.category || "Muu";
        if (!acc[category]) acc[category] = [];
        acc[category].push({ id, ...item });
        return acc;
      }, {});
      setCategorizedInventory(categorized);
    });
  }, []);

  // 2) Lasketaan globaalit varaukset
  useEffect(() => {
    const tripsRef = ref(database, "keikat");
    onValue(tripsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const counts = {};
      Object.values(data).forEach(trip => {
        if (trip.items) {
          Object.values(trip.items).forEach(item => {
            if (!counts[item.id]) counts[item.id] = 0;
            counts[item.id] += Number(item.quantity);
          });
        }
      });
      setGlobalReservedCounts(counts);
    });
  }, []);

  // 3) ESITÄYTÄ tuotteet suunnitelmasta (LedPlanner → initialSeed)
  //    Sallitaan muodot:
  //    - initialSeed = { items: [{id, quantity, name?}, ...], name? }
  //    - initialSeed = [{id, quantity, name?}, ...]
  useEffect(() => {
    if (!initialSeed) return;

    const seedItemsArray = Array.isArray(initialSeed)
      ? initialSeed
      : Array.isArray(initialSeed.items)
        ? initialSeed.items
        : [];

    if (seedItemsArray.length === 0) return;

    // Haetaan nimi jos annettu
    if (initialSeed.name && typeof initialSeed.name === "string") {
      setName(initialSeed.name);
    } else if (!name) {
      setName("LED-suunnitelma");
    }

    // Täydennä puuttuvat nimet varastosta
    const flatInventory = Object.values(categorizedInventory).flat();
    const byId = flatInventory.reduce((m, it) => { m[it.id] = it; return m; }, {});

    // Yhdistä samat tuotteet (summaa määrät), täydentäen nimen jos puuttuu
    const merged = {};
    seedItemsArray.forEach(it => {
      if (!it?.id || !it?.quantity) return;
      const key = it.id;
      if (!merged[key]) {
        merged[key] = {
          id: it.id,
          quantity: 0,
          name: it.name || byId[it.id]?.name || "Tuntematon tuote",
        };
      }
      merged[key].quantity += Number(it.quantity);
    });

    const next = Object.values(merged);
    if (next.length) setSelectedItems(next);
  // huom. riippuvuuksissa initialSeed riittää — emme re-siivitä kun inv päivittyy
  }, [initialSeed]); // eslint-disable-line react-hooks/exhaustive-deps

  const getReservedCounts = () => {
    const counts = {};
    selectedItems.forEach(item => {
      if (!counts[item.id]) counts[item.id] = 0;
      counts[item.id] += Number(item.quantity);
    });
    return counts;
  };

  const addItemToTrip = (itemId) => {
    const flatInventory = Object.values(categorizedInventory).flat();
    const selectedProduct = flatInventory.find(i => i.id === itemId);
    const itemName = selectedProduct?.name || "Tuntematon tuote";

    let updatedItems = [...selectedItems];

    // Jos tuotetta ei ole jo valittu, lisätään se
    if (!updatedItems.find(i => i.id === itemId)) {
      updatedItems.push({ id: itemId, quantity: 1, name: itemName });
    }

    setSelectedItems(updatedItems);
    setShowProductList(false);
  };

  const saveTrip = () => {
    const filteredItems = selectedItems.filter(item => item.id && item.quantity > 0);

    if (!name.trim() || !startDate || !endDate || filteredItems.length === 0) {
      alert("Täytä kaikki kentät ennen tallennusta!");
      return;
    }

    const itemsObject = filteredItems.reduce((obj, item) => {
      obj[item.id] = {
        id: item.id,
        quantity: item.quantity,
        ...(item.name ? { name: item.name } : {}),
      };
      return obj;
    }, {});

    const newTrip = {
      name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status,
      items: itemsObject,
      contact: contact.trim() || null,
    };

    const tripsRef = ref(database, "keikat");
    push(tripsRef, newTrip)
      .then(() => {
        if (typeof onCreated === "function") {
          onCreated();
        } else {
          onRequestClose();
        }
      })
      .catch(error => console.error("Error saving trip:", error));
  };

  // Luo flat inventory-objekti id -> item (helppoon nimen näyttöön)
  const inventory = Object.values(categorizedInventory).flat().reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Luo uusi keikka</h1>

      <label>Keikan nimi:</label>
      <br />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
        placeholder="Keikan nimi"
      />

      <label>Alkamispäivä:</label>
      <br />
      <DatePicker
        selected={startDate}
        onChange={(date) => setStartDate(date)}
        dateFormat="dd.MM.yyyy"
        placeholderText="Valitse alkamispäivä"
      />
      <br /><br />

      <label>Päättymispäivä:</label>
      <br />
      <DatePicker
        selected={endDate}
        onChange={(date) => setEndDate(date)}
        dateFormat="dd.MM.yyyy"
        placeholderText="Valitse päättymispäivä"
      />
      <br /><br />

      <label>Yhteyshenkilö:</label>
      <br />
      <input
        type="text"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
        placeholder="Nimi / puh / sähköposti"
      />

      <label>Status:</label>
      <br />
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="pakkaamatta">pakkaamatta</option>
        <option value="pakattu">pakattu</option>
        <option value="keikalla">keikalla</option>
        <option value="purkamatta">purkamatta</option>
      </select>

      <h2 style={{ marginTop: 16 }}>Lisätyt tuotteet</h2>
      {selectedItems.length === 0 && <p>Ei tuotteita lisätty</p>}
      {selectedItems.map((item, index) => (
        <div
          key={`${item.id}-${index}`}
          style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: 8 }}
        >
          <strong>{item.name || inventory[item.id]?.name || item.id}</strong>
          <input
            type="number"
            value={item.quantity}
            min="1"
            onChange={(e) => {
              const updated = [...selectedItems];
              updated[index].quantity = Math.max(1, Number(e.target.value));
              setSelectedItems(updated);
            }}
            style={{ width: 70 }}
          />
          <button
            onClick={() => {
              const updated = [...selectedItems];
              updated.splice(index, 1);
              setSelectedItems(updated);
            }}
            style={{ color: "red" }}
          >
            🗑️ Poista
          </button>
        </div>
      ))}

      <button onClick={() => setShowProductList(true)} style={{ marginTop: 8 }}>
        + Lisää tuotteita
      </button>

      {showProductList && (
        <div style={{ marginTop: 10, border: "1px solid #ccc", padding: 10 }}>
          <h3>Valitse tuote lisättäväksi</h3>
          <ProductSearchDropdown
            categorizedInventory={categorizedInventory}
            value=""
            onChange={(productId) => {
              addItemToTrip(productId);
              setShowProductList(false);
            }}
            reservedCounts={{
              ...globalReservedCounts,
              ...getReservedCounts(),
            }}
          />
          <button onClick={() => setShowProductList(false)} style={{ marginTop: 10 }}>
            Sulje
          </button>
        </div>
      )}

      <br />

      <button onClick={onRequestClose}>Palaa</button>
      <button onClick={saveTrip} style={{ marginLeft: 10 }}>
        Tallenna
      </button>
    </div>
  );
}

export default CreateTrip;
