import React from "react";
import "./ShelfMap.css";
import { useNavigate } from "react-router-dom";

const shelfKeys = ["A", "B", "C", "D", "E", "F", "G", "H", "K", "L", "M","N"];

function ShelfMap() {
  const navigate = useNavigate();

  return (
    <div className="map-container">
      <img src="/images/VARASTOKARTTA.png" alt="Hyllykartta" className="map-image" />
      {shelfKeys.map((key) => (
        <button
          key={key}
          className={`map-button map-${key}`}
          onClick={() => navigate(`/shelf/${key}`)}
        >
          {key}
        </button>
      ))}
    </div>
  );
}

export default ShelfMap;
