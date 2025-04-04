import React from "react";

function ProductSearchDropdown({ categorizedInventory, value, onChange }) {
  return (
    <select
      className="primary-button small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>+ Lisää tuote varastosta</option>
      {Object.entries(categorizedInventory).map(([category, items]) => (
        <optgroup key={category} label={category}>
          {items.map(([id, data]) => (
            <option key={id} value={id}>
              {data.name || id}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default ProductSearchDropdown;
