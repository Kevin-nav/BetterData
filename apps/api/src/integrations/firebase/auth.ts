import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import { getRequiredEnv } from "@betterdata/config";

export type AuthenticatedUser = {
  id: string;
  email?: string;
  firebaseUid: string;
  phone?: string;
  displayName?: string;
};

export async function verifyFirebaseToken(token: string): Promise<AuthenticatedUser> {
  ensureFirebaseAdmin();

  const decoded = await getAuth().verifyIdToken(token, true);

  return {
    id: decoded.uid,
    firebaseUid: decoded.uid,
    ...(decoded.email !== undefined ? { email: decoded.email } : {}),
    ...(decoded.phone_number !== undefined ? { phone: decoded.phone_number } : {}),
    ...(decoded.name !== undefined ? { displayName: decoded.name } : {})
  };
}

function ensureFirebaseAdmin() {
  if (getApps().length > 0) {
    return;
  }

  initializeApp({
    credential: cert({
      projectId: getRequiredEnv("FIREBASE_PROJECT_ID"),
      clientEmail: getRequiredEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: getRequiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n")
    })
  });
}
