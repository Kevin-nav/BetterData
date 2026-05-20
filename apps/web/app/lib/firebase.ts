import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  updateProfile,
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
    throw new Error(`${name} is required. For local web dev, define it in the workspace root .env.local.`);
  }

  return value;
}

// Prevent re-initialization during hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

/* ── Sign Up with Email & Password ── */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  // Set the display name on the Firebase user
  await updateProfile(credential.user, { displayName });

  // Send verification email (email/password users only)
  await sendEmailVerification(credential.user);

  return credential.user;
}

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

/* ── Resend Verification Email ── */
export async function resendVerificationEmail() {
  if (!auth.currentUser) {
    throw new Error("No user is signed in.");
  }

  await sendEmailVerification(auth.currentUser);
}

/* ── Send Password Reset Email ── */
export async function sendPasswordReset(email: string) {
  await firebaseSendPasswordResetEmail(auth, email);
}

/* ── Check if user signed in with email/password ── */
export function isEmailPasswordUser(user: User) {
  return user.providerData.some(
    (provider) => provider.providerId === "password"
  );
}

/* ── Update Display Name ── */
export async function updateUserDisplayName(displayName: string) {
  if (!auth.currentUser) {
    throw new Error("No user is signed in.");
  }
  await updateProfile(auth.currentUser, { displayName });
  return auth.currentUser;
}
