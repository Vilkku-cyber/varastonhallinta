import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, onValue } from "./firebaseConfig"; // Firebase-yhteys
import Modal from "react-modal";
import ProductModal from "./ProductModal"; // Import the ProductModal component
import AddProductModal from "./AddProductModal"; // Import the AddProductModal component
import styles from "./inventory.module.css"; // Import the CSS module
import Fuse from "fuse.js"; // Add Fuse.js import
import HighlightedText from "./helpers/HighlightedText";


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

function highlightMatch(text, search) {
  if (!search) return text;
  const regex = new RegExp(`(${search})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [reservedCounts, setReservedCounts] = useState({}); // 🔹 Keikoilla olevat määrät
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [addProductModalIsOpen, setAddProductModalIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // Add state for search term
  const navigate = useNavigate();

  useEffect(() => {
  const invRef = ref(database, "inventory");
  const offInv = onValue(invRef, (snap) => {
    const data = snap.val();
    const list = data
      ? Object.entries(data).map(([id, v]) => ({ id, ...v }))
      : [];
    setInventory(list);
  });

  const tripsRef = ref(database, "keikat");
  const offTrips = onValue(tripsRef, (snap) => {
    const trips = snap.val() || {};
    const counts = {};
    Object.values(trips).forEach((t) => {
      if (!t.items) return;
      Object.values(t.items).forEach(({ id, quantity }) => {
        counts[id] = (counts[id] || 0) + Number(quantity);
      });
    });
    setReservedCounts(counts);
  });

  return () => {
    offInv();
    offTrips();
  };
}, []);



  const fuse = new Fuse(inventory, {
    keys: [
      "name",
      "category",
      "details",
      "dimensions",
      "weight",
      {
        name: "unitsKey",
        getFn: (item) => Object.keys(item.units || {}) // serial numbers
      }
    ],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  let filteredInventory = [];

  if (searchTerm.trim()) {
    const results = fuse.search(searchTerm);
    filteredInventory = results.map(res => ({
      ...res.item,
      matchInfo: res.matches?.map(m => m.key) || [] // store match references
    }));

    // Tolerance search for numeric values (e.g., "2" finds "5")
    const searchNumber = parseFloat(searchTerm);
    if (!isNaN(searchNumber)) {
      const tolerance = 3;
      const extraMatches = inventory.filter(item => {
        const dim = parseFloat(item.dimensions);
        const wei = parseFloat(item.weight);
        return (!isNaN(dim) && Math.abs(dim - searchNumber) <= tolerance) ||
               (!isNaN(wei) && Math.abs(wei - searchNumber) <= tolerance);
      });

      const existingIds = new Set(filteredInventory.map(i => i.id));
      extraMatches.forEach(item => {
        if (!existingIds.has(item.id)) {
          filteredInventory.push({
            ...item,
            matchInfo: ["toleranssi (mitat/paino)"]
          });
        }
      });
    }
  } else {
    filteredInventory = inventory.map(item => ({ ...item, matchInfo: [] }));
  }

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
      <div className={styles.navigation}>
        <button className={styles.buttonBlue} onClick={() => navigate("/")}>🏠 Koti</button>
        <button className={styles.buttonBlue} onClick={openAddProductModal}>+ Lisää tuote</button>
        <input
        type="text"
        placeholder="Hae tuotteita..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={styles.searchBar} // Add a class for styling the search bar
      />
      </div>
      
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
                           <span>
  <HighlightedText text={item.name} query={searchTerm} />
</span>

                          </a>
                          {item.matchInfo && item.matchInfo.length > 0 && (
                            <div style={{ fontSize: "0.8em", color: "#555" }}>
                              <em>Osumia: {item.matchInfo.join(", ")}</em>
                            </div>
                          )}
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
