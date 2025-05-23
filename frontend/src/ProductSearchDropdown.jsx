import React, { useState } from "react";

function ProductSearchDropdown({ categorizedInventory, value, onChange, reservedCounts = {}, globalReservedCounts = {} }) {
  const [searchTerm, setSearchTerm] = useState("");

  // Helper function to calculate available count
  const getAvailable = (item) => {
    const total = item.available || 0;
    const globallyReserved = globalReservedCounts[item.id] || 0;
    const locallyReserved = reservedCounts[item.id] || 0;
    return total - globallyReserved - locallyReserved;
  };

  // Suodatetaan tuotteet, joilla ei ole name, ja hakusanan mukaan
  const filteredInventory = Object.entries(categorizedInventory).reduce((acc, [category, items]) => {
    const filteredItems = items.filter((item) =>
      item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filteredItems.length > 0) {
      acc[category] = filteredItems;
    }
    return acc;
  }, {});

  // Lasketaan montako vaihtoehtoa näytetään yhteensä (optgroup ei vaikuta sizeen)
  const totalFilteredItems = Object.values(filteredInventory).reduce((sum, items) => sum + items.length, 0);

  return (
    <div style={{ marginBottom: "1rem" }}>
      <input
        type="text"
        placeholder="Hae tuotetta..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          padding: "6px",
          width: "100%",
          marginBottom: "8px",
          border: "1px solid #ccc",
          borderRadius: "4px"
        }}
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        size={Math.max(Math.min(totalFilteredItems + 1, 20), 3)}
        style={{
          width: "100%",
          padding: "10px",
          fontSize: "1.15em",
          height: "auto",
          lineHeight: "1.8em",
          borderRadius: "6px",
          backgroundColor: "#fff",
          border: "2px solid #888",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}
      >
        <option value="" disabled>+ Lisää tuote varastosta</option>
        {Object.entries(filteredInventory).map(([category, items]) => (
          <optgroup key={category} label={category}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({getAvailable(item)} kpl)
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export default ProductSearchDropdown;
