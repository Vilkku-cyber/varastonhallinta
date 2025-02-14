import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function AddProduct() {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dimensions, setDimensions] = useState("");
  const [weight, setWeight] = useState("");
  const [details, setDetails] = useState("");
  const navigate = useNavigate();

  const addProduct = () => {
    axios.post("http://localhost:5000/api/inventory/add", {
      name,
      quantity,
      status: "available",
      dimensions,
      weight,
      details,
    })
      .then(() => navigate("/inventory"))
      .catch(error => console.error("Virhe lisättäessä tuotetta:", error));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Lisää uusi tuote</h1>

      <label>Tuotenimi:</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} />

      <label>Varastossa oleva määrä:</label>
      <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />

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