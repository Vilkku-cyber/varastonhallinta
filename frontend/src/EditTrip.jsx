import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { database, ref, get, update, remove, onValue } from "./firebaseConfig";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

function EditTrip() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [status, setStatus] = useState("pakkaamatta");

  const [inventory, setInventory] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  const [showProductList, setShowProductList] = useState(false);

  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInventory(data);
      }
    });
  }, []);

  useEffect(() => {
    const tripRef = ref(database, `keikat/${id}`);
    get(tripRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setName(data.name || "");
          // Jos tallennettu string on ISO8601, muutetaan se takaisin JS-päivämääräksi
          setStartDate(data.startDate ? new Date(data.startDate) : null);
          setEndDate(data.endDate ? new Date(data.endDate) : null);
          if (data.status) {
            setStatus(data.status);
          }

          if (data.items) {
            // items -objekti tallentaa jokaiselle tuotteelle { id, quantity }
            // Ota nimen selvittämiseen apua inventory-objektista, jos haluat näyttää nimikkeet suoraan
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
  }, [id, navigate, inventory]);

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
        navigate("/");
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
            navigate("/");
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
        navigate("/");
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
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Muokkaa keikkaa</h1>

      <label>Keikan nimi:</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ display: "block", marginBottom: "10px" }}
      />

      <label>Alkamispäivä:</label>
      <DatePicker
        selected={startDate}
        onChange={(date) => setStartDate(date)}
        dateFormat="dd.MM.yyyy"
        placeholderText="Valitse alkamispäivä"
      />
      <br /><br />

      <label>Päättymispäivä:</label>
      <DatePicker
        selected={endDate}
        onChange={(date) => setEndDate(date)}
        dateFormat="dd.MM.yyyy"
        placeholderText="Valitse päättymispäivä"
      />
      <br /><br />

      <label>Status:</label><br />
      <select
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
      <button onClick={() => navigate("/")}>Palaa</button>
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
