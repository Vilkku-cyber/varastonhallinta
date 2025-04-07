import React, { useState } from "react";

function ProductSearchDropdown({ categorizedInventory, value, onChange }) {
  const [searchTerm, setSearchTerm] = useState("");

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
        className="primary-button small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        size={searchTerm.length > 0 ? Math.min(totalFilteredItems + 1, 10) : undefined} // Näytä lista auki jos haetaan
        style={{ width: "100%" }}
      >
        <option value="" disabled>+ Lisää tuote varastosta</option>
        {Object.entries(filteredInventory).map(([category, items]) => (
          <optgroup key={category} label={category}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export default ProductSearchDropdown;
