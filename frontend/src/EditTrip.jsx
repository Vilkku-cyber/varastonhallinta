import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, get, update, remove, onValue } from "./firebaseConfig";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import styles from "./CreateTripModal.module.css"; // Reuse the styles from CreateTripModal
import ProductSearchDropdown from "./ProductSearchDropdown";

function EditTrip({ onRequestClose, tripId }) {
  const navigate = useNavigate();

  // Use tripId directly from props
  const id = tripId;

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [status, setStatus] = useState("pakkaamatta");
  const [contact, setContact] = useState(""); // Lisätty yhteyshenkilön kenttä
  const [inventory, setInventory] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  const [showProductList, setShowProductList] = useState(false);
  const [showLedWizard, setShowLedWizard] = useState(false);
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
          setContact(data.contact || "");
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
      contact
    })
      .then(() => {
        alert("Keikka päivitetty!");
        onRequestClose(); // Close the modal after saving the trip
      })
      .catch((error) => console.error("Virhe tallennettaessa keikan tietoja:", error));
  };

  const returnTrip = () => {
    if (!window.confirm("Haluatko varmasti palauttaa keikan? Keikka arkistoidaan.")) return;
  
    const tripRef = ref(database, `keikat/${id}`);
    const archivedTripRef = ref(database, `archived-trips/${id}`);
  
    get(tripRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const tripData = snapshot.val(); // Haetaan kaikki keikan tiedot
  
          // Lisätään "returned: true" arkistoon ja tallennetaan kaikki muut tiedot
          return update(archivedTripRef, {
            ...tripData,
            returned: true, 
          });
        } else {
          throw new Error("Keikkaa ei löytynyt!");
        }
      })
      .then(() => {
        return remove(tripRef); // Poistetaan keikka aktiivisista keikoista
      })
      .then(() => {
        alert("Keikka arkistoitu.");
        onRequestClose(); // Suljetaan modal
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

  const getReservedCounts = () => {
    const counts = {};
    selectedItems.forEach(item => {
      if (!counts[item.id]) counts[item.id] = 0;
      counts[item.id] += Number(item.quantity);
    });
    return counts;
  };

  // Luo flat inventory-objekti id -> item
  const flatInventory = Object.values(inventory).flat().reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

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

      <label htmlFor="startDate">Alkamispäivä ja -aika:</label>
      <DatePicker
        selected={startDate}
        onChange={(date) => setStartDate(date)}
        dateFormat="dd.MM.yyyy p"
        showTimeSelect
        timeFormat="HH:mm"
        timeIntervals={15}
        timeCaption="aika"
        placeholderText="Valitse alkamispäivä ja -aika"
        id="startDate"
      />
      <br /><br />

      <label htmlFor="endDate">Päättymispäivä ja -aika:</label>
      <DatePicker
        selected={endDate}
        onChange={(date) => setEndDate(date)}
        dateFormat="dd.MM.yyyy p"
        showTimeSelect
        timeFormat="HH:mm"
        timeIntervals={15}
        timeCaption="aika"
        placeholderText="Valitse päättymispäivä ja -aika"
        id="endDate"
      />
      <br /><br />

      <label htmlFor="contact">Yhteyshenkilö:</label>
      <input
        type="text"
        id="contact"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        style={{ display: "block", marginBottom: "10px" }}
      />

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

      <h2 style={{ color: 'black' }}>Lisäätyt tuotteet</h2>

      {selectedItems.length === 0 && <p>Ei tuotteita lisätty</p>}
      {selectedItems.map((item, index) => (
        <div key={index}>
          <span>{item.name || inventory[item.id]?.name || "LED-osanen"}</span>
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
        <div style={{ marginTop: "10px", border: "1px solid gray", padding: "10px" }}>
          <h3>Valitse tuote lisättäväksi</h3>
          <ProductSearchDropdown
            categorizedInventory={Object.entries(inventory).reduce((acc, [id, item]) => {
              const category = item.category || "Muu";
              if (!acc[category]) acc[category] = [];
              acc[category].push({ id, ...item });
              return acc;
            }, {})}
            value=""
            onChange={(productId) => {
              addItemToTrip(productId);
              setShowProductList(false);
            }}
            reservedCounts={getReservedCounts()}
          />
          <button onClick={() => setShowProductList(false)} style={{ marginTop: "10px" }}>
            Sulje
          </button>
        </div>
      )}

    

      {showLedWizard && (
        <div style={{ marginBottom: "20px", border: "1px solid #ccc", padding: "10px" }}>
          <AddLEDWallWizard
            onAddItems={(items) => {
              const updated = [...selectedItems];
              items.forEach((item) => {
                const index = updated.findIndex(i => i.id === item.id);
                if (index !== -1) {
                  updated[index].quantity += item.quantity;
                } else {
                  updated.push({ id: item.id, quantity: item.quantity, name: inventory[item.id]?.name || "LED-osanen" });
                }
              });
              setSelectedItems(updated);
              setShowLedWizard(false);
            }}
          />
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
