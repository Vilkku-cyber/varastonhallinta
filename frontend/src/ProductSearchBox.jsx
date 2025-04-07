import React, { useState, useRef, useEffect } from "react";

function ProductSearchBox({ products, onSelect }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showList, setShowList] = useState(false);
  const containerRef = useRef(null);

  const filteredProducts = products.filter(
    (product) =>
      product.name &&
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="product-search-dropdown">
      <input
        type="text"
        placeholder="Hae tuotetta..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setShowList(true);
        }}
        onFocus={() => setShowList(true)}
      />
      {showList && filteredProducts.length > 0 && (
        <ul>
          {filteredProducts.map((product) => (
            <li key={product.id}>
              <button
                onClick={() => {
                  onSelect(product.id);
                  setSearchTerm("");
                  setShowList(false);
                }}
              >
                {product.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProductSearchBox;
