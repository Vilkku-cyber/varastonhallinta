import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./Home";
import Inventory from "./Inventory";
import AddProduct from "./AddProduct";
import ProductDetails from "./ProductDetails";
import EditTrip from "./EditTrip";
import PastTrips from "./PastTrips";
import CreateTrip from "./CreateTrip";
import { database } from "./firebaseConfig";  // Firebase-yhteys

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/add-product" element={<AddProduct />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/edit-trip/:id" element={<EditTrip />} />
        <Route path="/past-trips" element={<PastTrips />} />
        <Route path="/create-trip" element={<CreateTrip />} />
      </Routes>
    </Router>
  );
}

export default App;
