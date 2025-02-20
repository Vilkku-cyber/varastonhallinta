import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { database, ref, get, update, onValue } from "./firebaseConfig"; // Firebase-yhteys
import styles from './main.module.css';

function ProductDetails({ product, reservedCounts, closeModal }) {
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

  const saveProduct = () => {
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
        closeModal();
      })
      .catch((error) => console.error("Virhe tallennettaessa tuotetietoja:", error));
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
    
      <div style={{ padding: "20px", fontFamily: "Arial" }}>
        <h1>Muokkaa tuotetta</h1>

        <label>Nimi:</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />

        <p><strong>Varastossa:</strong> <input type="number" value={available} onChange={(e) => setAvailable(Number(e.target.value))} /></p>
        <p><strong>Keikalla:</strong> {reserved}</p>

        <label>Kategoria:</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="LED">LED</option>
          <option value="TV">TV</option>
          <option value="TIETOKONE">TIETOKONE</option>
          <option value="Muu">Muu</option>
        </select>

        <h2>Tekniset tiedot</h2>
        <label>Mitat:</label>
        <input type="text" value={dimensions} onChange={(e) => setDimensions(e.target.value)} />

        <label>Paino:</label>
        <input type="text" value={weight} onChange={(e) => setWeight(e.target.value)} />

        <label>Lisätiedot:</label>
        <textarea value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} />

        {category === "TV" && (
          <div>
            <h2>TV:n yksilöt</h2>
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

            <h3>Lisää TV-yksilö</h3>
            <input type="text" placeholder="Sarjanumero" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} />
            <input type="text" placeholder="Vaurio" value={newDamage} onChange={(e) => setNewDamage(e.target.value)} />
            <button onClick={addUnit}>Lisää</button>
          </div>
        )}

        {category === "TIETOKONE" && (
          <div>
            <h2>TIETOKONE:n yksilöt</h2>
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

            <h3>Lisää TIETOKONE-yksilö</h3>
            <input type="text" placeholder="Sarjanumero" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} />
            <input type="text" placeholder="Vaurio" value={newDamage} onChange={(e) => setNewDamage(e.target.value)} />
            <button onClick={addUnit}>Lisää</button>
          </div>
        )}

        <br />
        <button onClick={closeModal}>Palaa</button>
        <button onClick={saveProduct}>Tallenna</button>
      </div>
    
  );
}

export default ProductDetails;
