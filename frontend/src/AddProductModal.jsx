import React, { useState, useEffect } from "react";
import { database, ref, push, onValue } from "./firebaseConfig"; // Firebase-yhteys
import Modal from "react-modal";
import styles from "./productModal.module.css"; // 🔹 Vaihdettu oikeaan tyylitiedostoon

Modal.setAppElement("#root");

function AddProductModal({ isOpen, onClose }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [weight, setWeight] = useState("");
  const [details, setDetails] = useState("");
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      const uniqueCategories = new Set();
      snapshot.forEach(childSnapshot => {
        const category = childSnapshot.val().category;
        if (category) {
          uniqueCategories.add(category);
        }
      });
      setCategories(Array.from(uniqueCategories));
    });
  }, []);

  const addProduct = () => {
    if (!name.trim() || quantity <= 0) return;

    const inventoryRef = ref(database, "inventory");
    push(inventoryRef, {
      name,
      available: quantity,
      reserved: 0,
      category,
      dimensions,
      weight,
      details,
    }).then(() => {
      onClose();
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Lisää uusi tuote"
      className={styles.modalContent} // 🔹 Sama tyyli kuin tuotetietomodaalilla
      overlayClassName={styles.modalOverlay} // 🔹 Sama taustatyylin overlay
    >
      
      <h1>Lisää uusi tuote</h1>

      <div className={styles.formContainer}>
        <div className={styles.formGroup}>
          <label>Tuotenimi:</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className={styles.formGroup}>
          <label>Varastossa oleva määrä:</label>
          <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" />
        </div>

        <div className={styles.formGroup}>
          <label>Kategoria:</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map((cat, index) => (
              <option key={index} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Mitat:</label>
          <input type="text" value={dimensions} onChange={e => setDimensions(e.target.value)} />
        </div>

        <div className={styles.formGroup}>
          <label>Paino:</label>
          <input type="text" value={weight} onChange={e => setWeight(e.target.value)} />
        </div>

        <div className={styles.formGroup}>
          <label>Lisätiedot:</label>
          <textarea value={details} onChange={e => setDetails(e.target.value)} />
        </div>
      </div>

      <div className={styles.buttonContainer}>
        <button className={styles.cancelButton} onClick={onClose}>Palaa</button>
        <button className={styles.saveButton} onClick={addProduct}>Tallenna</button>
      </div>
    </Modal>
  );
}

export default AddProductModal;
