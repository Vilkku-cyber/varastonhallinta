import React from "react";

console.log("🔥 Firebase API Key:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
console.log("🔥 Firebase Database URL:", process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);

function App() {
  return (
    <div>
      <h1>Varastonhallinta</h1>
      <p>Katso konsoli nähdäksesi Firebase-muuttujat.</p>
    </div>
  );
}

export default App;
