import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebaseConfig";
import Home from "./Home";
import Inventory from "./Inventory";

import QRCodeReader from "./QRCodeReader"; // Add this line
/*import ProductDetails from "./ProductDetails";*/
import EditTrip from "./EditTrip";
import PastTrips from "./PastTrips";
import CreateTrip from "./CreateTrip";

import PackingView from "./Pakkaus";
import Login from "./Login";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
        
        <Route path="/inventory" element={<Inventory />} />
    
        <Route path="/qr-reader" element={<QRCodeReader />} />
        {/*<Route path="/product/:id" element={<ProductDetails />} />*/}
        <Route path="/edit-trip/:id" element={<EditTrip />} />
        <Route path="/past-trips" element={<PastTrips />} />
        <Route path="/create-trip" element={<CreateTrip />} />
        <Route path="/pakkaus" element={<PackingView />} /> {/* Tämä korjattu */}
      </Routes>
    </Router>
  );
}

export default App;
