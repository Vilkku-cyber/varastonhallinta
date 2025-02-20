import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, push, onValue } from "./firebaseConfig"; // Firebase-yhteys

function AddProduct() {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState(""); // Alustetaan ilman oletusarvoa
  const [dimensions, setDimensions] = useState("");
  const [weight, setWeight] = useState("");
  const [details, setDetails] = useState("");
  const [categories, setCategories] = useState([]); // State for categories
  const navigate = useNavigate();

  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const uniqueCategories = new Set();
      snapshot.forEach(childSnapshot => {
        const category = childSnapshot.val().category;
        if (category) {
          uniqueCategories.add(category);
        }
      });
      setCategories(Array.from(uniqueCategories));
    });
  }, []);

  const addProduct = () => {
    if (!name.trim() || quantity <= 0) return;

    const inventoryRef = ref(database, "inventory");
    push(inventoryRef, {
      name,
      available: quantity,
      reserved: 0, // Oletuksena keikalla ei ole mitään
      category, // Tallennetaan kategoria
      dimensions,
      weight,
      details,
    }).then(() => {
      navigate("/inventory"); // Palaa varastonäkymään
    });
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Lisää uusi tuote</h1>

      <label>Tuotenimi:</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} />

      <label>Varastossa oleva määrä:</label>
      <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" />

      <label>Kategoria:</label>
      <select value={category} onChange={e => setCategory(e.target.value)}>
        {categories.map((cat, index) => (
          <option key={index} value={cat}>{cat}</option>
        ))}
      </select>

      <label>Mitat:</label>
      <input type="text" value={dimensions} onChange={e => setDimensions(e.target.value)} />

      <label>Paino:</label>
      <input type="text" value={weight} onChange={e => setWeight(e.target.value)} />

      <label>Lisätiedot:</label>
      <textarea value={details} onChange={e => setDetails(e.target.value)} />

      <br />
      <button onClick={() => navigate("/inventory")}>Palaa</button>
      <button onClick={addProduct}>Tallenna</button>
    </div>
  );
}

export default AddProduct;
