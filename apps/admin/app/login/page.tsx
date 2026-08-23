"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useAdminAuth } from "../lib/auth";
import { signInWithEmail, signInWithGoogle } from "../lib/firebase";

export default function AdminLoginPage() {
  const { loading, isAuthorized, error: authError } = useAdminAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already authorized — redirect to dashboard (never navigate during render).
  useEffect(() => {
    if (!loading && isAuthorized) {
      router.replace("/");
    }
  }, [loading, isAuthorized, router]);

  if (!loading && isAuthorized) {
    return null;
  }

  async function handleEmailLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    try {
      await signInWithEmail(email, password);
      // Auth state change will be picked up by AdminAuthProvider
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";

      if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) {
        setLoginError("Invalid email or password.");
      } else if (message.includes("auth/user-not-found")) {
        setLoginError("No account found with this email.");
      } else if (message.includes("auth/too-many-requests")) {
        setLoginError("Too many failed attempts. Please wait and try again.");
      } else {
        setLoginError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setLoginError(null);
    setIsSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed.";

      if (message.includes("auth/popup-closed-by-user")) {
        // User closed the popup — not an error
      } else {
        setLoginError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayError = authError ?? loginError;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <div className="sidebar-brand-dot" style={{ width: 36, height: 36, fontSize: "0.875rem" }}>
              BD
            </div>
            <span className="sidebar-brand-text" style={{ fontSize: "var(--font-size-xl)" }}>
              Better Data
            </span>
          </div>
          <h1 className="login-title">Admin Sign In</h1>
          <p className="login-subtitle">
            Sign in to access the operations dashboard
          </p>
        </div>

        <div className="login-body">
          {displayError && (
            <div className="login-error">{displayError}</div>
          )}

          {/* Google Sign-In */}
          <button
            className="btn btn-secondary btn-lg"
            onClick={handleGoogleLogin}
            disabled={isSubmitting || loading}
            style={{ width: "100%" }}
            type="button"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="login-divider">or</div>

          {/* Email / Password */}
          <form onSubmit={handleEmailLogin} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="admin-email">
                Email
              </label>
              <input
                id="admin-email"
                className="input"
                type="email"
                placeholder="admin@betterdatagh.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={isSubmitting || loading}
              style={{ width: "100%" }}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
