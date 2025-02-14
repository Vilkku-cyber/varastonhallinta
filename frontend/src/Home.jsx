import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  
  // Haetaan keikat backendistä
  const fetchTrips = () => {
    axios.get("http://localhost:5000/api/trips")
      .then(response => {
        console.log("Haetut keikat:", response.data);
        setTrips(response.data);
      })
      .catch(error => console.error("Virhe haettaessa keikkoja:", error));
  };

  useEffect(() => {
    fetchTrips(); // Haetaan keikat aina kun sivu ladataan
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Varastonhallinnan etusivu</h1>

      <h2>Aktiiviset keikat</h2>
      {trips.length === 0 ? (
        <p>Ei aktiivisia keikkoja</p>
      ) : (
        <ul>
          {trips.filter(trip => trip.status !== "returned").map(trip => (
            <li key={trip.id}>
              <strong onClick={() => navigate(`/edit-trip/${trip.id}`)} style={{ cursor: "pointer", color: "blue" }}>
                {trip.name} ({trip.date})
              </strong>
              <ul>
                {trip.items.length > 0 ? (
                  trip.items.map((item, index) => (
                    <li key={index}>{item.quantity}x {item.name}</li>
                  ))
                ) : (
                  <li>Ei tuotteita lisätty</li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => navigate("/inventory")}>Selaa varastoa</button>
      <button onClick={() => navigate("/create-trip")}>+ Uusi keikka</button>
      <button onClick={() => navigate("/past-trips")} style={{ marginLeft: "10px", backgroundColor: "#888", color: "white" }}>
        Menneet keikat
      </button>
    </div>
  );
}

export default Home;
