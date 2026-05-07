export type AuthenticatedUser = {
  id: string;
  email?: string;
};

export async function verifyFirebaseToken(_token: string): Promise<AuthenticatedUser> {
  throw new Error("Firebase Auth verification is not implemented yet.");
}
