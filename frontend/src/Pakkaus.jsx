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
  const [packedTVs, setPackedTVs] = useState({});
  const [packedManualItems, setPackedManualItems] = useState([]);
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
        setPackedManualItems(data.packedManualItems || []);
        setPackedTVs(data.packedTVs || {});
      } else {
        setPackedManualItems([]);
        setPackedTVs({});
      }
    });
  }, [selectedTrip]);

  useEffect(() => {
    if (!selectedTrip) return;

    const newTripItems = selectedTrip.items ? Object.entries(selectedTrip.items).map(([id, item]) => ({
      id: id,  // Varmistetaan, että id on olemassa ja oikein
      ...item,
      name: inventory[id]?.name || "Tuntematon tuote",
      packedQuantity: packedManualItems.find(packedItem => packedItem.id === id)?.quantity || 0  // Alustetaan packedQuantity
    })) : [];

    setTripItems(newTripItems);
  }, [selectedTrip, packedManualItems, inventory]);

  const savePackingProgress = () => {
    if (!selectedTrip) return;

    console.log("Tallennus aloitetaan keikalle:", selectedTrip.id);
    setSaveStatus("Tallennetaan...");

    const tripRef = ref(database, `keikat/${selectedTrip.id}/packedItems`);
    update(tripRef, { packedManualItems, packedTVs })
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
    setTripItems((prev) => prev.map(i =>
      i.id === item.id ? { ...i, packedQuantity: i.quantity } : i
    ));
    setPackedManualItems((prev) => [...prev, { id: item.id, name: item.name, quantity: item.quantity }]);
  };

  const handleAddSerialNumber = () => {
    if (!serialNumber) return;

    let foundTV = null;
    Object.entries(inventory).forEach(([id, item]) => {
      if (item.units && Object.keys(item.units).includes(serialNumber)) {
        foundTV = { id, name: item.name };
      }
    });

    if (foundTV) {
      setPackedTVs((prev) => {
        const updated = { ...prev };
        if (!updated[foundTV.name]) {
          updated[foundTV.name] = new Set();
        }
        updated[foundTV.name].add(serialNumber);
        return { ...updated };
      });

      setTripItems((prev) => prev.map(i =>
        i.id === foundTV.id ? { ...i, packedQuantity: i.packedQuantity + 1 } : i
      ));

      setPackedManualItems((prev) => {
        const existingItem = prev.find(item => item.id === foundTV.id);
        if (existingItem) {
          return prev.map(item =>
            item.id === foundTV.id ? { ...item, quantity: 1 } : item
          );
        } else {
          return [...prev, { id: foundTV.id, name: foundTV.name, quantity: 1 }];
        }
      });
    }
    setSerialNumber("");
  };

  const updatePackedQuantity = (id, delta) => {
    if (!id) {
      console.error("ID is undefined, cannot update quantity");
      return;
    }
    setPackedManualItems((prev) => {
      console.log("Previous state before update:", prev);  // Näyttää tilan ennen päivitystä
      const updatedItems = prev.map(item => {
        if (item.id === id) {
          const newQuantity = item.quantity + delta;
          console.log(`New quantity for item ${id}: ${newQuantity}`);  // Näyttää uuden määrän päivityksen jälkeen
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
      console.log("Updated items after update:", updatedItems);  // Näyttää kaikki tuotteet päivityksen jälkeen
      return updatedItems;
    });

    setTripItems((prev) => prev.map(item => {
      if (item.id === id) {
        const newQuantity = item.packedQuantity + delta;
        return { ...item, packedQuantity: newQuantity };
      }
      return item;
    }));
  };

  const removePackedItem = (name) => {
    setPackedManualItems((prev) => prev.filter(item => item.name !== name));
    setTripItems((prev) => prev.map(item => {
      if (item.name === name) {
        return { ...item, packedQuantity: 0 };
      }
      return item;
    }));
  };

  const removeSerialNumber = (tvName, serialNumber) => {
    setPackedTVs((prev) => {
      const updated = { ...prev };
      if (updated[tvName]) {
        updated[tvName].delete(serialNumber);
        if (updated[tvName].size === 0) {
          delete updated[tvName];
        }
      }
      return { ...updated };
    });

    // Update packedManualItems to reflect the removal of the serial number
    const tvId = Object.keys(inventory).find(id => inventory[id].name === tvName);
    if (tvId) {
      setPackedManualItems((prev) => {
        const existingItem = prev.find(item => item.id === tvId);
        if (existingItem) {
          const newQuantity = existingItem.quantity - 1;
          if (newQuantity > 0) {
            return prev.map(item =>
              item.id === tvId ? { ...item, quantity: newQuantity } : item
            );
          } else {
            return prev.filter(item => item.id !== tvId);
          }
        }
        return prev;
      });

      setTripItems((prev) => prev.map(item => {
        if (item.id === tvId) {
          const newQuantity = item.packedQuantity - 1;
          return { ...item, packedQuantity: newQuantity };
        }
        return item;
      }));
    }
  };

  const handleAddPackedItem = () => {
    const item = tripItems.find(i => i.id === selectedItem);
    if (item) {
      handlePackItem(item);
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
          {Object.keys(packedTVs).length > 0 && (
            Object.entries(packedTVs).map(([tvName, serials]) => (
              <div key={tvName}>
                <h4>{serials.size}x {tvName}</h4>
                {[...serials].map((sn, index) => (
                  <div key={index} className="packed-item">
                    <p>{sn}</p>
                    <button onClick={() => removeSerialNumber(tvName, sn)} className="remove-button">Poista</button>
                  </div>
                ))}
              </div>
            ))
          )}
          {packedManualItems.length > 0 && (
            <div>
              {packedManualItems.map((item) => (
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
          {Object.keys(packedTVs).length === 0 && packedManualItems.length === 0 && <p>Ei vielä pakattuja tuotteita</p>}
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
          <div> <input
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