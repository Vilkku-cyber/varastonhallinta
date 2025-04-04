import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "./firebaseConfig";
import { useNavigate } from "react-router-dom";
import "./ShelfSearch.css";

function ShelfSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [shelves, setShelves] = useState({});
  const [inventory, setInventory] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const shelvesRef = ref(database, "shelves");
    onValue(shelvesRef, (snapshot) => {
      setShelves(snapshot.val() || {});
    });
    const inventoryRef = ref(database, "inventory");
    onValue(inventoryRef, (snapshot) => {
      setInventory(snapshot.val() || {});
    });
  }, []);

  const handleSearch = () => {
    const found = [];
    Object.entries(shelves).forEach(([shelfKey, shelf]) => {
      Object.entries(shelf.aisles || {}).forEach(([aisleKey, aisle]) => {
        Object.entries(aisle.levels || {}).forEach(([levelKey, level]) => {
          Object.entries(level.products || {}).forEach(([productKey, product]) => {
            const inventoryName = inventory[productKey]?.name || productKey;
            if (
              inventoryName.toLowerCase().includes(query.toLowerCase()) ||
              (product.info && product.info.toLowerCase().includes(query.toLowerCase()))
            ) {
              found.push({
                shelf: shelfKey,
                aisle: aisleKey,
                level: levelKey,
                product: productKey,
                name: inventoryName
              });
            }
          });
        });
      });
    });
    setResults(found);
  };

  return (
    <div className="shelf-search">
      <h2>Hae tuotetta varastosta</h2>
      <div className="search-bar">
        <input
          type="text"
          placeholder="Hae tuotteen nimellä..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={handleSearch}>Hae</button>
      </div>

      {results.length > 0 && (
        <div className="results">
          <h3>Hakutulokset:</h3>
          <ul>
            {results.map((res, index) => (
              <li key={index}>
                {res.name} → Hylly {res.shelf}, Väli {res.aisle}, Taso {res.level}
                <button onClick={() => navigate(`/shelf/${res.shelf}?highlight=${res.aisle}${res.level}`)}>
                  Näytä visuaalisesti
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ShelfSearch;
