import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function CreateTrip() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [inventory, setInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);

  // Hae varaston tuotteet
  useEffect(() => {
    axios.get("http://localhost:5000/api/inventory")
      .then(response => {
        console.log("Varastodata:", response.data); // 🆕 Debuggaus
        setInventory(response.data);
      })
      .catch(error => console.error("Virhe haettaessa varastotietoja:", error));
  }, []);

  // Lisää uusi tyhjä tuotteen valinta
  const addItem = () => {
    setSelectedItems([...selectedItems, { id: "", quantity: 1 }]);
  };

  // Päivitä valittu tuote/määrä
  const updateItem = (index, field, value) => {
    const updatedItems = [...selectedItems];

    if (field === "id") {
      // Nollaa määrä jos tuote vaihtuu
      updatedItems[index] = { id: value, quantity: 1 };
    } else {
      // Tarkista, että määrä ei ylitä varastosaldoa
      const selectedProduct = inventory.find(prod => prod.id === Number(updatedItems[index].id));
      const maxQuantity = selectedProduct ? selectedProduct.available : 1;
      updatedItems[index].quantity = Math.min(Number(value), maxQuantity);
    }

    setSelectedItems(updatedItems);
  };

  // Tallenna keikka
  const saveTrip = () => {
    const filteredItems = selectedItems.filter(item => item.id);
    axios.post("http://localhost:5000/api/trips", { name, date, items: filteredItems })
      .then(() => navigate("/"))
      .catch(error => console.error("Virhe tallennettaessa keikkaa:", error));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Luo uusi keikka</h1>

      <label>Keikan nimi:</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} />

      <label>Aika:</label>
      <input type="text" value={date} onChange={e => setDate(e.target.value)} />

      <h2>Lisää tavarat</h2>
      {selectedItems.map((item, index) => (
        <div key={index}>
          <select value={item.id} onChange={e => updateItem(index, "id", e.target.value)}>
            <option value="">Valitse tuote</option>
            {inventory.length > 0 ? (
              inventory.map(product => (
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
            max={inventory.find(prod => prod.id === Number(item.id))?.available || 1} // Estä ylisuuret määrät
            onChange={e => updateItem(index, "quantity", e.target.value)} 
          />
        </div>
      ))}
      <button onClick={addItem}>+ Lisää tuote</button>
      
      <br />
      <button onClick={() => navigate("/")}>Palaa</button>
      <button onClick={saveTrip}>Tallenna</button>
    </div>
  );
}

export default CreateTrip;
