import React, { useState, useEffect } from "react";
import { database, ref, onValue, update } from "/src/firebaseConfig.js";
import { useNavigate } from "react-router-dom";
import './Pakkaus.css';

const PackingView = () => {
  const navigate = useNavigate(); // Initialize the navigate function
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [packedItems, setPackedItems] = useState([]);
  const [tripItems, setTripItems] = useState([]);
  const [inventory, setInventory] = useState({});
  const [serialNumber, setSerialNumber] = useState("");
  const [packedItemsState, setPackedItemsState] = useState({
    manualItems: [],
    tvs: {}
  });
  const [saveStatus, setSaveStatus] = useState("");
  const [selectedItem, setSelectedItem] = useState(""); // New state for selected item

  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      const newInventory = {};
      Object.entries(data).forEach(([id, details]) => {
        newInventory[id] = details;
      });
      setInventory(newInventory);
      console.log("Inventory fetched:", newInventory); // Log inventory data
    });

    const fetchTrips = () => {
      const tripsRef = ref(database, "keikat");
      onValue(tripsRef, (snapshot) => {
        const data = snapshot.val();
        console.log("Haetut keikat Firebase-tietokannasta:", data); // DEBUG
        if (data) {
          const tripList = Object.entries(data).map(([id, value]) => ({
            id,
            name: value.name || "Nimetön keikka",
            items: value.items || {}
          }));
          setTrips(tripList);
          console.log("Muutettu keikkalista:", tripList); // DEBUG
        } else {
          setTrips([]); // Tyhjennä lista, jos dataa ei ole
        }
      });
    };

    fetchTrips();
  }, []);

  useEffect(() => {
    if (!selectedTrip) return;

    const packedRef = ref(database, `keikat/${selectedTrip.id}/packedItems`);
    onValue(packedRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPackedItemsState({
          manualItems: data.packedManualItems || [],
          tvs: data.packedTVs || {}
        });
        console.log("Packed items fetched for trip:", data); // Log packed items data
      } else {
        setPackedItemsState({
          manualItems: [],
          tvs: {}
        });
      }
    });
  }, [selectedTrip]);

  useEffect(() => {
    updateTripItems();
  }, [selectedTrip, packedItemsState, inventory]);

  const updateTripItems = () => {
    if (!selectedTrip) return;

    const newTripItems = selectedTrip.items ? Object.entries(selectedTrip.items).map(([id, item]) => {
      const manualItem = packedItemsState.manualItems.find(packedItem => packedItem.id === id);
      const tvCount = packedItemsState.tvs[inventory[id]?.name]?.size || 0;
      const packedQuantity = (manualItem?.quantity || 0) + tvCount;
      console.log(`Recalculating - Item ID: ${id}, Manual Quantity: ${manualItem?.quantity || 0}, TV Count: ${tvCount}, Packed Quantity: ${packedQuantity}`); // Log detailed item data
      return {
        id: id,
        ...item,
        name: inventory[id]?.name || "Tuntematon tuote",
        packedQuantity: packedQuantity
      };
    }) : [];

    setTripItems(newTripItems);
    console.log("Trip items recalculated:", newTripItems); // Log recalculated trip items data
  };

  const savePackingProgress = () => {
    if (!selectedTrip) return;

    console.log("Tallennus aloitetaan keikalle:", selectedTrip.id);
    setSaveStatus("Tallennetaan...");

    const tripRef = ref(database, `keikat/${selectedTrip.id}/packedItems`);
    update(tripRef, packedItemsState)
      .then(() => {
        console.log("Tallennus onnistui!");
        setSaveStatus("Tallennus onnistui!");
      })
      .catch((error) => {
        console.error("Virhe tallennuksessa:", error);
        setSaveStatus("Tallennus epäonnistui.");
      });
  };

  const handleSelectTrip = (event) => {
    const tripId = event.target.value;
    const trip = trips.find(t => t.id === tripId);
    setSelectedTrip(trip);
    console.log("Selected trip:", trip); // Log selected trip data
  };

  const calculateStatus = (item) => {
    const difference = item.quantity - item.packedQuantity;
    if (difference > 0) {
      return <span style={{ color: "red" }}>Puuttuu {difference}</span>;
    } else if (difference < 0) {
      return <span style={{ color: "green" }}>Liikaa {Math.abs(difference)}</span>;
    } else {
      return <span style={{ color: "green" }}>OK</span>;
    }
  };

  const handlePackItem = (item) => {
    if (!selectedTrip) return;

    setPackedItems((prev) => [...prev, item]);
    setPackedItemsState((prev) => {
      const newState = {
        ...prev,
        manualItems: [...prev.manualItems, { id: item.id, name: item.name, quantity: item.quantity }]
      };
      console.log("Packed items state updated (handlePackItem):", newState); // Log updated state
      return newState;
    });
    console.log("Item packed:", item); // Log packed item data
    updateTripItems();
  };

  useEffect(() => {
    // Check that this call does not cause unwanted side effects
    if (serialNumber) {
      console.log("Serial number updated:", serialNumber);
      // Do not perform any status updates related to product quantities or inventory here
    }
  }, [serialNumber]);

  const handleAddSerialNumber = async () => {
    console.log("Attempting to add item with serial number:", serialNumber);
    if (!serialNumber) return;

    let foundTV = null;
    Object.entries(inventory).forEach(([id, item]) => {
        if (item.units && Object.keys(item.units).includes(serialNumber)) {
            foundTV = { id, name: item.name };
        }
    });

    if (foundTV) {
        // Lisätään sarjanumero pakattuihin joka tapauksessa
        setPackedItemsState((prev) => {
            const updated = { ...prev.tvs };
            if (!updated[foundTV.name]) {
                updated[foundTV.name] = new Set();
            }
            updated[foundTV.name].add(serialNumber);
            const newState = { ...prev, tvs: updated };
            console.log("Packed items state updated (handleAddSerialNumber):", newState);
            return newState;
        });
        console.log("Serial number added to packedTVs:", serialNumber);

        // Päivitetään tripItems-laskenta, jotta pakattu määrä päivittyy heti UI:hin
        updateTripItems();
    } else {
        console.log("Sarjanumerolla ei löytynyt vastaavaa tuotetta varastosta.");
    }

    setSerialNumber(""); // Tyhjennä kenttä
};



  const handleAddItem = (item, serialNumber) => {
    if (serialNumber) {
      let foundTV = null;
      Object.entries(inventory).forEach(([id, item]) => {
        if (item.units && Object.keys(item.units).includes(serialNumber)) {
          foundTV = { id, name: item.name };
        }
      });

      if (foundTV) {
        setPackedItemsState((prev) => {
          const updated = { ...prev.tvs };
          if (!updated[foundTV.name]) {
            updated[foundTV.name] = new Set();
          }
          updated[foundTV.name].add(serialNumber);
          const newState = { ...prev, tvs: updated };
          console.log("Packed items state updated (handleAddItem - serialNumber):", newState); // Log updated state
          return newState;
        });
        console.log("Serial number added to packedTVs:", serialNumber); // Log serial number addition

        // Ensure updateTripItems is called after updating the state
        updateTripItems();
      }
    } else if (item) {
      handlePackItem(item);
      updateTripItems();
    }
  };

  const updatePackedQuantity = (id, delta) => {
    if (!id) {
      console.error("ID is undefined, cannot update quantity");
      return;
    }
    setPackedItemsState((prev) => {
      console.log("Previous state before update:", prev);  // Näyttää tilan ennen päivitystä
      const updatedItems = prev.manualItems.map(item => {
        if (item.id === id) {
          const newQuantity = item.quantity + delta;
          console.log(`New quantity for item ${id}: ${newQuantity}`);  // Näyttää uuden määrän päivityksen jälkeen
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
      const newState = { ...prev, manualItems: updatedItems };
      console.log("Packed items state updated (updatePackedQuantity):", newState); // Log updated state
      return newState;
    });

    setTripItems((prev) => prev.map(item => {
      if (item.id === id) {
        const newQuantity = item.packedQuantity + delta;
        return { ...item, packedQuantity: newQuantity };
      }
      return item;
    }));
    updateTripItems();
  };

  const removePackedItem = (name) => {
    setPackedItemsState((prev) => {
      const newState = {
        ...prev,
        manualItems: prev.manualItems.filter(item => item.name !== name)
      };
      console.log("Packed items state updated (removePackedItem):", newState); // Log updated state
      return newState;
    });
    setTripItems((prev) => prev.map(item => {
      if (item.name === name) {
        return { ...item, packedQuantity: 0 };
      }
      return item;
    }));
    console.log("Packed item removed:", name); // Log removed packed item
    updateTripItems();
  };

  const removeSerialNumber = (tvName, serialNumber) => {
    setPackedItemsState((prev) => {
      const updated = { ...prev.tvs };
      if (updated[tvName]) {
        updated[tvName].delete(serialNumber);
        if (updated[tvName].size === 0) {
          delete updated[tvName];
        }
      }
      const newState = { ...prev, tvs: updated };
      console.log("Packed items state updated (removeSerialNumber):", newState); // Log updated state
      return newState;
    });
    console.log("Serial number removed:", serialNumber); // Log removed serial number

    // Update packedManualItems to reflect the removal of the serial number
    const tvId = Object.keys(inventory).find(id => inventory[id].name === tvName);
    if (tvId) {
      setTripItems((prev) => prev.map(item => {
        if (item.id === tvId) {
          const newQuantity = item.packedQuantity - 1;
          return { ...item, packedQuantity: newQuantity };
        }
        return item;
      }));
    }
    updateTripItems();
  };

  const handleAddPackedItem = () => {
    const item = tripItems.find(i => i.id === selectedItem);
    if (item) {
      handlePackItem(item);
      updateTripItems();
    }
  };

  return (
    <div className="container">
      <button onClick={() => navigate("/")} className="home-button">🏠 Koti</button>
      {!selectedTrip ? (
        <div className="select-trip">
          <h2>Valitse keikka pakattavaksi</h2>
          <select onChange={handleSelectTrip} defaultValue="">
            <option value="" disabled>Valitse keikka</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="trip-details-container">
          <div className="trip-details">
            <div>
              <h3>{selectedTrip.name}</h3>
              <button onClick={() => setSelectedTrip(null)} className="back-button">← Takaisin</button>
              <button onClick={savePackingProgress} className="save-button">Tallenna pakkaustilanne</button>
              <p>{saveStatus}</p>
              {tripItems.length > 0 ? (
                <div>
                  {tripItems.map((item) => (
                    <div key={item.id} className="trip-item">
                      <p>{item.quantity}x {item.name} {calculateStatus(item)}</p>
                      <button onClick={() => handlePackItem(item)} className="pack-button">Merkitse kaikki pakatuiksi</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Ei tuotteita lisätty</p>
              )}
            </div>
          </div>

          <div className="packed-items">
            <h3>Pakatut tuotteet</h3>
            {Object.keys(packedItemsState.tvs).length > 0 && (
              Object.entries(packedItemsState.tvs).map(([tvName, serials]) => {
                const tvId = Object.keys(inventory).find(id => inventory[id].name === tvName);
                return (
                  <div key={tvName}>
                    <h4>{serials.size}x {tvName}</h4>
                    
                    {[...serials].map((sn, index) => (
                      <div key={index} className="serial-and-remove">
                        <p className="serial-number">{sn}</p>
                        <button onClick={() => removeSerialNumber(tvName, sn)} className="remove-button">Poista</button>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
            {packedItemsState.manualItems.length > 0 && (
              <div>
                {packedItemsState.manualItems.map((item) => (
                  <div key={item.id} className="packed-item">
                    <p>{item.quantity}x {item.name}</p>
                    <button onClick={() => updatePackedQuantity(item.id, -1)} className="quantity-button">-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updatePackedQuantity(item.id, 1)} className="quantity-button">+</button>
                    <button onClick={() => removePackedItem(item.name)} className="remove-button">Poista</button>
                  </div>
                ))}
              </div>
            )}
            {Object.keys(packedItemsState.tvs).length === 0 && packedItemsState.manualItems.length === 0 && <p>Ei vielä pakattuja tuotteita</p>}
            <div>
              <h4>Lisää tuote pakattuihin</h4>
              <select onChange={(e) => setSelectedItem(e.target.value)} defaultValue="" className="item-select">
                <option value="" disabled>Valitse tuote</option>
                {tripItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <button onClick={handleAddPackedItem} className="add-item-button">Lisää pakattuihin</button>
            </div>
            <div>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Syötä sarjanumero"
                className="serial-input"
              />
              <button onClick={handleAddSerialNumber} className="add-tv-button">Lisää TV</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackingView;
