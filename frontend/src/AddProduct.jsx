import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, push } from "./firebaseConfig"; // Firebase-yhteys

function AddProduct() {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState("Muu"); // 🔹 Oletuskategoria "Muu"
  const [dimensions, setDimensions] = useState("");
  const [weight, setWeight] = useState("");
  const [details, setDetails] = useState("");
  const navigate = useNavigate();

  // 🔹 Lisää tuote Firebaseen
  const addProduct = () => {
    if (!name.trim() || quantity <= 0) return;

    const inventoryRef = ref(database, "inventory");
    push(inventoryRef, {
      name,
      available: quantity,
      reserved: 0, // Oletuksena keikalla ei ole mitään
      category, // 🔹 Tallennetaan kategoria
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
        <option value="LED">LED</option>
        <option value="TV">TV</option>
        <option value="Muu">Muu</option>
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
