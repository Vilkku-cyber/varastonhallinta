import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue, update } from "./firebaseConfig";
import "./Pakkaus.css";

function PackingView() {
  const navigate = useNavigate();

  const [allTrips, setAllTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");

  // Kaikki pakatut tuotteet: avain = productId
  const [packedItems, setPackedItems] = useState({});

  // Viivakoodin syöttökenttä
  const [barcodeInput, setBarcodeInput] = useState("");
  // Manuaalinen lisäys “nimi + quantity” -kentät
  const [manualProductName, setManualProductName] = useState("");
  const [manualQuantity, setManualQuantity] = useState(1);

  // Varasto
  const [inventory, setInventory] = useState({});

  useEffect(() => {
    const tripsRef = ref(database, "keikat");
    onValue(tripsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tripsArray = Object.entries(data).map(([id, obj]) => ({
          id,
          ...obj,
        }));
        setAllTrips(tripsArray);
      } else {
        setAllTrips([]);
      }
    });

    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      setInventory(data || {});
    });
  }, []);

  // Haetaan keikan packedItems
  useEffect(() => {
    if (!selectedTripId) {
      setPackedItems({});
      return;
    }
    const packedRef = ref(database, `keikat/${selectedTripId}/packedItems`);
    onValue(packedRef, (snapshot) => {
      const data = snapshot.val();
      setPackedItems(data || {});
    });
  }, [selectedTripId]);

  const selectedTrip = allTrips.find((t) => t.id === selectedTripId);

  // 1) Sarjanumeron skannaus
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    let foundProductId = null;
    let foundProductName = "";
    let isSerial = false;

    // Etsitään inventorysta productId, jolta löytyy barcodeInput
    Object.entries(inventory).forEach(([pid, product]) => {
      if (product.units) {
        if (Object.keys(product.units).includes(barcodeInput.trim())) {
          foundProductId = pid;
          foundProductName = product.name;
          isSerial = true;
        }
      }
    });

    if (!foundProductId) {
      alert("Sarjanumerolla " + barcodeInput + " ei löytynyt tuotetta varastosta!");
      setBarcodeInput("");
      return;
    }

    // Päivitetään packedItems
    setPackedItems((prev) => {
      const oldEntry = prev[foundProductId] || {
        name: foundProductName,
        quantity: 0,
        isSerial,
        serials: {},
      };

      // Lisätään serial
      const newSerials = { ...oldEntry.serials };
      if (!newSerials[barcodeInput.trim()]) {
        newSerials[barcodeInput.trim()] = { serial: barcodeInput.trim() };
      }

      return {
        ...prev,
        [foundProductId]: {
          ...oldEntry,
          serials: newSerials,
          isSerial: true,
          quantity: Object.keys(newSerials).length, // sarjojen määrä
        },
      };
    });

    setBarcodeInput("");
  };

  // 2) Manuaalinen lisäys non-serial
  const handleAddManualItem = () => {
    if (!manualProductName.trim() || manualQuantity <= 0) return;

    const productId = "manual-" + manualProductName;

    setPackedItems((prev) => {
      const oldEntry = prev[productId] || {
        name: manualProductName,
        quantity: 0,
        isSerial: false,
        serials: {},
      };
      return {
        ...prev,
        [productId]: {
          ...oldEntry,
          quantity: oldEntry.quantity + manualQuantity,
        },
      };
    });

    setManualProductName("");
    setManualQuantity(1);
  };

  // 3) Poista yksittäinen sarjanumero
  const removeSerial = (productId, serial) => {
    setPackedItems((prev) => {
      const item = prev[productId];
      if (!item) return prev;

      const newSerials = { ...item.serials };
      delete newSerials[serial];
      const newQty = Object.keys(newSerials).length;

      return {
        ...prev,
        [productId]: {
          ...item,
          serials: newSerials,
          quantity: newQty,
        },
      };
    });
  };

  // 4) Muuta non-serial -tuotteen määrää
  const adjustQuantity = (productId, delta) => {
    setPackedItems((prev) => {
      const item = prev[productId];
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return {
        ...prev,
        [productId]: { ...item, quantity: newQty },
      };
    });
  };

  // 5) Tallenna Firebaseen
  const handleSave = async () => {
    if (!selectedTripId) {
      alert("Valitse keikka ensin!");
      return;
    }
    try {
      await update(ref(database, `keikat/${selectedTripId}`), {
        packedItems,
      });
      alert("Pakatut tallennettu!");
    } catch (error) {
      alert("Virhe tallennuksessa: " + error);
    }
  };

  return (
    <div style={{ height: "100vh", margin: 0, padding: 0 }}>
      {/* Yläpalkki */}
      <div className="topBar">
        <button onClick={() => navigate("/")}>Koti</button>

        <select
          value={selectedTripId}
          onChange={(e) => setSelectedTripId(e.target.value)}
        >
          <option value="">Valitse keikka</option>
          {allTrips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.name || "Nimetön keikka"}
            </option>
          ))}
        </select>

        <button onClick={handleSave}>Tallenna pakatut</button>
      </div>

      {/* container flex */}
      <div className="container">
        {/* VASEN PANEELI */}
        <div className="leftPanel">
          <h3>Mitä pitäisi pakata</h3>
          {selectedTrip && selectedTrip.items ? (
            <ul>
              {Object.entries(selectedTrip.items).map(([itemKey, itemData]) => {
                const productId = itemData.id; // = inventory-avain
                const requiredCount = itemData.quantity;
                const productName = inventory[productId]?.name || "Tuntematon tuote";

                // Katsotaan, montako on jo pakattu
                let packedCount = packedItems[productId]?.quantity || 0;
                // Tarkistetaan käsin lisätyt (nimellä)
                Object.entries(packedItems).forEach(([manualId, packed]) => {
                  if (manualId.startsWith("manual-") && packed.name === productName) {
                    packedCount += packed.quantity;
                  }
                });

                const leftToPack = Math.max(0, requiredCount - packedCount);

                // Värikoodaus:
                // Jos leftToPack === 0 => vihreä, muuten punainen
                const leftColorClass = leftToPack === 0 ? "text-green" : "text-red";
                // Jos packedCount === requiredCount => "pakattu" vihreänä, muuten normaali
                const packedColorClass = (packedCount === requiredCount) ? "text-green" : "";

                return (
                  <li key={itemKey} className="itemRow">
                    {requiredCount} x {productName}
                    <small className="packingInfo">
                      {" (pakattu "}
                      <span className={packedColorClass}>
                        {packedCount}/{requiredCount}
                      </span>
                      , jäljellä <span className={leftColorClass}>{leftToPack}</span>)
                    </small>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>Keikalle ei ole määritelty tavaroita.</p>
          )}
        </div>

        {/* OIKEA PANEELI */}
        <div className="rightPanel">
          <h3>Skannaa sarjanumero</h3>
          <form onSubmit={handleBarcodeSubmit} style={{ marginBottom: "10px" }}>
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Syötä tai skannaa..."
            />
            <button type="submit">Lisää</button>
          </form>

          {/* Manuaalinen lisäys */}
          <h3>Lisää tuote ilman sarjanumeroa</h3>
          <div className="manual-add-container">
            <select
              value={manualProductName}
              onChange={(e) => setManualProductName(e.target.value)}
            >
              <option value="">Valitse tuote</option>
              {selectedTrip?.items &&
                Object.entries(selectedTrip.items).map(([itemId, itemData]) => {
                  const nameFromInventory =
                    inventory[itemData.id]?.name || "Tuntematon";
                  return (
                    <option key={itemId} value={nameFromInventory}>
                      {nameFromInventory}
                    </option>
                  );
                })}
            </select>

            <input
              type="number"
              min="1"
              value={manualQuantity}
              onChange={(e) => setManualQuantity(Number(e.target.value))}
            />
            <button onClick={handleAddManualItem}>Lisää</button>
          </div>

          {/* Pakatut tavarat */}
          <h3>Pakatut tavarat</h3>
          {Object.keys(packedItems).length === 0 ? (
            <p>Ei pakattuja tuotteita</p>
          ) : (
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {Object.entries(packedItems)
                .filter(([_, packed]) => packed.quantity > 0) // poistetaan 0-määräiset
                .map(([productId, packed]) => (
                  <li key={productId} className="packed-item">
                    {/* Tuotteen otsikko */}
                    <strong>
                      {packed.quantity} x {packed.name}
                    </strong>

                    {/* Non-serial tuotteille "+"/"-" napit samalla rivillä */}
                    {!packed.isSerial && (
                      <div className="packed-item-buttons">
                        <button onClick={() => adjustQuantity(productId, -1)}>-</button>
                        <button onClick={() => adjustQuantity(productId, +1)}>+</button>
                      </div>
                    )}

                    {/* Sarjanumerolliset tuotteet listana, mutta napit samalla rivillä */}
                    {packed.isSerial && (
                      <ul className="serial-list">
                        {Object.entries(packed.serials).map(([serial]) => (
                          <li key={serial} className="serial-item">
                            {serial}
                            <button onClick={() => removeSerial(productId, serial)}>Poista</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default PackingView;
