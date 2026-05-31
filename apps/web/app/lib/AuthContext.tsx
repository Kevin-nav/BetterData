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
import {
  createBetterDataApiClient,
  type UserProfile,
} from "@betterdata/api-client";

import {
  auth,
  signOut as firebaseSignOut,
  getIdToken,
  isEmailPasswordUser,
  resendVerificationEmail,
  updateUserDisplayName,
} from "./firebase";
import { identifyWebUser, resetWebAnalytics } from "./analytics";

/* ── Types ── */
type AuthState = {
  /** Firebase user object (null if not signed in) */
  firebaseUser: User | null;
  /** BetterData user profile from the API (null if not synced yet) */
  userProfile: UserProfile | null;
  /** True while checking initial auth state */
  loading: boolean;
  /** True if a Firebase user is signed in */
  isAuthenticated: boolean;
  /** True if the user's email is verified (always true for Google users) */
  isEmailVerified: boolean;
  /** True if this is an email/password user (not Google) */
  isEmailPasswordProvider: boolean;
  /** Sign out from Firebase + clear local state */
  signOut: () => Promise<void>;
  /** Resend verification email */
  resendVerification: () => Promise<void>;
  /** Get Authorization headers for API calls */
  getAuthHeaders: () => Promise<HeadersInit>;
  /** Force refresh the user profile from the API */
  refreshProfile: () => Promise<void>;
  /** Update user display name and sync to backend */
  updateName: (displayName: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/* ── Provider ── */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiClient = createBetterDataApiClient({ baseUrl: API_BASE_URL });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync Firebase user → API session on auth state change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      try {
        const token = await getIdToken(user);

        if (token) {
          const profile = await apiClient.createSession(token);
          // createSession returns SessionUser — fetch full profile via getMe
          const fullProfile = await apiClient.getMe(token);
          setUserProfile(fullProfile);
          if (fullProfile.analyticsUserHash) {
            identifyWebUser(fullProfile.analyticsUserHash, {
              role: fullProfile.role,
              is_authenticated: true,
              is_agent: fullProfile.role === "agent",
              has_wallet: typeof fullProfile.walletBalanceGhs === "number"
            });
          }
        }
      } catch (error) {
        console.error("Failed to sync user session:", error);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut();
    setFirebaseUser(null);
    setUserProfile(null);
    resetWebAnalytics();
  }, []);

  const resendVerification = useCallback(async () => {
    await resendVerificationEmail();
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getIdToken(firebaseUser);

    if (!token) {
      return {};
    }

    return { Authorization: `Bearer ${token}` };
  }, [firebaseUser]);

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) {
      return;
    }

    try {
      const token = await getIdToken(firebaseUser);

      if (token) {
        const fullProfile = await apiClient.getMe(token);
        setUserProfile(fullProfile);
      }
    } catch (error) {
      console.error("Failed to refresh profile:", error);
    }
  }, [firebaseUser]);

  const updateName = useCallback(async (displayName: string) => {
    if (!firebaseUser) return;
    try {
      // 1. Update display name in Firebase client SDK
      await updateUserDisplayName(displayName);

      // 2. Force token refresh to get updated display name in token claims
      const token = await firebaseUser.getIdToken(true);

      // 3. Trigger API session sync to sync the updated name to Convex
      await apiClient.createSession(token);

      // 4. Update the user profile locally
      await refreshProfile();
    } catch (error) {
      console.error("Failed to update user name:", error);
      throw error;
    }
  }, [firebaseUser, refreshProfile]);

  const isAuthenticated = firebaseUser !== null;
  const isEmailPasswordProvider = firebaseUser !== null && isEmailPasswordUser(firebaseUser);
  const isEmailVerified = firebaseUser !== null && (
    // Google users are always considered verified
    !isEmailPasswordProvider || firebaseUser.emailVerified
  );

  const value = useMemo<AuthState>(
    () => ({
      firebaseUser,
      userProfile,
      loading,
      isAuthenticated,
      isEmailVerified,
      isEmailPasswordProvider,
      signOut,
      resendVerification,
      getAuthHeaders,
      refreshProfile,
      updateName,
    }),
    [
      firebaseUser,
      userProfile,
      loading,
      isAuthenticated,
      isEmailVerified,
      isEmailPasswordProvider,
      signOut,
      resendVerification,
      getAuthHeaders,
      refreshProfile,
      updateName,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ── Hook ── */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
