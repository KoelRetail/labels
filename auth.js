// Login gate on the KOEL Worklist project (koel-staging-scan). Two ways in:
// a Worklist team member, or anyone who signed up here with a KOEL address and
// proved it by clicking the verification link (otherwise anyone could type
// someone@koelretail.be and walk in).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  createUserWithEmailAndPassword, sendEmailVerification,
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

export const isKoelEmail = (email) => /@koelretail\.(be|nl|com)$/i.test(String(email).trim());

// A Firebase account alone is not enough: it has to be on the team.
async function isMember(user) {
  const snap = await getDoc(doc(db, 'wl_members', user.uid));
  return snap.exists();
}

// createUser signs the new account in for a moment; signUp handles that itself.
let signingUp = false;

// Calls back with the signed-in user who may use the tool, or null.
export function watchUser(cb) {
  return onAuthStateChanged(auth, async (user) => {
    if (signingUp) return;
    if (!user) return cb(null);
    if (isKoelEmail(user.email) && user.emailVerified) return cb(user);
    try {
      if (await isMember(user)) return cb(user);
    } catch { /* permission or network error: treat as no access */ }
    if (isKoelEmail(user.email) && !user.emailVerified) {
      await sendEmailVerification(user).catch(() => {});
      await signOut(auth);
      return cb(null, `Bevestig eerst je e-mailadres: we hebben opnieuw een link gestuurd naar ${user.email}. Kijk ook in je spam.`);
    }
    await signOut(auth);
    cb(null, 'Dit account heeft geen toegang tot Asset Labels. Gebruik je KOEL-mailadres.');
  });
}

export async function logIn(email, password, remember) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  await signInWithEmailAndPassword(auth, email, password);
}

// New account: KOEL address only, then a verification mail. Signed out right
// away so nobody is inside before the link is clicked.
export async function signUp(email, password) {
  if (!isKoelEmail(email)) throw Object.assign(new Error('domain'), { code: 'koel/domain' });
  signingUp = true;
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(user);
    await signOut(auth);
  } finally {
    signingUp = false;
  }
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
    case 'auth/email-already-in-use': return 'Er bestaat al een account met dit e-mailadres. Log in, of gebruik "Wachtwoord vergeten?".';
    case 'auth/weak-password': return 'Kies een wachtwoord van minstens 8 tekens.';
    case 'koel/domain': return 'Gebruik je KOEL-mailadres (@koelretail.be, .nl of .com).';
    default: return 'Inloggen lukte niet. Probeer het opnieuw.';
  }
}
