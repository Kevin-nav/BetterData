import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: getRequiredPublicEnv(
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  ),
  authDomain: getRequiredPublicEnv(
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  ),
  projectId: getRequiredPublicEnv(
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ),
};

function getRequiredPublicEnv(name: string, value: string | undefined) {
  if (!value?.trim()) {
    throw new Error(
      `${name} is required. For local admin dev, define it in the workspace root .env.local.`
    );
  }

  return value;
}

// Prevent re-initialization during hot reload
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

/* ── Sign In with Email & Password ── */
export async function signInWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/* ── Sign In with Google ── */
export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

/* ── Sign Out ── */
export async function signOut() {
  await firebaseSignOut(auth);
}

/* ── Get ID Token ── */
export async function getIdToken(user?: User | null) {
  const currentUser = user ?? auth.currentUser;

  if (!currentUser) {
    return null;
  }

  return currentUser.getIdToken();
}
