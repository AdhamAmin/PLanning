import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDBaCol1DQGkknr3K7oVV6FDwdD5eyJ_LQ",
  authDomain: "drweee-393e5.firebaseapp.com",
  projectId: "drweee-393e5",
  storageBucket: "drweee-393e5.firebasestorage.app",
  messagingSenderId: "746347074139",
  appId: "1:746347074139:web:f650bb2de3ba9fe9a0257e",
  measurementId: "G-LM0PQL7G5W"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
