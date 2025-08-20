import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebaseConfig";
import Home from "./Home";
import Inventory from "./Inventory";
import QRCodeReader from "./QRCodeReader";
import EditTrip from "./EditTrip";
import PastTrips from "./PastTrips";
import CreateTrip from "./CreateTrip";
import PackingView from "./Pakkaus";
import Login from "./Login";
import ShelfAdmin from "./ShelfAdmin";
import ShelfMap from "./ShelfMap";
import ShelfSearch from "./ShelfSearch";
import VisualShelfView from "./VisualShelfView";
import ToDo from "./ToDo";
import LedPlanner from "./LedPlanner.jsx";
import Calendar from "./Calendar";

import ProtectedRoute from "./ProtectedRoute";
import PrintPackingList from "./helpers/PrintPackingList";



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
        {/* Julkinen reitti */}
        <Route path="/login" element={<Login />} />

        {/* Suojatut reitit */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kalenteri"
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/qr-reader"
          element={
            <ProtectedRoute>
              <QRCodeReader />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-trip/:id"
          element={
            <ProtectedRoute>
              <EditTrip />
            </ProtectedRoute>
          }
        />
        <Route
          path="/past-trips"
          element={
            <ProtectedRoute>
              <PastTrips />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-trip"
          element={
            <ProtectedRoute>
              <CreateTrip />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pakkaus"
          element={
            <ProtectedRoute>
              <PackingView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shelf-admin"
          element={
            <ProtectedRoute>
              <ShelfAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shelf-map"
          element={
            <ProtectedRoute>
              <ShelfMap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/haku"
          element={
            <ProtectedRoute>
              <ShelfSearch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shelf/:shelfId"
          element={
            <ProtectedRoute>
              <VisualShelfView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/todo"
          element={
            <ProtectedRoute>
              <ToDo />
            </ProtectedRoute>
          }
        />
       


        <Route
          path="/led-planner"
          element={
            <ProtectedRoute>
              <LedPlanner />
            </ProtectedRoute>
          }
          
        />

<Route
  path="/print-packing-list/:tripId"
  element={
    <ProtectedRoute>
      <PrintPackingList />
    </ProtectedRoute>
  }
/>


        {/* Turvaverkko: tuntematon reitti -> login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
