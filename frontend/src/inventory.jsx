import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get("http://localhost:5000/api/inventory")
      .then(response => setInventory(response.data))
      .catch(error => console.error("Virhe haettaessa varastotietoja:", error));
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Varasto</h1>
      <button onClick={() => navigate("/")} style={{ marginBottom: "10px" }}>
        🏠 Koti
      </button>
      <button onClick={() => navigate("/add-product")} style={{ marginBottom: "20px" }}>
  + Lisää tuote
</button>

      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>Tuote</th>
            <th>Varastossa</th>
            <th>Keikalla</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map(item => (
            <tr key={item.id}>
              <td>
                <a href={`/product/${item.id}`} style={{ textDecoration: "none" }}>
                  {item.name}
                </a>
              </td>
              <td>{item.available}</td>
              <td style={{ color: "red" }}>{item.reserved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Inventory;
