import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue } from "./firebaseConfig"; // Firebase-yhteys

function PastTrips() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);

  // 🔹 Haetaan menneet keikat Firebasesta (nyt `archived-trips`)
  useEffect(() => {
    const tripsRef = ref(database, "archived-trips");

    onValue(tripsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const pastTrips = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
        setTrips(pastTrips);
      } else {
        setTrips([]);
      }
    });
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Menneet keikat</h1>
      
      {trips.length === 0 ? (
        <p>Ei menneitä keikkoja</p>
      ) : (
        <ul>
          {trips.map(trip => (
            <li key={trip.id}>
              <strong>{trip.name} ({trip.date})</strong>
              {trip.items && Object.keys(trip.items).length > 0 ? (
                <ul>
                  {Object.entries(trip.items).map(([itemId, itemData]) => (
                    <li key={itemId}>
                      {itemData.quantity}x {itemData.name || "Tuntematon tuote"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Ei tuotteita</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => navigate("/")}>🏠 Takaisin etusivulle</button>
    </div>
  );
}

export default PastTrips;
