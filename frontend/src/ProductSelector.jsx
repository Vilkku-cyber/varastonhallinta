import React, { useState } from "react";

function ProductSelector({ inventory, value, onChange }) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const categorized = Object.entries(inventory || {}).reduce((acc, [id, item]) => {
    const category = item.category || "Muu";
    if (!acc[category]) acc[category] = [];
    acc[category].push({ ...item, id });
    return acc;
  }, {});

  const flatList = Object.values(categorized).flat();

  const filteredList = flatList.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ marginBottom: "10px", position: "relative" }}>
      {/* Hakukenttä */}
      <input
        type="text"
        placeholder="Hae tuotetta..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        style={{ width: "100%", marginBottom: "5px" }}
      />

      {/* Näytä hakutulokset suoraan */}
      {search && filteredList.length > 0 && (
        <div style={{
          border: "1px solid #ccc",
          background: "#fff",
          position: "absolute",
          zIndex: 1000,
          width: "100%",
          maxHeight: "200px",
          overflowY: "auto"
        }}>
          {filteredList.map(item => (
            <div
              key={item.id}
              onClick={() => {
                onChange(item.id);
                setSearch("");
                setShowDropdown(false);
              }}
              style={{ padding: "5px", cursor: "pointer", borderBottom: "1px solid #eee" }}
            >
              {item.name} ({item.available || 0} kpl)
            </div>
          ))}
        </div>
      )}

      {/* Normaali pudotusvalikko kategorioittain */}
      {showDropdown && (
        <select
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setSearch("");
            setShowDropdown(false);
          }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          style={{ width: "100%", marginTop: search ? "5px" : "0" }}
        >
          <option value="">Valitse tuote</option>
          {Object.entries(categorized).map(([category, items]) => (
            <optgroup key={category} label={category}>
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.available || 0} kpl varastossa)
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}

export default ProductSelector;
