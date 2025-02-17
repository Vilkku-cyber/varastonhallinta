import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { database, ref, get, update, remove, onValue } from "./firebaseConfig"; // Firebase-yhteys

function EditTrip() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [inventory, setInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);

  // 🔹 Haetaan keikan tiedot Firebasesta
  useEffect(() => {
    const tripRef = ref(database, `keikat/${id}`);

    get(tripRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setName(data.nimi || "");
          setDate(data.aika || "");
          if (data.items) {
            setSelectedItems(Object.entries(data.items).map(([itemId, itemData]) => ({
              id: itemId,
              quantity: itemData.quantity,
            })));
          }
        } else {
          console.error("Keikkaa ei löytynyt!");
          navigate("/");
        }
      })
      .catch((error) => console.error("Virhe haettaessa keikan tietoja:", error));

    // 🔹 Haetaan varaston tuotteet Firebasesta
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const inventoryList = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
        setInventory(inventoryList);
      }
    });
  }, [id, navigate]);

  // 🔹 Lisää uusi tyhjä tuotteen valinta
  const addItem = () => {
    setSelectedItems([...selectedItems, { id: "", quantity: 1 }]);
  };

  // 🔹 Päivitä valittu tuote/määrä
  const updateItem = (index, field, value) => {
    const updatedItems = [...selectedItems];

    if (field === "id") {
      updatedItems[index] = { id: value, quantity: 1 };
    } else {
      const selectedProduct = inventory.find((prod) => prod.id === updatedItems[index].id);
      const maxQuantity = selectedProduct ? selectedProduct.available : 1;
      updatedItems[index].quantity = Math.min(Number(value), maxQuantity);
    }

    setSelectedItems(updatedItems);
  };

  // 🔹 Tallenna keikka Firebaseen
  const saveTrip = () => {
    if (!name.trim() || !date.trim()) return;

    const tripRef = ref(database, `keikat/${id}`);
    update(tripRef, {
      nimi: name,
      aika: date,
      items: selectedItems.reduce((acc, item) => {
        acc[item.id] = { quantity: item.quantity };
        return acc;
      }, {}),
    })
      .then(() => navigate("/"))
      .catch((error) => console.error("Virhe tallennettaessa keikkaa:", error));
  };

  // 🔹 Poista keikka Firebasesta
  const deleteTrip = () => {
    if (window.confirm("Haluatko varmasti poistaa tämän keikan?")) {
      const tripRef = ref(database, `keikat/${id}`);

      remove(tripRef)
        .then(() => {
          alert("Keikka poistettu!");
          navigate("/");
        })
        .catch((error) => console.error("Virhe poistettaessa keikkaa:", error));
    }
  };

  // 🔹 Merkitse keikka palautetuksi
  const markAsReturned = () => {
    if (window.confirm("Haluatko varmasti merkitä keikan palautetuksi?")) {
      const tripRef = ref(database, `keikat/${id}`);
      update(tripRef, { palautettu: true })
        .then(() => {
          alert("Keikka merkitty palautetuksi!");
          navigate("/");
        })
        .catch((error) => console.error("Virhe merkittäessä keikkaa palautetuksi:", error));
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Muokkaa keikkaa</h1>

      <label>Keikan nimi:</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />

      <label>Aika:</label>
      <input type="text" value={date} onChange={(e) => setDate(e.target.value)} />

      <h2>Lisää tavarat</h2>
      {selectedItems.map((item, index) => (
        <div key={index}>
          <select value={item.id} onChange={(e) => updateItem(index, "id", e.target.value)}>
            <option value="">Valitse tuote</option>
            {inventory.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.available} kpl varastossa)
              </option>
            ))}
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
      <button onClick={() => navigate("/")}>Palaa</button>
      <button onClick={saveTrip}>Tallenna</button>
      <button onClick={markAsReturned} style={{ marginLeft: "10px", backgroundColor: "orange", color: "white" }}>
        Palautettu
      </button>
      <button onClick={deleteTrip} style={{ marginLeft: "10px", backgroundColor: "red", color: "white" }}>
        Poista keikka
      </button>
    </div>
  );
}

export default EditTrip;
