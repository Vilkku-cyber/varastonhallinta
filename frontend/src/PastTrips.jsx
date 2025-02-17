import React from 'react';
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function PastTrips() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:5000/api/trips")
      .then(response => {
        const pastTrips = response.data.filter(trip => trip.status === "returned");
        setTrips(pastTrips);
      })
      .catch(error => console.error("Virhe haettaessa menneitä keikkoja:", error));
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
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => navigate("/")}>🏠 Takaisin etusivulle</button>
    </div>
  );
}

export default PastTrips;
