"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { ReactNode, useCallback, useMemo } from "react";
import { useAdminAuth } from "./auth";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is required. Define CONVEX_URL in the workspace root .env.local."
  );
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const { firebaseUser, loading } = useAdminAuth();

  const fetchAccessToken = useCallback(async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
    if (!firebaseUser) return null;
    return await firebaseUser.getIdToken(forceRefreshToken);
  }, [firebaseUser]);

  const useAuth = useMemo(() => {
    return () => ({
      isLoading: loading,
      isAuthenticated: firebaseUser !== null,
      fetchAccessToken,
    });
  }, [loading, firebaseUser, fetchAccessToken]);

  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
