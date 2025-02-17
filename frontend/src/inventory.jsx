import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue } from "./firebaseConfig"; // Firebase-yhteys

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const navigate = useNavigate();

  // 🔹 Haetaan varastotiedot Firebase-tietokannasta
  useEffect(() => {
    const inventoryRef = ref(database, "inventory");

    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const inventoryList = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
        setInventory(inventoryList);
      } else {
        setInventory([]);
      }
    });
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Varasto</h1>
      <button onClick={() => navigate("/")} style={{ marginBottom: "10px" }}>
        🏠 Koti
      </button>
      <button onClick={() => navigate("/add-product")} style={{ marginBottom: "20px" }}>
        + Lisää tuote
      </button>

      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>Tuote</th>
            <th>Varastossa</th>
            <th>Keikalla</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`/product/${item.id}`} style={{ textDecoration: "none" }}>
                  {item.name}
                </a>
              </td>
              <td>{item.available}</td>
              <td style={{ color: "red" }}>{item.reserved || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Inventory;
