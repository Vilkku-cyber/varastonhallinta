import React, { useState, useEffect } from "react";
import { database, ref, push, onValue } from "./firebaseConfig";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

function CreateTrip({ onRequestClose }) {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [status, setStatus] = useState("pakkaamatta");
  const [categorizedInventory, setCategorizedInventory] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);

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

  // Uuden tyhjän kohteen lisääminen lomakkeelle
  const addItem = () => {
    setSelectedItems((prev) => [...prev, { id: "", quantity: 1 }]);
  };

  // Päivitetään valitun tuotteen ID tai määrä
  const updateItem = (index, field, value) => {
    const updatedItems = [...selectedItems];

    // Jos tuotteen ID:tä päivitetään
    if (field === "id") {
      updatedItems[index] = { id: value, quantity: 1 };

      const selectedProduct = Object.values(categorizedInventory).flat().find((prod) => prod.id === value);
      if (selectedProduct && selectedProduct.category === "LED") {
        // Tarkista, ovatko lisätuotteet jo listalla
        const dataItemIndex = updatedItems.findIndex(item => item.id === "-OJXJ6E56XO1N5XUquNG");
        const powerItemIndex = updatedItems.findIndex(item => item.id === "-OJXJSDQchN5n01ZW5RL");

        // Jos ei ole listalla, lisää ne ja pyöristä määrät ylöspäin seuraavaan tasakymmeneen
        const initialQuantity = 1 + 5;
        const roundedQuantity = Math.ceil(initialQuantity / 10) * 10;
        if (dataItemIndex === -1) {
          updatedItems.push({ id: "-OJXJ6E56XO1N5XUquNG", quantity: roundedQuantity });
        }
        if (powerItemIndex === -1) {
          updatedItems.push({ id: "-OJXJSDQchN5n01ZW5RL", quantity: roundedQuantity });
        }
      }
      setSelectedItems(updatedItems);
    } else { // Jos tuotteen määrää päivitetään
      const selectedProduct = Object.values(categorizedInventory).flat().find((prod) => prod.id === updatedItems[index].id);
      const maxQuantity = selectedProduct ? selectedProduct.available : 1;
      updatedItems[index].quantity = Math.min(Number(value), maxQuantity);

      // Jos tuote on LED-kategoria, päivitä lisätuotteiden määrät pyöristäen ylöspäin seuraavaan tasakymmeneen
      if (selectedProduct && selectedProduct.category === "LED") {
        const initialQuantity = Number(value) + 5;
        const roundedQuantity = Math.ceil(initialQuantity / 10) * 10;
        updatedItems.forEach(item => {
          if (item.id === "-OJXJ6E56XO1N5XUquNG" || item.id === "-OJXJSDQchN5n01ZW5RL") {
            item.quantity = roundedQuantity;
          }
        });
      }
      setSelectedItems(updatedItems);
    }
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
            {Object.entries(categorizedInventory).map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.available} kpl varastossa)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            type="number"
            value={item.quantity}
            min="1"
            max={Object.values(categorizedInventory).flat().find((prod) => prod.id === item.id)?.available || 1}
            onChange={(e) => updateItem(index, "quantity", e.target.value)}
          />
        </div>
      ))}
      <button onClick={addItem}>+ Lisää tuote</button>
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
