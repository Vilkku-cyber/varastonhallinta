import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue } from "./firebaseConfig";
import styles from './main.module.css';
import CreateTripModal from "./CreateTripModal";
import EditTripModal from "./EditTripModal"; // Import EditTripModal

function Home() {
  const navigate = useNavigate();
  const [keikat, setKeikat] = useState([]);
  const [inventory, setInventory] = useState({});
  const [isCreateTripModalOpen, setIsCreateTripModalOpen] = useState(false);
  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState(false); // State for EditTripModal
  const [selectedTripId, setSelectedTripId] = useState(null); // State for selected trip ID

  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInventory(data);
      }
    });
  }, []);

  useEffect(() => {
    const keikatRef = ref(database, "keikat");
    onValue(keikatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const keikkaLista = Object.entries(data)
          .map(([id, value]) => ({
            id,
            name: value.name || "Nimetön keikka",
            startDate: value.startDate ? new Date(value.startDate) : null,
            endDate: value.endDate ? new Date(value.endDate) : null,
            status: value.status || "pakkaamatta",
            items: value.items || [],
          }))
          .sort((a, b) => (a.startDate && b.startDate ? a.startDate - b.startDate : 0));

        setKeikat(keikkaLista);
      } else {
        setKeikat([]);
      }
    });
  }, []);

  const handleSelectTrip = (id) => {
    console.log("Selected Trip ID:", id);
    setSelectedTripId(id);
    setIsEditTripModalOpen(true);
  };

  const getStatusColorClass = (status) => {
    switch (status) {
      case "pakkaamatta":
        return styles.statusBlue;
      case "pakattu":
        return styles.statusGreen;
      case "keikalla":
        return styles.statusYellow;
      case "purkamatta":
        return styles.statusRed;
      default:
        return styles.statusBlack;
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Varastonhallinnan etusivu</h1>

      <div className={styles.navigation}>
        <button className={styles.button} onClick={() => navigate("/inventory")}>Selaa varastoa</button>
        <button className={styles.button} onClick={() => setIsCreateTripModalOpen(true)}>+ Uusi keikka</button>
        <button className={styles.button} onClick={() => navigate("/past-trips")}>Arkisto</button>
        <button className={styles.button} onClick={() => navigate("/pakkaus")}>Pakkaus</button>
      </div>

      <h2>Aktiiviset keikat</h2>
      {keikat.length === 0 ? (
        <p>Ei aktiivisia keikkoja</p>
      ) : (
        <ul className={styles.List}>
          {keikat.map((keikka) => {
            const startDateString = keikka.startDate
              ? keikka.startDate.toLocaleDateString("fi-FI")
              : "Ei aloituspäivää";
            const endDateString = keikka.endDate
              ? keikka.endDate.toLocaleDateString("fi-FI")
              : "Ei päättymispäivää";

            return (
              <li key={keikka.id} className={styles.keikka}>
                <strong
                  onClick={() => handleSelectTrip(keikka.id)}
                  className={styles.keikkaHeader}
                >
                  {keikka.name}
                </strong>
                <div className={styles.dates}>Päivämäärät: {startDateString} - {endDateString}</div>
                <div className={`${styles.status} ${getStatusColorClass(keikka.status)}`}>
                  Status: {keikka.status}
                </div>

                {keikka.items && Object.keys(keikka.items).length > 0 ? (
                  <ul className={styles.itemsList}>
                    {Object.entries(keikka.items).map(([itemId, itemData]) => {
                      const productName = inventory[itemData.id]?.name || "Tuntematon tuote";
                      return (
                        <li key={itemId} className={styles.item}>
                          <span className={styles.itemQuantity}>{itemData.quantity}x</span> <span className={styles.itemName}>{productName}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>Ei tuotteita lisätty</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <CreateTripModal
        isOpen={isCreateTripModalOpen}
        onRequestClose={() => setIsCreateTripModalOpen(false)}
      />

      <EditTripModal
        isOpen={isEditTripModalOpen}
        onRequestClose={() => setIsEditTripModalOpen(false)}
        tripId={selectedTripId} // Pass the selected trip ID to the modal
      />
    </div>
  );
}

export default Home;
