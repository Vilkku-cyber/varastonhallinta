import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

function EditTrip() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [inventory, setInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    axios.get(`http://localhost:5000/api/trip/${id}`)
      .then(response => {
        setName(response.data.name);
        setDate(response.data.date);
        if (response.data.items) {
          setSelectedItems(response.data.items.map(item => ({
            id: item.id.toString(), // Varmista, että ID on string jotta valinta toimii
            quantity: item.quantity
          })));
        }
      })
      .catch(error => console.error("Virhe haettaessa keikan tietoja:", error));

    axios.get("http://localhost:5000/api/inventory")
      .then(response => setInventory(response.data))
      .catch(error => console.error("Virhe haettaessa varastotietoja:", error));
  }, [id]);

  const addItem = () => {
    setSelectedItems([...selectedItems, { id: "", quantity: 1 }]);
  };

  const updateItem = (index, field, value) => {
    const updatedItems = [...selectedItems];

    if (field === "id") {
      const product = inventory.find(prod => prod.id === Number(value));
      updatedItems[index] = { id: value, name: product?.name || "", quantity: 1 };
    } else {
      const selectedProduct = inventory.find(prod => prod.id === Number(updatedItems[index].id));
      const maxQuantity = selectedProduct ? selectedProduct.available : 1;
      updatedItems[index].quantity = Math.min(Number(value), maxQuantity);
    }

    setSelectedItems(updatedItems);
  };

  const saveTrip = () => {
    const filteredItems = selectedItems.filter(item => item.id);
    axios.post("http://localhost:5000/api/trip/update", { id, name, date, items: filteredItems })
      .then(() => navigate("/"))
      .catch(error => console.error("Virhe tallennettaessa keikkaa:", error));
  };

  const deleteTrip = () => {
    if (window.confirm("Haluatko varmasti poistaa tämän keikan?")) {
      axios.delete(`http://localhost:5000/api/trip/${id}`)
        .then(() => {
          alert("Keikka poistettu!");
          navigate("/");
        })
        .catch(error => console.error("Virhe poistettaessa keikkaa:", error));
    }
  };

  const markAsReturned = () => {
    if (window.confirm("Haluatko varmasti merkitä keikan palautetuksi?")) {
      axios.post(`http://localhost:5000/api/trip/return/${id}`)
        .then(() => {
          alert("Keikka merkitty palautetuksi!");
          navigate("/");
        })
        .catch(error => console.error("Virhe merkittäessä keikkaa palautetuksi:", error));
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Muokkaa keikkaa</h1>

      <label>Keikan nimi:</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} />

      <label>Aika:</label>
      <input type="text" value={date} onChange={e => setDate(e.target.value)} />

      <h2>Lisää tavarat</h2>
      {selectedItems.map((item, index) => (
        <div key={index}>
          <select value={item.id} onChange={e => updateItem(index, "id", e.target.value)}>
            <option value="">Valitse tuote</option>
            {inventory.map(product => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.available} kpl varastossa)
              </option>
            ))}
          </select>
          <input 
            type="number" 
            value={item.quantity} 
            min="1"
            max={inventory.find(prod => prod.id === Number(item.id))?.available || 1}
            onChange={e => updateItem(index, "quantity", e.target.value)} 
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
