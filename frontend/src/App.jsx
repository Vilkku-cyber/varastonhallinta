import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Alustetaan Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Haetaan dataa Firebase Realtime Databasesta
async function testFirebaseConnection() {
  try {
    const snapshot = await get(ref(db, "/"));
    if (snapshot.exists()) {
      console.log("🔥 Firebase Data:", snapshot.val());
    } else {
      console.log("❌ Ei dataa Firebase-tietokannassa.");
    }
  } catch (error) {
    console.error("🚨 Firebase-virhe:", error);
  }
}

// Kutsutaan testifunktiota
testFirebaseConnection();
