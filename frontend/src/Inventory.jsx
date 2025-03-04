import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue } from "./firebaseConfig"; // Firebase-yhteys
import Modal from "react-modal";
import ProductModal from "./ProductModal"; // Import the ProductModal component
import AddProductModal from "./AddProductModal"; // Import the AddProductModal component
import styles from "./inventory.module.css"; // Import the CSS module

// Debounce utility function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [reservedCounts, setReservedCounts] = useState({}); // 🔹 Keikoilla olevat määrät
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [addProductModalIsOpen, setAddProductModalIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // Add state for search term
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

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categorizedInventory = filteredInventory.reduce((acc, item) => {
    const category = item.category || "Muu";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const openModal = useCallback(debounce((product) => {
    setSelectedProduct(product);
    setModalIsOpen(true);
  }, 300), []);

  const openAddProductModal = useCallback(debounce(() => {
    setAddProductModalIsOpen(true);
  }, 300), []);

  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedProduct(null);
  };

  const closeAddProductModal = () => {
    setAddProductModalIsOpen(false);
  };

  const saveProduct = (product) => {
    // Implement the saveProduct function
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Varasto</h1>
      <div className={styles.navigation}>
        <button className={styles.buttonBlue} onClick={() => navigate("/")}>🏠 Koti</button>
        <button className={styles.buttonBlue} onClick={openAddProductModal}>+ Lisää tuote</button>
      </div>
      <input
        type="text"
        placeholder="Hae tuotteita..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={styles.searchBar} // Add a class for styling the search bar
      />
      <div className={styles.scrollableContainer}>
        {Object.keys(categorizedInventory)
          .sort((a, b) => (a === "Muu" ? 1 : b === "Muu" ? -1 : 0))
          .map((category) => (
            <div key={category} className={styles.card}>
              <h2  style={{ color: "black" }}>{category}</h2>
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
        contentLabel="Product Modal"
        className={styles.modal}
        overlayClassName={styles.overlay}
      >
        {selectedProduct && (
          <ProductModal
            isOpen={modalIsOpen}
            onClose={closeModal} // Ensure onClose is passed correctly
            product={selectedProduct}
            reservedCounts={reservedCounts}
            saveProduct={saveProduct} // Pass saveProduct function
          />
        )}
      </Modal>
      <AddProductModal
        isOpen={addProductModalIsOpen}
        onClose={closeAddProductModal}
      />
    </div>
  );
}

export default Inventory;
