import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBySup__IKQfURxX3LJazbv1kInaqr3i9c",
  authDomain: "film-thickness-recorder.firebaseapp.com",
  projectId: "film-thickness-recorder",
  storageBucket: "film-thickness-recorder.firebasestorage.app",
  messagingSenderId: "527445549502",
  appId: "1:527445549502:web:f9f960c37066a4d33499ef"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
