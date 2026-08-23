"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { createBetterDataApiClient } from "@betterdata/api-client";
import { getAdminScopeForRole, type AdminScope } from "@betterdata/config";

import {
  auth,
  signOut as firebaseSignOut,
  getIdToken,
} from "./firebase";
import { getApiBaseUrl } from "./api";

/* ── Types ── */
type AdminAuthState = {
  /** Firebase user object (null if not signed in) */
  firebaseUser: User | null;
  /** Admin scope: superadmin or admin (null if not verified yet) */
  scope: AdminScope | null;
  /** User's email */
  email: string | null;
  /** User's display name */
  displayName: string | null;
  /** True while checking initial auth state */
  loading: boolean;
  /** True if user is signed in and verified as admin/superadmin */
  isAuthorized: boolean;
  /** Error message if auth failed (e.g. not an admin) */
  error: string | null;
  /** Sign out from Firebase + clear local state */
  signOut: () => Promise<void>;
  /** Get Authorization headers for API calls */
  getAuthHeaders: () => Promise<HeadersInit>;
};

const AdminAuthContext = createContext<AdminAuthState | null>(null);

/* ── Provider ── */
const apiClient = createBetterDataApiClient({ baseUrl: getApiBaseUrl() });

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [scope, setScope] = useState<AdminScope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setError(null);

      if (!user) {
        setScope(null);
        setLoading(false);
        return;
      }

      try {
        const token = await getIdToken(user);

        if (!token) {
          setScope(null);
          setLoading(false);
          return;
        }

        // Sync user with the API (creates or updates the Convex user record)
        const session = await apiClient.createSession(token);
        const adminScope = session.adminScope ?? getAdminScopeForRole(session.role);

        if (adminScope) {
          setScope(adminScope);
          setError(null);
        } else {
          // Not authorized for admin access
          setScope(null);
          setError(
            "You do not have admin access. Contact a superadmin to request access."
          );
        }
      } catch (err) {
        console.error("Admin auth check failed:", err);
        setScope(null);
        setError("Authentication failed. Please try again.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut();
    setFirebaseUser(null);
    setScope(null);
    setError(null);
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getIdToken(firebaseUser);

    if (!token) {
      return {};
    }

    return { Authorization: `Bearer ${token}` };
  }, [firebaseUser]);

  const isAuthorized = scope !== null;

  const value = useMemo<AdminAuthState>(
    () => ({
      firebaseUser,
      scope,
      email: firebaseUser?.email ?? null,
      displayName: firebaseUser?.displayName ?? null,
      loading,
      isAuthorized,
      error,
      signOut,
      getAuthHeaders,
    }),
    [firebaseUser, scope, loading, isAuthorized, error, signOut, getAuthHeaders]
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

/* ── Hook ── */
export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }

  return context;
}

