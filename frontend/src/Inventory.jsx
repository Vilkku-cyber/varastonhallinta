
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue } from "./firebaseConfig"; // Firebase-yhteys

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [reservedCounts, setReservedCounts] = useState({}); // 🔹 Keikoilla olevat määrät
  const navigate = useNavigate();

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

    const tripsRef = ref(database, "keikat");
    onValue(tripsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tempReservedCounts = {};
        Object.values(data).forEach((trip) => {
          if (trip.items) {
            Object.values(trip.items).forEach((item) => {
              if (!tempReservedCounts[item.id]) {
                tempReservedCounts[item.id] = 0;
              }
              tempReservedCounts[item.id] += item.quantity;
            });
          }
        });
        setReservedCounts(tempReservedCounts);
      } else {
        setReservedCounts({});
      }
    });
  }, []);

  const categorizedInventory = inventory.reduce((acc, item) => {
    const category = item.category || "Muu";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

 // ...existing code...

return (
  <div style={{ padding: "20px", fontFamily: "Arial" }}>
    <h1>Varasto</h1>
    <button onClick={() => navigate("/")} style={{ marginBottom: "10px" }}>🏠 Koti</button>
    <button onClick={() => navigate("/add-product")} style={{ marginBottom: "20px" }}>+ Lisää tuote</button>

    {Object.keys(categorizedInventory)
      .sort((a, b) => (a === "Muu" ? 1 : b === "Muu" ? -1 : 0))
      .map((category) => (
        <div key={category}>
          <h2>{category}</h2>
          <table border="1" cellPadding="5">
            <thead>
              <tr>
                <th>Tuote</th>
                <th>Varastossa</th>
                <th>Keikalla</th>
              </tr>
            </thead>
            <tbody>
              {categorizedInventory[category].map((item) => {
                const reserved = reservedCounts[item.id] || 0;
                return (
                  <tr key={item.id}>
                    <td><a href={`/product/${item.id}`} style={{ textDecoration: "none" }}>{item.name}</a></td>
                    <td>{item.available - reserved}</td>
                    <td style={{ color: "red" }}>{reserved}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
  </div>
);


}

export default Inventory;
