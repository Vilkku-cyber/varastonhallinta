import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue } from "./firebaseConfig"; // Firebase-yhteys

function Home() {
  const navigate = useNavigate();
  const [keikat, setKeikat] = useState([]);
  const [inventory, setInventory] = useState({}); // 🔹 Haetaan varaston tuotteet

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

  // 🔹 Haetaan keikat Firebasesta
  useEffect(() => {
    const keikatRef = ref(database, "keikat");

    onValue(keikatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const keikkaLista = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
        setKeikat(keikkaLista);
      } else {
        setKeikat([]);
      }
    });
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Varastonhallinnan etusivu</h1>

      <h2>Aktiiviset keikat</h2>
      {keikat.length === 0 ? (
        <p>Ei aktiivisia keikkoja</p>
      ) : (
        <ul>
          {keikat.map((keikka) => (
            <li key={keikka.id}>
              <strong
                onClick={() => navigate(`/edit-trip/${keikka.id}`)}
                style={{ cursor: "pointer", color: "blue" }}
              >
                {keikka.nimi} ({keikka.aika})
              </strong>
              {/* 🔹 Näytetään keikan tuotteet ja haetaan nimet varastosta */}
              {keikka.items && Object.keys(keikka.items).length > 0 ? (
                <ul>
                  {Object.entries(keikka.items).map(([itemId, itemData]) => {
                    const productName = inventory[itemId]?.name || "Tuntematon tuote";
                    return (
                      <li key={itemId}>
                        {itemData.quantity}x {productName}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>Ei tuotteita lisätty</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => navigate("/inventory")}>Selaa varastoa</button>
      <button onClick={() => navigate("/create-trip")}>+ Uusi keikka</button>
      <button
        onClick={() => navigate("/past-trips")}
        style={{ marginLeft: "10px", backgroundColor: "#888", color: "white" }}
      >
        Menneet keikat
      </button>
    </div>
  );
}

export default Home;
