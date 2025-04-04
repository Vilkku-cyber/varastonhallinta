import React, { useEffect, useState } from "react";
import { database, ref, onValue, set, remove, update } from "./firebaseConfig";
import { get, child } from "firebase/database";
import "./ShelfAdmin.css";

function ShelfAdmin() {
  const [shelves, setShelves] = useState({});
  const [openShelves, setOpenShelves] = useState({});
  const [openAisles, setOpenAisles] = useState({});
  const [openLevels, setOpenLevels] = useState({});
  const [inventoryItems, setInventoryItems] = useState({}); // Add state for inventory items

  useEffect(() => {
    const shelvesRef = ref(database, "shelves");
    onValue(shelvesRef, (snapshot) => {
      setShelves(snapshot.val() || {});
    });

    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      setInventoryItems(snapshot.val() || {});
    });
  }, []);

  const toggleShelf = (key) => {
    setOpenShelves((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const ensureShelvesRootExists = async () => {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, "shelves"));
    if (!snapshot.exists()) {
      await set(ref(database, "shelves"), {});
    }
  };

  const getNextLetter = () => {
    const letters = Object.keys(shelves).sort();
    if (letters.length === 0) return "A";
    const last = letters[letters.length - 1];
    return String.fromCharCode(last.charCodeAt(0) + 1);
  };

  const addShelf = async () => {
    await ensureShelvesRootExists();
    const nextKey = getNextLetter();
    const shelfPath = `shelves/${nextKey}`;
    const data = {
      direction: "ltr", // oletuksena vasemmalta oikealle
      aisles: {
        1: {
          levels: {
            1: {
              products: {
                "Tuote 1": {
                  info: "Automaattisesti lisätty testi",
                },
              },
            },
          },
        },
      },
    };
    set(ref(database, shelfPath), data)
      .then(() => {
        console.log(`Hylly ${nextKey} lisätty`);
        alert(`Hylly ${nextKey} lisätty valmiilla rakenteella!`);
      })
      .catch((error) => {
        console.error("Virhe lisättäessä hyllyä:", error);
        alert("Virhe lisättäessä hyllyä: " + error.message);
      });
  };

  const getNextNumberKey = (obj) => {
    const numbers = Object.keys(obj || {}).map(Number).sort((a, b) => a - b);
    return numbers.length === 0 ? 1 : numbers[numbers.length - 1] + 1;
  };

  const deleteShelf = (shelfKey) => {
    if (!window.confirm(`Poistetaanko hylly ${shelfKey}?`)) return;
    remove(ref(database, `shelves/${shelfKey}`));
  };

  const addAisle = (shelfKey) => {
    const aisles = shelves[shelfKey]?.aisles || {};
    const nextKey = getNextNumberKey(aisles);
    const data = {
      levels: {
        1: {
          products: {
            "Tuote 1": {
              info: "Automaattisesti lisätty testi",
            },
          },
        },
      },
    };
    set(ref(database, `shelves/${shelfKey}/aisles/${nextKey}`), data);
  };

  const deleteAisle = (shelfKey, aisleKey) => {
    if (!window.confirm(`Poistetaanko hyllyväli ${shelfKey}${aisleKey}?`)) return;
    remove(ref(database, `shelves/${shelfKey}/aisles/${aisleKey}`));
  };

  const addLevel = (shelfKey, aisleKey) => {
    const levels = shelves[shelfKey]?.aisles?.[aisleKey]?.levels || {};
    const nextKey = getNextNumberKey(levels);
    const data = {
      products: {
        "Tuote 1": {
          info: "Automaattisesti lisätty testi",
        },
      },
    };
    set(ref(database, `shelves/${shelfKey}/aisles/${aisleKey}/levels/${nextKey}`), data);
  };

  const deleteLevel = (shelfKey, aisleKey, levelKey) => {
    if (!window.confirm(`Poistetaanko hyllytaso ${shelfKey}${aisleKey}${levelKey}?`)) return;
    remove(ref(database, `shelves/${shelfKey}/aisles/${aisleKey}/levels/${levelKey}`));
  };

  const addProduct = async (shelfKey, aisleKey, levelKey) => {
    const name = prompt("Tuotteen nimi tai ID varastosta");
    if (!name) return;
    const path = `shelves/${shelfKey}/aisles/${aisleKey}/levels/${levelKey}/products/${name}`;
    await set(ref(database, path), { info: "Lisätty käsin" });

    // Päivitetään inventory[productId].shelfLocation
    const shelfLoc = `${shelfKey}${aisleKey}${levelKey}`;
    await update(ref(database, `inventory/${name}`), {
      shelfLocation: shelfLoc,
    });
  };

  const deleteProduct = (shelfKey, aisleKey, levelKey, productKey) => {
    if (!window.confirm(`Poistetaanko tuote ${productKey}?`)) return;
    const path = `shelves/${shelfKey}/aisles/${aisleKey}/levels/${levelKey}/products/${productKey}`;
    remove(ref(database, path));
  };

  const addProductFromInventory = async (shelfKey, aisleKey, levelKey, productKey) => {
    const path = `shelves/${shelfKey}/aisles/${aisleKey}/levels/${levelKey}/products/${productKey}`;
    await set(ref(database, path), { info: "Lisätty varastosta" });

    // Päivitetään inventory[productId].shelfLocation
    const shelfLoc = `${shelfKey}${aisleKey}${levelKey}`;
    await update(ref(database, `inventory/${productKey}`), {
      shelfLocation: shelfLoc,
    });
  };

  return (
    <div className="shelf-admin">
      <h1>Hyllyadmin</h1>
      <button className="primary-button small" onClick={addShelf}>+ Lisää hylly (A-Z)</button>

      <div className="scroll-box">
        {Object.entries(shelves).map(([shelfKey, shelfData]) => {
          const isOpen = openShelves[shelfKey];

          return (
            <div key={shelfKey} className="shelf-box">
              <div className="collapsible-header" onClick={() => toggleShelf(shelfKey)}>
                <span><strong>Hylly {shelfKey}</strong></span>
                <span>{isOpen ? "▼" : "►"}</span>
              </div>

              <div className={`collapsible-content ${isOpen ? "open white-background" : ""}`}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <span><strong>Numeroidaan oikealta vasemmalle</strong></span>
                  <input
                    type="checkbox"
                    checked={shelfData.direction === "rtl"}
                    onChange={(e) => {
                      const newDirection = e.target.checked ? "rtl" : "ltr";
                      update(ref(database, `shelves/${shelfKey}`), { direction: newDirection });
                    }}
                  />
                </div>
                <button className="primary-button small" onClick={() => deleteShelf(shelfKey)}>Poista</button>
                <button className="primary-button small" onClick={() => addAisle(shelfKey)}>+ Lisää hyllyväli</button>

                {shelfData.aisles && Object.entries(shelfData.aisles).map(([aisleKey, aisleData]) => {
                  const isAisleOpen = openAisles[`${shelfKey}-${aisleKey}`];
                  return (
                    <div key={aisleKey} className="aisle">
                      <div className="collapsible-header" onClick={() => setOpenAisles(prev => ({
                        ...prev,
                        [`${shelfKey}-${aisleKey}`]: !prev[`${shelfKey}-${aisleKey}`]
                      }))}>
                        <h3>Väli {shelfKey}{aisleKey}</h3>
                        <span>{isAisleOpen ? "▼" : "►"}</span>
                      </div>

                      {isAisleOpen && (
                        <div className="collapsible-content open white-background">
                          {aisleData.levels && Object.entries(aisleData.levels).map(([levelKey, levelData]) => {
                            const isLevelOpen = openLevels[`${shelfKey}-${aisleKey}-${levelKey}`];
                            return (
                              <div key={levelKey} className="level">
                                <div className="collapsible-header" onClick={() => setOpenLevels(prev => ({
                                  ...prev,
                                  [`${shelfKey}-${aisleKey}-${levelKey}`]: !prev[`${shelfKey}-${aisleKey}-${levelKey}`]
                                }))}>
                                  <h4>Taso {shelfKey}{aisleKey}{levelKey}</h4>
                                  <span>{isLevelOpen ? "▼" : "►"}</span>
                                </div>
                                {isLevelOpen && (
                                  <div className="collapsible-content open white-background">
                                    <ul>
                                      {levelData.products && Object.keys(levelData.products).map((productKey) => (
                                        <li key={productKey}>
                                          {inventoryItems[productKey]?.name || productKey}
                                          <button className="primary-button small" onClick={() => deleteProduct(shelfKey, aisleKey, levelKey, productKey)}>Poista</button>
                                        </li>
                                      ))}
                                    </ul>
                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                      <button
                                        className="primary-button small outlined"
                                        onClick={() => addProduct(shelfKey, aisleKey, levelKey)}
                                      >
                                        + Lisää tuote (teksti)
                                      </button>

                                      <select
                                        className="primary-button small"
                                        defaultValue=""
                                        onChange={(e) => {
                                          const selected = e.target.value;
                                          if (selected) {
                                            addProductFromInventory(shelfKey, aisleKey, levelKey, selected);
                                            e.target.value = ""; // Reset selection
                                          }
                                        }}
                                      >
                                        <option value="" disabled>+ Lisää tuote varastosta</option>
                                        {Object.entries(inventoryItems).map(([id, item]) => (
                                          <option key={id} value={id}>
                                            {item.name || id}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <button className="primary-button small danger" onClick={() => deleteLevel(shelfKey, aisleKey, levelKey)}>Poista taso</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <button className="primary-button small" onClick={() => addLevel(shelfKey, aisleKey)}>+ Lisää hyllytaso</button>
                          <button className="primary-button small" onClick={() => deleteAisle(shelfKey, aisleKey)}>Poista väli</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ShelfAdmin;
