import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onValue, update, remove, set } from "firebase/database";
import { get, child } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";

console.log("Firebase API Key:", import.meta.env.VITE_FIREBASE_API_KEY);
console.log("Firebase Auth Domain:", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
console.log("Firebase Project ID:", import.meta.env.VITE_FIREBASE_PROJECT_ID);


// 🔹 Sinun Firebase-konfiguraatiosi:
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

// 🔹 Alustetaan Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// 🔹 Exportataan tarvittavat funktiot ja muuttujat
export { auth, database, ref, push, onValue, get, update, remove, set, signInWithEmailAndPassword, signOut };
