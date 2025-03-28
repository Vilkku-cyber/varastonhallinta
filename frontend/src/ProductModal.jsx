import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, get, update, onValue, remove } from "./firebaseConfig"; // Firebase-yhteys
import Modal from "react-modal"; // Import Modal
import styles from './productModal.module.css';

function ProductDetails({ product, reservedCounts, closeModal, saveProduct, isOpen, onClose }) {
  const navigate = useNavigate();
  const [name, setName] = useState(product.name || "");
  const [available, setAvailable] = useState(product.available || 0);
  const [reserved, setReserved] = useState(reservedCounts[product.id] || 0);
  const [category, setCategory] = useState(product.category || "Muu");
  const [dimensions, setDimensions] = useState(product.dimensions || "");
  const [weight, setWeight] = useState(product.weight || "");
  const [additionalInfo, setAdditionalInfo] = useState(product.additionalInfo || "");
  const [units, setUnits] = useState(product.units || {});
  const [newSerial, setNewSerial] = useState("");
  const [newDamage, setNewDamage] = useState("");
  const [editSerial, setEditSerial] = useState(null);
  const [editDamage, setEditDamage] = useState("");
  const [categories, setCategories] = useState([]); // Kategorioiden tila

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

  const saveProductDetails = () => { // Renamed function
    if (!category) {
      alert("Valitse kategoria ennen tallennusta!");
      return;
    }

    const productRef = ref(database, `inventory/${product.id}`);
    update(productRef, {
      name,
      available,
      category,
      dimensions,
      weight,
      additionalInfo,
      units,
    })
      .then(() => {
        alert("Tuotetiedot päivitetty!");
        onClose(); // Use onClose to close the modal
      })
      .catch((error) => console.error("Virhe tallennettaessa tuotetietoja:", error));
  };

  const deleteProduct = () => {
    if (window.confirm("Oletko varma, että haluat poistaa tuotteen? Tätä toimintoa ei voi peruuttaa.")) {
      const productRef = ref(database, `inventory/${product.id}`);
      remove(productRef)
        .then(() => {
          alert("Tuote poistettu!");
          onClose(); // Close the modal after deletion
        })
        .catch((error) => console.error("Virhe poistettaessa tuotetta:", error));
    }
  };

  const addUnit = () => {
    if (newSerial) {
      setUnits((prev) => ({
        ...prev,
        [newSerial]: { damage: newDamage || "Ei vaurioita" },
      }));
      setNewSerial("");
      setNewDamage("");
    }
  };

  const editUnit = (serial) => {
    setEditSerial(serial);
    setEditDamage(units[serial]?.damage || "");
  };

  const saveUnitEdit = () => {
    if (editSerial) {
      setUnits((prev) => ({
        ...prev,
        [editSerial]: { damage: editDamage },
      }));
      setEditSerial(null);
      setEditDamage("");
    }
  };

  const deleteUnit = (serial) => {
    const updatedUnits = { ...units };
    delete updatedUnits[serial];
    setUnits(updatedUnits);
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Muokkaa tuotetta"
      className={styles.modalContent} // 🔹 Sama tyyli kuin tuotetietomodaalilla
      overlayClassName={styles.modalOverlay} // 🔹 Sama taustatyylin overlay
    >
      <div style={{ padding: "20px", fontFamily: "Arial" }}>
        <h1>Muokkaa tuotetta</h1>

        <label>Nimi:</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />

        <p><strong>Varastossa:</strong> <input type="number" value={available} onChange={(e) => setAvailable(Number(e.target.value))} /></p>
        <p><strong>Keikalla:</strong> {reserved}</p>

        <label>Kategoria:</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((cat, index) => (
            <option key={index} value={cat}>{cat}</option>
          ))}
        </select>

        <h2 className={styles.header}>Tekniset tiedot</h2>
        <div className={styles.formGroup}>
          <label>Mitat:</label>
          <input type="text" value={dimensions} onChange={(e) => setDimensions(e.target.value)} />
        </div>
        <div className={styles.formGroup}>
          <label>Paino:</label>
          <input type="text" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div className={styles.formGroup}>
          <label>Lisätiedot:</label>
          <textarea value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} />
        </div>

        {category === "TV" && (
          <div>
            <h2 className={styles.header}>TV:n yksilöt</h2>
            <table border="1" cellPadding="5">
              <thead>
                <tr><th>Sarjanumero</th><th>Vaurio</th><th>Toiminnot</th></tr>
              </thead>
              <tbody>
                {Object.entries(units).map(([serial, info]) => (
                  <tr key={serial}>
                    <td>{serial}</td>
                    <td>
                      {editSerial === serial ? (
                        <input type="text" value={editDamage} onChange={(e) => setEditDamage(e.target.value)} />
                      ) : (
                        info.damage
                      )}
                    </td>
                    <td>
                      {editSerial === serial ? (
                        <button onClick={saveUnitEdit}>💾</button>
                      ) : (
                        <button onClick={() => editUnit(serial)}>✏️</button>
                      )}
                      <button onClick={() => deleteUnit(serial)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className={styles.header}>Lisää TV-yksilö</h3>
            <input type="text" placeholder="Sarjanumero" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} />
            <input type="text" placeholder="Vaurio" value={newDamage} onChange={(e) => setNewDamage(e.target.value)} />
            <button className={styles.saveButton} onClick={addUnit}>Lisää</button>
          </div>
        )}

{category === "VIDEO" && (
          <div>
            <h2 className={styles.header}>Yksilöt</h2>
            <table border="1" cellPadding="5">
              <thead>
                <tr><th>Sarjanumero</th><th>Vaurio</th><th>Toiminnot</th></tr>
              </thead>
              <tbody>
                {Object.entries(units).map(([serial, info]) => (
                  <tr key={serial}>
                    <td>{serial}</td>
                    <td>
                      {editSerial === serial ? (
                        <input type="text" value={editDamage} onChange={(e) => setEditDamage(e.target.value)} />
                      ) : (
                        info.damage
                      )}
                    </td>
                    <td>
                      {editSerial === serial ? (
                        <button onClick={saveUnitEdit}>💾</button>
                      ) : (
                        <button onClick={() => editUnit(serial)}>✏️</button>
                      )}
                      <button onClick={() => deleteUnit(serial)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className={styles.header}>Lisää Video-yksilö</h3>
            <input type="text" placeholder="Sarjanumero" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} />
            <input type="text" placeholder="Vaurio" value={newDamage} onChange={(e) => setNewDamage(e.target.value)} />
            
            <button className={styles.saveButton} onClick={addUnit}>Lisää</button>
          </div>
        )}

{category === "NETTI" && (
          <div>
            <h2 className={styles.header}>Yksilöt</h2>
            <table border="1" cellPadding="5">
              <thead>
                <tr><th>Sarjanumero</th><th>Vaurio/huomio</th><th>Toiminnot</th></tr>
              </thead>
              <tbody>
                {Object.entries(units).map(([serial, info]) => (
                  <tr key={serial}>
                    <td>{serial}</td>
                    <td>
                      {editSerial === serial ? (
                        <input type="text" value={editDamage} onChange={(e) => setEditDamage(e.target.value)} />
                      ) : (
                        info.damage
                      )}
                    </td>
                    <td>
                      {editSerial === serial ? (
                        <button onClick={saveUnitEdit}>💾</button>
                      ) : (
                        <button onClick={() => editUnit(serial)}>✏️</button>
                      )}
                      <button onClick={() => deleteUnit(serial)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className={styles.header}>Lisää NETTI-yksilö</h3>
            <input type="text" placeholder="Sarjanumero" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} />
            <input type="text" placeholder="Vaurio" value={newDamage} onChange={(e) => setNewDamage(e.target.value)} />
            
            <button className={styles.saveButton} onClick={addUnit}>Lisää</button>
          </div>
        )}


{category === "IPAD" && (
          <div>
            <h2 className={styles.header}>Yksilöt</h2>
            <table border="1" cellPadding="5">
              <thead>
                <tr><th>Sarjanumero</th><th>Vaurio/huomio</th><th>Toiminnot</th></tr>
              </thead>
              <tbody>
                {Object.entries(units).map(([serial, info]) => (
                  <tr key={serial}>
                    <td>{serial}</td>
                    <td>
                      {editSerial === serial ? (
                        <input type="text" value={editDamage} onChange={(e) => setEditDamage(e.target.value)} />
                      ) : (
                        info.damage
                      )}
                    </td>
                    <td>
                      {editSerial === serial ? (
                        <button onClick={saveUnitEdit}>💾</button>
                      ) : (
                        <button onClick={() => editUnit(serial)}>✏️</button>
                      )}
                      <button onClick={() => deleteUnit(serial)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className={styles.header}>Lisää IPAD-yksilö</h3>
            <input type="text" placeholder="Sarjanumero" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} />
            <input type="text" placeholder="Vaurio" value={newDamage} onChange={(e) => setNewDamage(e.target.value)} />
            
            <button className={styles.saveButton} onClick={addUnit}>Lisää</button>
          </div>
        )}


        {category === "TIETOKONE" && (
          <div>
            <h2 className={styles.header}>Yksilöt</h2>
            <table border="1" cellPadding="5">
              <thead>
                <tr><th>Sarjanumero</th><th>Vaurio/huomio</th><th>Toiminnot</th></tr>
              </thead>
              <tbody>
                {Object.entries(units).map(([serial, info]) => (
                  <tr key={serial}>
                    <td>{serial}</td>
                    <td>
                      {editSerial === serial ? (
                        <input type="text" value={editDamage} onChange={(e) => setEditDamage(e.target.value)} />
                      ) : (
                        info.damage
                      )}
                    </td>
                    <td>
                      {editSerial === serial ? (
                        <button onClick={saveUnitEdit}>💾</button>
                      ) : (
                        <button onClick={() => editUnit(serial)}>✏️</button>
                      )}
                      <button onClick={() => deleteUnit(serial)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className={styles.header}>Lisää TIETOKONE-yksilö</h3>
            <input type="text" placeholder="Sarjanumero" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} />
            <input type="text" placeholder="Vaurio" value={newDamage} onChange={(e) => setNewDamage(e.target.value)} />
            
            <button className={styles.saveButton} onClick={addUnit}>Lisää</button>
          </div>
        )}
 {category === "PLAYER" && (
          <div>
            <h2 className={styles.header}>Yksilöt</h2>
            <table border="1" cellPadding="5">
              <thead>
                <tr><th>Sarjanumero</th><th>Vaurio</th><th>Toiminnot</th></tr>
              </thead>
              <tbody>
                {Object.entries(units).map(([serial, info]) => (
                  <tr key={serial}>
                    <td>{serial}</td>
                    <td>
                      {editSerial === serial ? (
                        <input type="text" value={editDamage} onChange={(e) => setEditDamage(e.target.value)} />
                      ) : (
                        info.damage
                      )}
                    </td>
                    <td>
                      {editSerial === serial ? (
                        <button onClick={saveUnitEdit}>💾</button>
                      ) : (
                        <button onClick={() => editUnit(serial)}>✏️</button>
                      )}
                      <button onClick={() => deleteUnit(serial)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className={styles.header}>Lisää PLAYER-yksilö</h3>
            <input type="text" placeholder="Sarjanumero" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} />
            <input type="text" placeholder="Vaurio" value={newDamage} onChange={(e) => setNewDamage(e.target.value)} />
            
            <button className={styles.saveButton} onClick={addUnit}>Lisää</button>
          </div>
        )}
        <div className={styles.buttonContainer}>
          <button className={styles.cancelButton} onClick={onClose}>Palaa</button>
          <button className={styles.saveButton} onClick={saveProductDetails}>Tallenna</button> {/* Updated function call */}
          <button className={styles.deleteButton} onClick={deleteProduct}>Poista</button> {/* Add delete button */}
        </div>
      </div>
    </Modal>
  );
}

export default ProductDetails;
