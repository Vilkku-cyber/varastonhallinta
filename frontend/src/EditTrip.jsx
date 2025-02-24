import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, get, update, remove, onValue } from "./firebaseConfig";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import styles from "./CreateTripModal.module.css"; // Reuse the styles from CreateTripModal

function EditTrip({ onRequestClose, tripId }) {
  const navigate = useNavigate();

  // Use tripId directly from props
  const id = tripId;

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [status, setStatus] = useState("pakkaamatta");

  const [inventory, setInventory] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  const [showProductList, setShowProductList] = useState(false);
  const [isInventoryLoaded, setIsInventoryLoaded] = useState(false);

  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInventory(data);
        setIsInventoryLoaded(true);
        console.log("Inventory loaded:", data);
      }
    });
  }, []);

  useEffect(() => {
    if (!isInventoryLoaded || !id) return;

    console.log(`Fetching trip with ID: ${id}`); // Log the ID being used

    const tripRef = ref(database, `keikat/${id}`);
    get(tripRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          console.log("Trip data retrieved:", data); // Log the data retrieved
          setName(data.name || "");
          setStartDate(data.startDate ? new Date(data.startDate) : null);
          setEndDate(data.endDate ? new Date(data.endDate) : null);
          if (data.status) {
            setStatus(data.status);
          }

          if (data.items) {
            setSelectedItems(
              Object.entries(data.items).map(([itemKey, itemValue]) => ({
                id: itemValue.id,
                quantity: itemValue.quantity,
                name: inventory[itemValue.id]?.name || "Tuntematon tuote",
              }))
            );
          }
        } else {
          console.error("Keikkaa ei löytynyt!");
          navigate("/");
        }
      })
      .catch((error) => console.error("Virhe haettaessa keikan tietoja:", error));
  }, [id, navigate, isInventoryLoaded]);

  const saveTrip = () => {
    const tripRef = ref(database, `keikat/${id}`);
    const updatedItems = selectedItems.reduce((acc, item) => {
      acc[item.id] = { id: item.id, quantity: item.quantity };
      return acc;
    }, {});

    update(tripRef, {
      name,
      startDate: startDate ? startDate.toISOString() : "",
      endDate: endDate ? endDate.toISOString() : "",
      status,
      items: updatedItems,
    })
      .then(() => {
        alert("Keikka päivitetty!");
        onRequestClose(); // Close the modal after saving the trip
      })
      .catch((error) => console.error("Virhe tallennettaessa keikan tietoja:", error));
  };

  const returnTrip = () => {
    if (!window.confirm("Haluatko varmasti palauttaa keikan? Keikka arkistoidaan.")) return;

    const archivedTripRef = ref(database, `archived-trips/${id}`);
    update(archivedTripRef, {
      name,
      startDate: startDate ? startDate.toISOString() : "",
      endDate: endDate ? endDate.toISOString() : "",
      status,
      items: selectedItems,
      returned: true,
    })
      .then(() => {
        remove(ref(database, `keikat/${id}`))
          .then(() => {
            alert("Keikka arkistoitu.");
            onRequestClose(); // Close the modal after archiving the trip
          })
          .catch((error) => console.error("Virhe keikan poistossa:", error));
      })
      .catch((error) => console.error("Virhe arkistoinnissa:", error));
  };

  const deleteTrip = () => {
    if (!window.confirm("Haluatko varmasti poistaa tämän keikan? Tätä ei voi perua!")) return;
    remove(ref(database, `keikat/${id}`))
      .then(() => {
        alert("Keikka poistettu pysyvästi.");
        onRequestClose(); // Close the modal after deleting the trip
      })
      .catch((error) => console.error("Virhe keikan poistossa:", error));
  };

  const removeItem = (index) => {
    const updatedItems = [...selectedItems];
    updatedItems.splice(index, 1);
    setSelectedItems(updatedItems);
  };

  const addItemToTrip = (itemId) => {
    const itemName = inventory[itemId]?.name || "Tuntematon tuote";
    setSelectedItems([...selectedItems, { id: itemId, quantity: 1, name: itemName }]);
    setShowProductList(false);
  };

  return (
    <div className={styles.modalContent}>
      <h1>Muokkaa keikkaa</h1>

      <label htmlFor="tripName">Keikan nimi:</label>
      <input
        type="text"
        id="tripName"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ display: "block", marginBottom: "10px" }}
      />

      <label htmlFor="startDate">Alkamispäivä:</label>
      <DatePicker
        selected={startDate}
        onChange={(date) => setStartDate(date)}
        dateFormat="dd.MM.yyyy"
        placeholderText="Valitse alkamispäivä"
        id="startDate"
      />
      <br /><br />

      <label htmlFor="endDate">Päättymispäivä:</label>
      <DatePicker
        selected={endDate}
        onChange={(date) => setEndDate(date)}
        dateFormat="dd.MM.yyyy"
        placeholderText="Valitse päättymispäivä"
        id="endDate"
      />
      <br /><br />

      <label htmlFor="status">Status:</label><br />
      <select
        id="status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="pakkaamatta">pakkaamatta</option>
        <option value="pakattu">pakattu</option>
        <option value="keikalla">keikalla</option>
        <option value="purkamatta">purkamatta</option>
      </select>
      <br /><br />

      <h2>Lisätyt tuotteet</h2>
      {selectedItems.length === 0 && <p>Ei tuotteita lisätty</p>}
      {selectedItems.map((item, index) => (
        <div
          key={index}
          style={{ marginBottom: "10px", display: "flex", alignItems: "center" }}
        >
          <strong>{item.name}</strong>
          <input
            type="number"
            value={item.quantity}
            min="1"
            onChange={(e) => {
              const updatedItems = [...selectedItems];
              updatedItems[index].quantity = Math.max(1, Number(e.target.value));
              setSelectedItems(updatedItems);
            }}
            style={{ width: "50px", marginLeft: "10px" }}
          />
          <button
            onClick={() => removeItem(index)}
            style={{ marginLeft: "10px", color: "red" }}
          >
            🗑️ Poista
          </button>
        </div>
      ))}

      <br />
      <button
        onClick={() => setShowProductList(true)}
        style={{ backgroundColor: "blue", color: "white" }}
      >
        + Lisää tuotteita
      </button>

      {showProductList && (
        <div style={{ border: "1px solid gray", padding: "10px", marginTop: "10px" }}>
          <h3>Valitse tuote lisättäväksi</h3>
          {Object.entries(inventory).map(([prodId, item]) => (
            <button
              key={prodId}
              onClick={() => addItemToTrip(prodId)}
              style={{ display: "block", marginBottom: "5px" }}
            >
              {item.name}
            </button>
          ))}
          <button onClick={() => setShowProductList(false)} style={{ marginTop: "10px" }}>
            Sulje
          </button>
        </div>
      )}

      <br />
      <button onClick={onRequestClose}>Palaa</button>
      <button
        onClick={saveTrip}
        style={{ marginLeft: "10px", backgroundColor: "green", color: "white" }}
      >
        Tallenna keikka
      </button>
      <button
        onClick={returnTrip}
        style={{ marginLeft: "10px", backgroundColor: "orange", color: "white" }}
      >
        Palautettu
      </button>
      <button
        onClick={deleteTrip}
        style={{ marginLeft: "10px", backgroundColor: "red", color: "white" }}
      >
        Poista keikka
      </button>
    </div>
  );
}

export default EditTrip;
