import React, { useState, useEffect } from "react";
import { database, ref, push, onValue } from "./firebaseConfig";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import ProductSearchDropdown from "./ProductSearchDropdown";

import "react-datepicker/dist/react-datepicker.css";

function CreateTrip({ onRequestClose }) {
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

  // Haetaan varaston tuotteet ja kategorisoidaan ne
  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      const categorized = Object.entries(data).reduce((acc, [id, item]) => {
        const category = item.category || "Muu"; // Olettaen että jokaisella tuotteella on 'category'
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push({ id, ...item });
        return acc;
      }, {});

      setCategorizedInventory(categorized);
    });
  }, []);

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

    // Tarkistus LED-tuotteelle
    if (selectedProduct?.category === "LED") {
      const baseQty = 1 + 5;
      const roundedQuantity = Math.ceil(baseQty / 10) * 10;

      const dataId = "-OJXJ6E56XO1N5XUquNG"; // DATA-väli
      const powerId = "-OJXJSDQchN5n01ZW5RL"; // VIRTA-väli

      const addOrUpdateCable = (cableId, cableName) => {
        const index = updatedItems.findIndex(item => item.id === cableId);
        if (index === -1) {
          updatedItems.push({ id: cableId, quantity: roundedQuantity, name: cableName });
        } else {
          updatedItems[index].quantity = roundedQuantity;
        }
      };

      addOrUpdateCable(dataId, "DATA-väli");
      addOrUpdateCable(powerId, "VIRTA-väli");
    }

    setSelectedItems(updatedItems);
    setShowProductList(false);
  };

  const removeItem = (index) => {
    const updatedItems = [...selectedItems];
    updatedItems.splice(index, 1);
    setSelectedItems(updatedItems);
  };

  const saveTrip = () => {
  // Suodatetaan ne itemit, joilla on valittu tuote ja joiden tiedot ovat kunnossa
  const filteredItems = selectedItems.filter(item => item.id && item.quantity > 0);

  // Tarkistetaan, että tarvittavat tiedot on annettu
  if (!name.trim() || !startDate || !endDate || filteredItems.length === 0) {
    alert("Täytä kaikki kentät ennen tallennusta!");
    return;
  }

  // Muodostetaan items-objekti, jossa jokainen tuote sisältää id:n ja määrän
  const itemsObject = filteredItems.reduce((obj, item) => {
    // Tässä lisätään tuotteelle sen id
    obj[item.id] = { id: item.id, quantity: item.quantity };
    return obj;
  }, {});

    const newTrip = {
      name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status,
      items: itemsObject, // Tallenna tuotteet objektina
      contact: contact.trim() || null, // Include contact if provided, otherwise set to null
    };

    console.log("Tallennetaan keikka:", newTrip);

    const tripsRef = ref(database, "keikat");
    push(tripsRef, newTrip).then(() => {
      onRequestClose(); // Close the modal after saving the trip
    }).catch(error => console.error("Error saving trip:", error));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
    <h1>Luo uusi keikka</h1>

    <label>Keikan nimi:</label>
    <br />
    <input
      type="text"
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
    <br />
    <br />

    <label>Alkamispäivä ja -aika:</label>
    <br />
    <DatePicker
      selected={startDate}
      onChange={(date) => setStartDate(date)}
      dateFormat="dd.MM.yyyy p"
      showTimeSelect
      timeFormat="HH:mm"
      timeIntervals={15}
      timeCaption="aika"
      placeholderText="Valitse alkamispäivä ja -aika"
    />
    <br />
    <br />

    <label>Päättymispäivä ja -aika:</label>
    <br />
    <DatePicker
      selected={endDate}
      onChange={(date) => setEndDate(date)}
      dateFormat="dd.MM.yyyy p"
      showTimeSelect
      timeFormat="HH:mm"
      timeIntervals={15}
      timeCaption="aika"
      placeholderText="Valitse päättymispäivä ja -aika"
    />
    <br />
    <br />

    <label>Yhteyshenkilö:</label>
    <br />
    <input
      type="text"
      value={contact}
      onChange={(e) => setContact(e.target.value)}
      placeholder="Yhteyshenkilön nimi tai puhelinnumero"
    />
    <br />
    <br />

      <label>Status:</label>
      <br />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="pakkaamatta">pakkaamatta</option>
        <option value="pakattu">pakattu</option>
        <option value="keikalla">keikalla</option>
        <option value="purkamatta">purkamatta</option>
      </select>
      <br />
      <br />

      <h2 style={{ color: 'black' }}>Lisätyt tuotteet</h2>

      {selectedItems.length === 0 && <p>Ei tuotteita lisätty</p>}
      {selectedItems.map((item, index) => (
        <div key={index} style={{ marginBottom: "10px", display: "flex", alignItems: "center" }}>
          <strong>{item.name}</strong>
          <input
            type="number"
            value={item.quantity}
            min="1"
            onChange={(e) => {
              const updated = [...selectedItems];
              updated[index].quantity = Math.max(1, Number(e.target.value));
              setSelectedItems(updated);
            }}
            style={{ width: "50px", marginLeft: "10px" }}
          />
          <button onClick={() => removeItem(index)} style={{ marginLeft: "10px", color: "red" }}>🗑️ Poista</button>
        </div>
      ))}

      <button onClick={() => setShowProductList(true)} style={{ backgroundColor: "blue", color: "white" }}>
        + Lisää tuotteita
      </button>

      {showProductList && (
        <div style={{ marginTop: "10px", border: "1px solid gray", padding: "10px" }}>
          <h3>Valitse tuote lisättäväksi</h3>
          <ProductSearchDropdown
            categorizedInventory={categorizedInventory}
            value=""
            onChange={(productId) => {
              addItemToTrip(productId);
              setShowProductList(false);
            }}
            reservedCounts={getReservedCounts()}
            globalReservedCounts={globalReservedCounts}
          />
          <button onClick={() => setShowProductList(false)} style={{ marginTop: "10px" }}>
            Sulje
          </button>
        </div>
      )}

      <br />
      <br />

      <button onClick={onRequestClose}>Palaa</button>
      <button
        onClick={saveTrip}
        style={{ marginLeft: "10px" }}
      >
        Tallenna
      </button>
    </div>
  );
}

export default CreateTrip;
