import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { database, ref, get, update, onValue } from "./firebaseConfig"; // Firebase-yhteys

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [available, setAvailable] = useState(0);
  const [reserved, setReserved] = useState(0);
  const [dimensions, setDimensions] = useState("");
  const [weight, setWeight] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  // 🔹 Haetaan tuotteen tiedot Firebasesta
  useEffect(() => {
    const productRef = ref(database, `inventory/${id}`);
    get(productRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setProduct(data);
        setAvailable(data.available || 0);
        setDimensions(data.dimensions || "");
        setWeight(data.weight || "");
        setAdditionalInfo(data.additionalInfo || "");
      }
    });

    // 🔹 Lasketaan keikalla olevat tuotteet
    const tripsRef = ref(database, "keikat");
    onValue(tripsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let reservedCount = 0;
        Object.values(data).forEach((trip) => {
          if (trip.items) {
            Object.values(trip.items).forEach((item) => {
              if (item.id === id) {
                reservedCount += item.quantity;
              }
            });
          }
        });
        setReserved(reservedCount);
      }
    });
  }, [id]);

  // 🔹 Päivitetään tuotetiedot Firebaseen
  const saveProduct = () => {
    const productRef = ref(database, `inventory/${id}`);
    update(productRef, {
      available,
      dimensions,
      weight,
      additionalInfo,
    })
      .then(() => {
        alert("Tuotetiedot päivitetty!");
        navigate("/");
      })
      .catch((error) => console.error("Virhe tallennettaessa tuotetietoja:", error));
  };

  if (!product) return <p>Ladataan...</p>;

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>{product.name}</h1>
      <p><strong>Varastossa:</strong> <input type="number" value={available} onChange={(e) => setAvailable(Number(e.target.value))} /></p>
      <p><strong>Keikalla:</strong> {reserved}</p>

      <h2>Muokkaa tuotetietoja</h2>
      <label>Mitat:</label>
      <input type="text" value={dimensions} onChange={(e) => setDimensions(e.target.value)} />

      <label>Paino:</label>
      <input type="text" value={weight} onChange={(e) => setWeight(e.target.value)} />

      <label>Lisätiedot:</label>
      <textarea value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} />

      <br />
      <button onClick={() => navigate("/Inventory")}>Palaa</button>
      <button onClick={saveProduct}>Tallenna</button>
    </div>
  );
}

export default ProductDetails;
