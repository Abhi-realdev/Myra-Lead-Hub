import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyClHn1O1bso8ZcL9d-cMdbnw6q1gtYpQYE",
  authDomain: "myra-lead-hub.firebaseapp.com",
  projectId: "myra-lead-hub",
  storageBucket: "myra-lead-hub.firebasestorage.app",
  messagingSenderId: "491248214070",
  appId: "1:491248214070:web:44a97f8c8bfc97af0a3897",
  measurementId: "G-EBWC559X23"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and export it
export const auth = getAuth(app);

// Export app as default
export default app;
