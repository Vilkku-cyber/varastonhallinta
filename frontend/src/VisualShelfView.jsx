import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ref, onValue, update, set } from "firebase/database";
import { database } from "./firebaseConfig";
import "./VisualShelfView.css";
import MiniMap from "./MiniMap";


function VisualShelfView() {
  const { shelfId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [aisles, setAisles] = useState({});
  const [highlight, setHighlight] = useState(null);
  const [inventory, setInventory] = useState({});
  const [direction, setDirection] = useState("ltr");

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const highlightTarget = searchParams.get("highlight");
    if (highlightTarget) {
      setHighlight(`${shelfId}${highlightTarget}`);
    }
  }, [location, shelfId]);

  useEffect(() => {
    const shelfRef = ref(database, `shelves/${shelfId}`);
    onValue(shelfRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAisles(data.aisles || {});
        setDirection(data.direction || "ltr");
      } else {
        setAisles({});
        setDirection("ltr");
      }
    });
  }, [shelfId]);

  useEffect(() => {
    const invRef = ref(database, "inventory");
    onValue(invRef, (snapshot) => {
      setInventory(snapshot.val() || {});
    });
  }, []);

  const getProductName = (productId) => {
    if (inventory[productId]) {
      return inventory[productId].name || productId;
    }
    return productId;
  };

  const sortedAisles = Object.entries(aisles);
  if (direction === "rtl") {
    sortedAisles.reverse();
  }

  return (
    <div className="visual-shelf-view">
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <button onClick={() => navigate("/")} className="primary-button small">🏠 Etusivu</button>
        <button onClick={() => navigate("/haku")} className="primary-button small outlined">← Takaisin hakuun</button>
      </div>
      <h2>Hylly {shelfId}</h2>
      <div className="shelf-grid">
        {sortedAisles.map(([aisleKey, aisleData]) => (
          <div className="aisle-column" key={aisleKey}>
            <div className="aisle-title">{shelfId}{aisleKey}</div>
            {aisleData.levels && Object.entries(aisleData.levels).reverse().map(([levelKey, levelData]) => (
              <div
                className={`level-box ${highlight === `${shelfId}${aisleKey}${levelKey}` ? "highlight" : ""}`}
                key={levelKey}
              >
                {shelfId}{aisleKey}{levelKey}
                <ul>
                  {levelData.products && Object.entries(levelData.products).map(([pid, pdata]) => {
                    const productName = getProductName(pid) || pdata?.name || pid;
                    return <li key={pid}>{productName}</li>;
                  })}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
      <MiniMap highlighted={shelfId} />

    </div>
  
  );
}

export default VisualShelfView;
