import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { database, ref, get, update, onValue } from "./firebaseConfig"; // Firebase-yhteys

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [name, setName] = useState("");
  const [available, setAvailable] = useState(0);
  const [reserved, setReserved] = useState(0);
  const [category, setCategory] = useState("Muu"); // 🔹 Asetetaan oletusarvo
  const [dimensions, setDimensions] = useState("");
  const [weight, setWeight] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [units, setUnits] = useState({});
  const [newSerial, setNewSerial] = useState("");
  const [newDamage, setNewDamage] = useState("");
  const [editSerial, setEditSerial] = useState(null);
  const [editDamage, setEditDamage] = useState("");

  useEffect(() => {
    const productRef = ref(database, `inventory/${id}`);
    get(productRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setProduct(data);
        setName(data.name || "");
        setAvailable(data.available || 0);
        setCategory(data.category || "Muu"); // 🔹 Varmistetaan, että kategoriat latautuvat oikein
        setDimensions(data.dimensions || "");
        setWeight(data.weight || "");
        setAdditionalInfo(data.additionalInfo || "");
        setUnits(data.units || {});
      }
    });

    const tripsRef = ref(database, "keikat");
    onValue(tripsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let reservedCount = 0;
        Object.values(data).forEach((trip) => {
          if (trip.items) {
            Object.values(trip.items).forEach((item) => {
              if (item.id === id) {
                reservedCount += item.quantity;
              }
            });
          }
        });
        setReserved(reservedCount);
      }
    });
  }, [id]);

  const saveProduct = () => {
    if (!category) {
      alert("Valitse kategoria ennen tallennusta!");
      return;
    }

    const productRef = ref(database, `inventory/${id}`);
    update(productRef, {
      name,
      available,
      category, // 🔹 Nyt tämä varmasti tallentuu Firebaseen
      dimensions,
      weight,
      additionalInfo,
      units,
    })
      .then(() => {
        alert("Tuotetiedot päivitetty!");
        navigate("/inventory"); // 🔹 Ohjataan takaisin varastonäkymään
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

  if (!product) return <p>Ladataan...</p>;

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
      <button onClick={() => navigate("/Inventory")}>Palaa</button>
      <button onClick={saveProduct}>Tallenna</button>
    </div>
  );
}

export default ProductDetails;
