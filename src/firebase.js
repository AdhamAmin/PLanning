import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";

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
// persistentSingleTabManager works on ALL browsers including iOS Safari.
// persistentMultipleTabManager requires SharedWorker (not supported on iOS)
// and causes a silent hang → white screen on iPhones.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
});

