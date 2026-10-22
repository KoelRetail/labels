// Login gate. Accounts are the KOEL Worklist team (koel-staging-scan): whoever
// is a member there may print labels here, so nobody needs a second account.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js';

const app = initializeApp({
  apiKey: 'AIzaSyDQj4XKnNddMBk14Zw-6mcEKrXltrRDdX8',
  authDomain: 'koel-staging-scan.firebaseapp.com',
  projectId: 'koel-staging-scan',
  storageBucket: 'koel-staging-scan.firebasestorage.app',
  messagingSenderId: '330811491774',
  appId: '1:330811491774:web:8edc848c6fd6f812c125ef',
});
const auth = getAuth(app);
const db = getFirestore(app);

// A Firebase account alone is not enough: it has to be on the team.
async function isMember(user) {
  const snap = await getDoc(doc(db, 'wl_members', user.uid));
  return snap.exists();
}

// Calls back with the signed-in team member, or null.
export function watchUser(cb) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return cb(null);
    try {
      if (await isMember(user)) return cb(user);
    } catch { /* permission or network error: treat as no access */ }
    await signOut(auth);
    cb(null, 'Dit account heeft geen toegang tot Asset Labels. Vraag een uitnodiging voor het KOEL-team.');
  });
}

export async function logIn(email, password, remember) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  await signInWithEmailAndPassword(auth, email, password);
}

export const logOut = () => signOut(auth);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

export function authMessage(e) {
  switch (e && e.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'E-mailadres of wachtwoord klopt niet.';
    case 'auth/invalid-email': return 'Dat is geen geldig e-mailadres.';
    case 'auth/too-many-requests': return 'Te veel pogingen. Wacht even en probeer opnieuw.';
    case 'auth/network-request-failed': return 'Geen verbinding. Controleer je netwerk.';
    default: return 'Inloggen lukte niet. Probeer het opnieuw.';
  }
}
