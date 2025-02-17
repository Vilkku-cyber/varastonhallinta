import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { database, ref, get, update, remove, onValue } from "./firebaseConfig"; // Firebase-yhteys

function EditTrip() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [inventory, setInventory] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  const [showProductList, setShowProductList] = useState(false);

  // 🔹 Haetaan varaston tuotteet Firebasesta
  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInventory(data);
      }
    });
  }, []);

  // 🔹 Haetaan keikan tiedot Firebasesta
  useEffect(() => {
    const tripRef = ref(database, `keikat/${id}`);

    get(tripRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          console.log("Keikan data ladattu:", data);

          setName(data.name || "");
          setDate(data.date || "");

          if (data.items) {
            setSelectedItems(
              Object.entries(data.items).map(([itemId, itemData]) => ({
                id: itemData.id,
                quantity: itemData.quantity,
                name: inventory[itemData.id]?.name || "Tuntematon tuote",
              }))
            );
          }
        } else {
          console.error("Keikkaa ei löytynyt!");
          navigate("/");
        }
      })
      .catch((error) => {
        console.error("Virhe haettaessa keikan tietoja:", error);
      });
  }, [id, navigate, inventory]);

  // 🔹 Palautetaan keikan tuotteet varastoon
  const returnTrip = () => {
    if (!window.confirm("Haluatko varmasti palauttaa keikan ja palauttaa tuotteet varastoon?")) return;

    // Päivitetään varaston määrät
    const inventoryUpdates = {};
    selectedItems.forEach((item) => {
      if (inventory[item.id]) {
        const newQuantity = inventory[item.id].available + item.quantity;
        inventoryUpdates[`inventory/${item.id}/available`] = newQuantity;
      }
    });

    // Siirretään keikka arkistoon
    const archivedTripRef = ref(database, `archived-trips/${id}`);
    update(archivedTripRef, {
      name: name,
      date: date,
      items: selectedItems,
      returned: true,
    });

    // Päivitetään varaston määrät Firebaseen
    update(ref(database), inventoryUpdates)
      .then(() => {
        console.log("Varaston määrät päivitetty.");
        // Poistetaan keikka aktiivisista keikoista
        remove(ref(database, `keikat/${id}`))
          .then(() => {
            alert("Keikka siirretty arkistoon ja tuotteet palautettu varastoon.");
            navigate("/");
          })
          .catch((error) => console.error("Virhe keikan poistossa:", error));
      })
      .catch((error) => console.error("Virhe varaston päivittämisessä:", error));
  };

  // 🔹 Lisää tuote valittujen listalle
  const addItem = (productId) => {
    if (!productId) return;
    if (selectedItems.some((item) => item.id === productId)) {
      alert("Tämä tuote on jo lisätty keikalle!");
      return;
    }
    setSelectedItems([
      ...selectedItems,
      {
        id: productId,
        quantity: 1,
        name: inventory[productId]?.name || "Tuntematon tuote",
      },
    ]);
    setShowProductList(false);
  };

  // 🔹 Päivitä valitun tuotteen määrä
  const updateQuantity = (index, value) => {
    const updatedItems = [...selectedItems];
    updatedItems[index].quantity = Math.max(1, Number(value));
    setSelectedItems(updatedItems);
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

      <label>Päivämäärä/aika:</label>
      <input
        type="text"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ display: "block", marginBottom: "10px" }}
      />

      <h2>Lisätyt tuotteet</h2>
      {selectedItems.length === 0 && <p>Ei tuotteita lisätty</p>}
      {selectedItems.map((item, index) => (
        <div key={index} style={{ marginBottom: "10px", display: "flex", alignItems: "center" }}>
          <strong>{item.name}</strong>
          <input
            type="number"
            value={item.quantity}
            min="1"
            onChange={(e) => updateQuantity(index, e.target.value)}
            style={{ width: "50px", marginLeft: "10px" }}
          />
        </div>
      ))}

      {showProductList ? (
        <div>
          <h3>Valitse tuote</h3>
          {Object.entries(inventory).map(([invId, product]) => (
            <button
              key={invId}
              onClick={() => addItem(invId)}
              style={{ display: "block", marginBottom: "5px" }}
            >
              {product.name} ({product.available} kpl)
            </button>
          ))}
        </div>
      ) : (
        <button onClick={() => setShowProductList(true)}>+ Lisää tuote</button>
      )}

      <br />
      <button onClick={() => navigate("/")}>Palaa</button>
      <button onClick={returnTrip} style={{ marginLeft: "10px", backgroundColor: "orange", color: "white" }}>
        Palautettu
      </button>
    </div>
  );
}

export default EditTrip;
