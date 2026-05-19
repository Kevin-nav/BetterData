export type AuthenticatedUser = {
  id: string;
  email?: string;
  claims?: Record<string, unknown>;
};

export async function verifyFirebaseToken(token: string): Promise<AuthenticatedUser> {
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: requiredEnv("FIREBASE_PROJECT_ID"),
        clientEmail: requiredEnv("FIREBASE_CLIENT_EMAIL"),
        privateKey: requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n")
      })
    });
  }

  const decoded = await getAuth().verifyIdToken(token);

  return {
    id: decoded.uid,
    ...(decoded.email ? { email: decoded.email } : {}),
    claims: decoded
  };
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Firebase authentication.`);
  }

  return value;
}
