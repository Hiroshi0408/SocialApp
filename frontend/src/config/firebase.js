import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCiM1YX62snkObj9PFy894OjIiaV7TDBLc",
  authDomain: "socialapp-967b3.firebaseapp.com",
  projectId: "socialapp-967b3",
  storageBucket: "socialapp-967b3.firebasestorage.app",
  messagingSenderId: "232279288627",
  appId: "1:232279288627:web:c317bb9c0d75cb8c1bac46",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
