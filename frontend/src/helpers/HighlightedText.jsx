// frontend/src/helpers/HighlightedText.jsx
import React from "react";

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turvallinen korostus ilman HTML-merkkijonoja.
 * Pilkkoo tekstin ja palauttaa <mark>-elementit React-solmuina.
 */
export default function HighlightedText({ text, query }) {
  const safeText = String(text ?? "");
  const q = String(query ?? "").trim();
  if (!q) return <>{safeText}</>;

  try {
    const re = new RegExp(`(${escapeRegExp(q)})`, "gi");
    const parts = safeText.split(re);
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === q.toLowerCase()
            ? <mark key={i}>{part}</mark>
            : <React.Fragment key={i}>{part}</React.Fragment>
        )}
      </>
    );
  } catch {
    // Jos käyttäjä syöttää rikkinäisen regexin -> palauta raakateksti
    return <>{safeText}</>;
  }
}
