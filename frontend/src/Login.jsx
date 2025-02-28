import React, { useState } from "react";
import { auth, signInWithEmailAndPassword } from "./firebaseConfig";
import { sendPasswordResetEmail } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./Login.css"; // 🔹 Lisää tyylitiedosto

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/"); // 🔹 Siirrytään etusivulle
    } catch (error) {
      setError("Virhe kirjautumisessa: " + error.message);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError("Syötä sähköpostiosoite ensin!");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Salasanan palautuslinkki on lähetetty sähköpostiisi.");
      setError(null);
    } catch (error) {
      setError("Virhe salasanan palautuksessa: " + error.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Kirjaudu sisään</h2>
        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Sähköposti"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Salasana"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="login-button">Kirjaudu</button>
        </form>
        <button onClick={handlePasswordReset} className="forgot-password-button">
          Unohtuiko salasana?
        </button>
      </div>
    </div>
  );
}

export default Login;
