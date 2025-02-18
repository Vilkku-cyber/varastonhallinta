import React, { useState, useEffect } from "react";
import { database, ref, push, onValue } from "./firebaseConfig";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

function CreateTrip() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [status, setStatus] = useState("pakkaamatta");
  const [inventory, setInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);

  // Haetaan varaston tuotteet
  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Muunnetaan data taulukoksi, jossa jokaiselle tuotteelle { id, ...value }
        const inventoryList = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
        setInventory(inventoryList);
      }
    });
  }, []);

  // Uuden tyhjän kohteen lisääminen lomakkeelle
  const addItem = () => {
    setSelectedItems((prev) => [...prev, { id: "", quantity: 1 }]);
  };

  // Päivitetään valitun tuotteen ID tai määrä
  const updateItem = (index, field, value) => {
    const updatedItems = [...selectedItems];
    // Jos vaihdetaan tuote
    if (field === "id") {
      updatedItems[index] = { id: value, quantity: 1 };
    } else {
      // Estetään määrän ylitys
      const selectedProduct = inventory.find((prod) => prod.id === updatedItems[index].id);
      const maxQuantity = selectedProduct ? selectedProduct.available : 1;
      updatedItems[index].quantity = Math.min(Number(value), maxQuantity);
    }
    setSelectedItems(updatedItems);
  };

  // Tallennus Firebaseen
  const saveTrip = () => {
    // Suodatetaan ne itemit, joilla on valittu tuote
    const filteredItems = selectedItems.filter((item) => item.id);

    // Varmistetaan, että kentät on täytetty
    if (
      !name.trim() ||
      !(startDate instanceof Date) ||
      !(endDate instanceof Date) ||
      filteredItems.length === 0
    ) {
      alert("Täytä kaikki kentät ennen tallennusta!");
      return;
    }

    const newTrip = {
      name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status,
      items: filteredItems,
    };
    console.log("Tallennetaan keikka:", newTrip);

    const tripsRef = ref(database, "keikat");
    push(tripsRef, newTrip).then(() => {
      navigate("/");
    });
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

      <label>Alkamispäivä:</label>
      <br />
      <DatePicker
        selected={startDate}
        onChange={(date) => setStartDate(date instanceof Date ? date : null)}
        dateFormat="dd.MM.yyyy"
        placeholderText="Valitse alkamispäivä"
      />
      <br />
      <br />

      <label>Päättymispäivä:</label>
      <br />
      <DatePicker
        selected={endDate}
        onChange={(date) => setEndDate(date instanceof Date ? date : null)}
        dateFormat="dd.MM.yyyy"
        placeholderText="Valitse päättymispäivä"
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
        <option value="pakkattu">pakattu</option>
        <option value="keikalla">keikalla</option>
        <option value="purkamatta">purkamatta</option>
      </select>
      <br />
      <br />

      <h2>Lisää tavarat</h2>
      {selectedItems.map((item, index) => (
        <div key={index}>
          <select
            value={item.id}
            onChange={(e) => updateItem(index, "id", e.target.value)}
          >
            <option value="">Valitse tuote</option>
            {inventory.length > 0 ? (
              inventory.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.available} kpl varastossa)
                </option>
              ))
            ) : (
              <option disabled>Ei tuotteita varastossa</option>
            )}
          </select>
          <input
            type="number"
            value={item.quantity}
            min="1"
            max={inventory.find((prod) => prod.id === item.id)?.available || 1}
            onChange={(e) => updateItem(index, "quantity", e.target.value)}
          />
        </div>
      ))}
      <button onClick={addItem}>+ Lisää tuote</button>
      <br />
      <br />

      <button onClick={() => navigate("/")}>Palaa</button>
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
