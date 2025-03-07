// ArchiveView.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue } from "./firebaseConfig";
import "./ArchiveView.css";

/*
  Tämä komponentti:
    - Lataa "archived-trips"
    - Näyttää hakukentän, jolla suodatetaan keikkoja
    - Näyttää listan keikoista, avattavalla "lisätiedot" -osiolla
*/
function ArchiveView() {
  const navigate = useNavigate();

  const [archivedTrips, setArchivedTrips] = useState([]);
  const [inventory, setInventory] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTripId, setExpandedTripId] = useState(null);

  // Ladataan arkistoidut keikat
  useEffect(() => {
    const archivedRef = ref(database, "archived-trips");
    onValue(archivedRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tripsArray = Object.entries(data).map(([id, trip]) => ({
          id,
          ...trip,
        }));
        setArchivedTrips(tripsArray);
      } else {
        setArchivedTrips([]);
      }
    });

    // Ladataan varasto (inventory)
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      setInventory(snapshot.val() || {}); // Jos tyhjä, asetetaan {} ettei tule virheitä
    });
  }, []);

  // Hakee tuotteen nimen varastosta
  const getProductName = (productId) => {
    return inventory[productId]?.name || "Tuntematon tuote";
  };

  // Suodatetut keikat
  const filteredTrips = archivedTrips.filter((trip) => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();

    let combined = `${trip.name || ""} ${trip.contact || ""} ${trip.status || ""} ${trip.startDate || ""} ${trip.endDate || ""}`;

    if (trip.items) {
      Object.keys(trip.items).forEach((productId) => {
        combined += ` ${getProductName(productId)} ${productId}`;
      });
    }
    if (trip.packedItems) {
      Object.entries(trip.packedItems).forEach(([productId, pData]) => {
        combined += ` ${getProductName(productId)} ${productId} `;
        if (pData.serials) {
          combined += ` ${Object.keys(pData.serials).join(" ")} `;
        }
      });
    }
    return combined.toLowerCase().includes(lowerQuery);
  });

  // Apufunktio muotoilee päivämäärän
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("fi-FI");
  };

  return (
    <div className="archive-container">
      {/* Yläpalkki */}
      <div className="archive-topbar">
        <button onClick={() => navigate("/")}>Koti</button>
        <input
          type="text"
          placeholder="Hae arkistosta..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Arkistoidut keikat */}
      <div className="archive-content">
        {filteredTrips.length === 0 ? (
          <p>Ei osumia hakusanalla.</p>
        ) : (
          filteredTrips.map((trip) => {
            const start = formatDate(trip.startDate);
            const end = formatDate(trip.endDate);

            return (
              <div key={trip.id} className="archive-trip">
                <div className="archive-trip-header">
                  <h2>{trip.name || "Nimetön keikka"}</h2>
                  <small>{start} - {end} {trip.status ? ` (${trip.status})` : ""}</small>
                  <button onClick={() => setExpandedTripId(expandedTripId === trip.id ? null : trip.id)}>
                    {expandedTripId === trip.id ? "Piilota tiedot" : "Näytä tiedot"}
                  </button>
                </div>

                {expandedTripId === trip.id && (
                  <div className="archive-trip-details">
                    {trip.contact && <p><b>Yhteyshenkilö:</b> {trip.contact}</p>}
                    {trip.returned && <p><b>Palautettu:</b> {String(trip.returned)}</p>}

                    {/* ITEMS (Mitä piti olla) */}
                    <h4>Items (mitä piti olla):</h4>
                    {trip.items ? (
                      <ul>
                        {Object.entries(trip.items).map(([itemId, itemData]) => (
                          <li key={itemId}>
                            {itemData.quantity} x {getProductName(itemId)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Ei items-tietoja.</p>
                    )}

                    {/* PAKATUT TUOTTEET */}
                    <h4>Pakatut tuotteet (packedItems):</h4>
                    {trip.packedItems ? (
                      <ul>
                        {Object.entries(trip.packedItems).map(([pId, pData]) => (
                          <li key={pId} style={{ marginBottom: "8px" }}>
                            <strong>{pData.quantity} x {getProductName(pId)}</strong>
                            {/* Jos on sarjanumerollinen */}
                            {pData.isSerial && pData.serials && (
                              <ul style={{ marginLeft: "20px" }}>
                                {Object.keys(pData.serials).map((serial) => (
                                  <li key={serial}>{serial}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Ei packedItems-tietoja.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ArchiveView;
