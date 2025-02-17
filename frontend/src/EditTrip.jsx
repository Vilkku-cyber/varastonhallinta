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
      .catch((error) => console.error("Virhe haettaessa keikan tietoja:", error));
  }, [id, navigate, inventory]);

  // 🔹 Palautetaan keikka (EI muuta varastoa)
  const returnTrip = () => {
    if (!window.confirm("Haluatko varmasti palauttaa keikan? Keikka arkistoidaan.")) return;

    // Siirretään keikka arkistoon ilman varaston muutoksia
    const archivedTripRef = ref(database, `archived-trips/${id}`);
    update(archivedTripRef, {
      name: name,
      date: date,
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

  // 🔹 Poistetaan keikka ilman arkistointia
  const deleteTrip = () => {
    if (!window.confirm("Haluatko varmasti poistaa tämän keikan? Tätä ei voi perua!")) return;

    remove(ref(database, `keikat/${id}`))
      .then(() => {
        alert("Keikka poistettu pysyvästi.");
        navigate("/");
      })
      .catch((error) => console.error("Virhe keikan poistossa:", error));
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
            onChange={(e) => {
              const updatedItems = [...selectedItems];
              updatedItems[index].quantity = Math.max(1, Number(e.target.value));
              setSelectedItems(updatedItems);
            }}
            style={{ width: "50px", marginLeft: "10px" }}
          />
        </div>
      ))}

      <br />
      <button onClick={() => navigate("/")}>Palaa</button>
      <button onClick={returnTrip} style={{ marginLeft: "10px", backgroundColor: "orange", color: "white" }}>
        Palautettu
      </button>
      <button onClick={deleteTrip} style={{ marginLeft: "10px", backgroundColor: "red", color: "white" }}>
        Poista keikka
      </button>
    </div>
  );
}

export default EditTrip;
