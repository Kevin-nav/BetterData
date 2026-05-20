"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";

import { signInWithEmail, signInWithGoogle } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

/* ── Icons ── */
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/* ── Firebase Error Messages ── */
function getFirebaseErrorMessage(error: FirebaseError) {
  switch (error.code) {
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "Incorrect email or password. Please try again or reset your password.";
    case "auth/wrong-password":
      return "Incorrect password. Try again or reset it.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been suspended. Please contact support.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/popup-closed-by-user":
      return "Sign in was cancelled. Please try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  if (!authLoading && isAuthenticated) {
    router.replace("/dashboard");
    return null;
  }

  function validate() {
    const errors: Record<string, string> = {};

    if (!email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email.";
    if (!password) errors.password = "Password is required.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validate()) return;

    try {
      setSubmitting(true);
      await signInWithEmail(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError(getFirebaseErrorMessage(err));
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");

    try {
      setGoogleLoading(true);
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError(getFirebaseErrorMessage(err));
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  const isSubmitDisabled = submitting || googleLoading;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          <div className="logo-dot" />
          Better Data
        </Link>

        <div className="auth-header">
          <h1>Welcome back</h1>
          <p>Sign in to manage your data purchases</p>
        </div>

        {/* Error */}
        {error && (
          <div className="auth-error">
            <AlertCircleIcon />
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign-In */}
        <button
          type="button"
          className="google-btn"
          onClick={handleGoogleLogin}
          disabled={isSubmitDisabled}
        >
          <GoogleIcon />
          {googleLoading ? "Signing in..." : "Continue with Google"}
        </button>

        {/* Divider */}
        <div className="auth-divider">
          <div className="line" />
          <span>or sign in with email</span>
          <div className="line" />
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailLogin} noValidate>
          {/* Email */}
          <div className="form-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: "" })); }}
              className={fieldErrors.email ? "input-error" : ""}
              autoComplete="email"
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>

          {/* Password */}
          <div className="form-field">
            <label htmlFor="login-password">Password</label>
            <div className="input-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: "" })); }}
                className={`has-toggle${fieldErrors.password ? " input-error" : ""}`}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </div>

          {/* Forgot Password */}
          <Link href="/forgot-password" className="forgot-link">
            Forgot password?
          </Link>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full"
            disabled={isSubmitDisabled}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-footer">
          Don&apos;t have an account?{" "}
          <Link href="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
