import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue } from "./firebaseConfig"; // Firebase-yhteys
import Modal from "react-modal";
import ProductDetails from "./ProductDetails"; // Import the ProductDetails component
import styles from "./inventory.module.css"; // Import the CSS module

Modal.setAppElement("#root"); // Set the root element for accessibility

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [reservedCounts, setReservedCounts] = useState({}); // 🔹 Keikoilla olevat määrät
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const inventoryList = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
        setInventory(inventoryList);
      } else {
        setInventory([]);
      }
    });

    const tripsRef = ref(database, "keikat");
    onValue(tripsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tempReservedCounts = {};
        Object.values(data).forEach((trip) => {
          if (trip.items) {
            Object.values(trip.items).forEach((item) => {
              if (!tempReservedCounts[item.id]) {
                tempReservedCounts[item.id] = 0;
              }
              tempReservedCounts[item.id] += item.quantity;
            });
          }
        });
        setReservedCounts(tempReservedCounts);
      } else {
        setReservedCounts({});
      }
    });
  }, []);

  const categorizedInventory = inventory.reduce((acc, item) => {
    const category = item.category || "Muu";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const openModal = (product) => {
    setSelectedProduct(product);
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedProduct(null);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Varasto</h1>
      <div className={styles.navigation}>
        <button className={styles.buttonBlue} onClick={() => navigate("/")}>🏠 Koti</button>
        <button className={styles.buttonBlue} onClick={() => navigate("/add-product")}>+ Lisää tuote</button>
      </div>
      <div className={styles.scrollableContainer}>
        {Object.keys(categorizedInventory)
          .sort((a, b) => (a === "Muu" ? 1 : b === "Muu" ? -1 : 0))
          .map((category) => (
            <div key={category} className={styles.card}>
              <h2>{category}</h2>
              <table className={styles.tableContainer}>
                <thead>
                  <tr>
                    <th>Tuote</th>
                    <th>Varastossa</th>
                    <th>Keikalla</th>
                  </tr>
                </thead>
                <tbody>
                  {categorizedInventory[category].map((item) => {
                    const reserved = reservedCounts[item.id] || 0;
                    return (
                      <tr key={item.id}>
                        <td>
                          <a
                            href="#"
                            onClick={() => openModal(item)}
                            style={{ textDecoration: "none" }}
                          >
                            {item.name}
                          </a>
                        </td>
                        <td>{item.available - reserved}</td>
                        <td style={{ color: "red" }}>{reserved}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </div>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Product Details"
        className={styles.modal}
        overlayClassName={styles.overlay}
      >
        {selectedProduct && (
          <ProductDetails product={selectedProduct} reservedCounts={reservedCounts} closeModal={closeModal} />
        )}
      </Modal>
    </div>
  );
}

export default Inventory;
