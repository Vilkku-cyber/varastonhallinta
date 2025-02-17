import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { database, ref, get, update, remove } from "./firebaseConfig"; // Firebase-yhteys

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [dimensions, setDimensions] = useState("");
  const [weight, setWeight] = useState("");
  const [details, setDetails] = useState("");

  // 🔹 Haetaan tuotetiedot Firebase-tietokannasta
  useEffect(() => {
    const productRef = ref(database, `inventory/${id}`);

    get(productRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setProduct(data);
          setDimensions(data.dimensions || "");
          setWeight(data.weight || "");
          setDetails(data.details || "");
        } else {
          console.error("Tuotetta ei löytynyt!");
          navigate("/inventory");
        }
      })
      .catch((error) => console.error("Virhe haettaessa tuotetietoja:", error));
  }, [id, navigate]);

  // 🔹 Päivitä tuotetiedot Firebaseen
  const saveChanges = () => {
    const productRef = ref(database, `inventory/${id}`);

    update(productRef, {
      dimensions,
      weight,
      details,
    })
      .then(() => alert("Tuotetiedot päivitetty!"))
      .catch((error) => console.error("Virhe päivitettäessä tuotetietoja:", error));
  };

  // 🔹 Poista tuote Firebasesta
  const deleteProduct = () => {
    if (window.confirm("Haluatko varmasti poistaa tämän tuotteen?")) {
      const productRef = ref(database, `inventory/${id}`);
      
      remove(productRef)
        .then(() => {
          alert("Tuote poistettu!");
          navigate("/inventory"); // Palataan varastosivulle poiston jälkeen
        })
        .catch((error) => console.error("Virhe poistettaessa tuotetta:", error));
    }
  };

  if (!product) return <p>Ladataan tuotetietoja...</p>;

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>{product.name}</h1>
      <p><strong>Varastossa:</strong> {product.available !== null ? product.available : "Ei tietoa"}</p>
      <p><strong>Keikalla:</strong> {product.reserved !== null ? product.reserved : "Ei tietoa"}</p>

      <h2>Muokkaa tuotetietoja</h2>

      <label>Mitat:</label>
      <input type="text" value={dimensions} onChange={(e) => setDimensions(e.target.value)} />

      <label>Paino:</label>
      <input type="text" value={weight} onChange={(e) => setWeight(e.target.value)} />

      <label>Lisätiedot:</label>
      <textarea value={details} onChange={(e) => setDetails(e.target.value)} />

      <br />
      <button onClick={() => navigate("/inventory")}>Palaa</button>
      <button onClick={saveChanges}>Tallenna</button>
      <button onClick={deleteProduct} style={{ marginLeft: "10px", backgroundColor: "red", color: "white" }}>
        Poista tuote
      </button>
    </div>
  );
}

export default ProductDetails;
