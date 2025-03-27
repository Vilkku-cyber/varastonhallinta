import React, { useState } from "react";

function ProductSearchDropdown({ categorizedInventory, value, onChange, reservedCounts = {} }) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const allProducts = Object.values(categorizedInventory).flat();

  const filtered = allProducts.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (id) => {
    onChange(id);
    setSearch("");
    setShowDropdown(false);
  };

  return (
    <div style={{ position: "relative", marginBottom: "10px" }}>
      <input
        type="text"
        placeholder="Hae tuotetta..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        style={{ width: "100%", padding: "5px" }}
      />

      {search && showDropdown && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "white",
          border: "1px solid #ccc",
          maxHeight: "200px",
          overflowY: "auto",
          zIndex: 999,
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: "5px", color: "#999" }}>Ei tuloksia</div>
          )}
          {filtered.map(item => (
            <div
              key={item.id}
              style={{ padding: "5px", cursor: "pointer", borderBottom: "1px solid #eee" }}
              onClick={() => handleSelect(item.id)}
            >
              {item.name} ({(item.available || 0) - (reservedCounts[item.id] || 0)} kpl)
            </div>
          ))}
        </div>
      )}

      {(!search || showDropdown) && (
        <select
          value={value}
          onChange={(e) => handleSelect(e.target.value)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          style={{ width: "100%", marginTop: "5px" }}
        >
          <option value="">Valitse tuote</option>
          {Object.entries(categorizedInventory).map(([category, items]) => (
            <optgroup key={category} label={category}>
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({(item.available || 0) - (reservedCounts[item.id] || 0)} kpl)
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}

export default ProductSearchDropdown;
