import React from "react";
import "./MiniMap.css";

function MiniMap({ highlighted }) {
  const shelves = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"," L", "M", "N"];

  return (
    <div className="minimap-container">
      {shelves.map((shelf) => (
        <div
          key={shelf}
          className={`box ${shelf} ${highlighted === shelf ? "highlight" : ""}`}
        >
          {shelf}
        </div>
      ))}
    </div>
  );
}

export default MiniMap;
