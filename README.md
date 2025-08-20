# Warehouse Management App / Varastonhallintasovellus

A lightweight and customizable warehouse management system designed for AV gear rentals and event logistics. Built with React and Firebase Realtime Database.

Kevyt ja helposti muokattava varastonhallintajärjestelmä, suunniteltu erityisesti AV-laitteiden vuokraukseen ja tapahtumien logistiikkaan. Rakennettu Reactilla ja Firebase-tietokannalla.

📍 GitHub repository: https://github.com/Vilkku-cyber/varastonhallinta.git

---

## ✨ Features / Ominaisuudet

- 📦 **Inventory View / Varastonäkymä**
  - Realtime inventory with category filters
  - Available vs. reserved item counts
  - Product detail pages with serial number tracking

- 🎤 **Trip/Event Management / Keikkojen hallinta**
  - Create trips with name, date range, and contact info
  - Add multiple products with quantities
  - Automatic availability tracking

- 📋 **Packing View / Pakkausnäkymä**
  - Scan product serial numbers
  - Add manual items without serials
  - Tracks packed vs. needed amounts

- 🔍 **Search & Filter / Haku ja suodatus**
  - Dynamic product dropdown filter
  - Archive filtering by trip name, dates, or products

- 📱 **QR Code Reader / QR-koodinlukija**
  - Scan serial numbers with a camera
  - View detailed product and unit info

- 🔐 **Login System / Kirjautuminen**
  - Firebase Auth with email & password
  - Password reset included

---

## ⚙️ Technologies / Teknologiat

- React
- Firebase Realtime Database
- React Router
- React Modal
- DatePicker
- jsQR (QR scanning)

---

## 🚀 Getting Started / Käyttöönotto

### 🔸 Prerequisites / Vaatimukset

- Node.js
- Firebase project with:
  - Realtime Database
  - Authentication enabled

---

### 🔹 Installation / Asennus

```bash
git clone https://github.com/Vilkku-cyber/varastonhallinta.git
cd varastonhallinta
npm install
```

---

### 🔹 Firebase Config

Create a file called `firebaseConfig.js` inside the `src/` folder:

```js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, get, update, remove } from "firebase/database";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  // etc...
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

export { database, ref, onValue, push, get, update, remove, auth, signInWithEmailAndPassword };
```

### 🔐 Key Management / Avainten hallinta

Store Firebase API keys and other secrets in environment variables instead of hardcoding them into the source. Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Do not commit the `.env` file to version control (it's already ignored). Configure Firebase Realtime Database rules to restrict access and protect data.

---

### 🔹 Run the app / Käynnistä sovellus

```bash
npm run dev
```

---

## 📁 Folder Structure / Kansion rakenne

src/
├── App.jsx
├── Home.jsx
├── Inventory.jsx
├── CreateTrip.jsx
├── EditTrip.jsx
├── CreateTripModal.jsx
├── EditTripModal.jsx
├── PastTrips.jsx
├── Pakkaus.jsx
├── QRCodeReader.jsx
├── ProductModal.jsx
├── AddProductModal.jsx
├── ProductSelector.jsx
├── ProductSearchDropdown.jsx
├── Login.jsx
└── firebaseConfig.js

---

## 📄 License / Lisenssi

This project is open source and free to use.

Tämä projekti on avoin ja ilmainen käyttää. Kehitysehdotukset ja kontribuutiot ovat tervetulleita!

---

🛠️ Made with love by [Vilkku-cyber](https://github.com/Vilkku-cyber)