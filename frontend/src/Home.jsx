import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue } from "./firebaseConfig";

function Home() {
  const navigate = useNavigate();
  const [keikat, setKeikat] = useState([]);
  const [inventory, setInventory] = useState({});

  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInventory(data);
      }
    });
  }, []);

  useEffect(() => {
    const keikatRef = ref(database, "keikat");
    onValue(keikatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const keikkaLista = Object.entries(data)
          .map(([id, value]) => ({
            id,
            name: value.name || "Nimetön keikka",
            startDate: value.startDate ? new Date(value.startDate) : null,
            endDate: value.endDate ? new Date(value.endDate) : null,
            status: value.status || "pakkaamatta",
            items: value.items || [],
          }))
          .sort((a, b) => (a.startDate && b.startDate ? a.startDate - b.startDate : 0));

        setKeikat(keikkaLista);
      } else {
        setKeikat([]);
      }
    });
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "pakkaamatta":
        return "blue";
      case "pakattu":
        return "green";
      case "keikalla":
        return "yellow";
      case "purkamatta":
        return "red";
      default:
        return "black";
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Varastonhallinnan etusivu</h1>

      <h2>Aktiiviset keikat</h2>
      {keikat.length === 0 ? (
        <p>Ei aktiivisia keikkoja</p>
      ) : (
        <ul>
          {keikat.map((keikka) => {
            const startDateString = keikka.startDate
              ? keikka.startDate.toLocaleDateString("fi-FI")
              : "Ei aloituspäivää";
            const endDateString = keikka.endDate
              ? keikka.endDate.toLocaleDateString("fi-FI")
              : "Ei päättymispäivää";

            return (
              <li key={keikka.id} style={{ marginBottom: "10px" }}>
                <strong
                  onClick={() => navigate(`/edit-trip/${keikka.id}`)}
                  style={{ cursor: "pointer", color: "blue" }}
                >
                  {keikka.name}
                </strong>
                <div>Päivämäärät: {startDateString} - {endDateString}</div>
                <div style={{ color: getStatusColor(keikka.status), fontWeight: "bold" }}>
                  Status: {keikka.status}
                </div>

                {keikka.items && Object.keys(keikka.items).length > 0 ? (
                  <ul>
                    {Object.entries(keikka.items).map(([itemId, itemData]) => {
                      const productName = inventory[itemData.id]?.name || "Tuntematon tuote";
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
            );
          })}
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
      <button onClick={() => navigate("/pakkaus")}>Pakkaus</button>

    </div>
  );
}

export default Home;
