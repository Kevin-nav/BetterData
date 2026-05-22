"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FirebaseError } from "firebase/app";

import { signUpWithEmail, signInWithGoogle } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { createBetterDataApiClient } from "@betterdata/api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiClient = createBetterDataApiClient({ baseUrl: API_BASE_URL });

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

const CheckSmallIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
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

/* ── Password Validation ── */
const PASSWORD_RULES = [
  { key: "length", label: "8+ characters", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { key: "number", label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { key: "special", label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function getPasswordStrength(password: string) {
  if (!password) return 0;
  return PASSWORD_RULES.filter((r) => r.test(password)).length;
}

const STRENGTH_LABELS: Record<number, string> = {
  0: "",
  1: "Weak",
  2: "Fair",
  3: "Strong",
  4: "Very strong",
};

/* ── Firebase Error Messages ── */
function getFirebaseErrorMessage(error: FirebaseError) {
  switch (error.code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Please use a stronger password.";
    case "auth/operation-not-allowed":
      return "Email/password sign up is not enabled. Please contact support.";
    case "auth/popup-closed-by-user":
      return "Sign in was cancelled. Please try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function SignupContent() {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Agent intent params
  const searchParams = useSearchParams();
  const intentParam = searchParams?.get("intent");
  const phoneParam = searchParams?.get("phone");
  const isAgentIntent = intentParam === "agent";

  // Pre-fill phone from query param
  useEffect(() => {
    if (phoneParam && !phone) {
      setPhone(phoneParam);
    }
  }, [phoneParam]);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(isAgentIntent ? "/agents/apply" : "/dashboard");
    }
  }, [authLoading, isAuthenticated, isAgentIntent, router]);

  if (!authLoading && isAuthenticated) {
    return null;
  }

  const strength = getPasswordStrength(password);

  function validate() {
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = "Full name is required.";
    if (!email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email.";
    if (!password) errors.password = "Password is required.";
    else if (strength < 3) errors.password = "Password is not strong enough.";
    if (password !== confirmPassword) errors.confirm = "Passwords don't match.";
    if (!termsAccepted) errors.terms = "You must accept the terms.";
    if (isAgentIntent && !phone.trim()) errors.phone = "Phone number is required for agent applications.";
    else if (isAgentIntent && !isValidGhanaPhoneNumber(phone)) errors.phone = "Enter a valid Ghana phone number.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validate()) return;

    try {
      setSubmitting(true);
      const user = await signUpWithEmail(email.trim(), password, name.trim());
      if (isAgentIntent) {
        await syncAgentPhone(user, phone.trim());
      }
      router.replace(isAgentIntent ? "/agents/apply" : "/dashboard");
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

  async function handleGoogleSignup() {
    setError("");

    if (isAgentIntent && !isValidGhanaPhoneNumber(phone)) {
      setFieldErrors((current) => ({
        ...current,
        phone: phone.trim()
          ? "Enter a valid Ghana phone number."
          : "Phone number is required for agent applications.",
      }));
      return;
    }

    try {
      setGoogleLoading(true);
      const user = await signInWithGoogle();
      if (isAgentIntent) {
        await syncAgentPhone(user, phone.trim());
      }
      router.replace(isAgentIntent ? "/agents/apply" : "/dashboard");
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
          <h1>Create your account</h1>
          <p>Join thousands of Ghanaians saving on data</p>
        </div>

        {/* First-time discount banner */}
        {isAgentIntent ? (
          <div className="auth-discount-banner" style={{ background: "var(--bg-elevated)" }}>
            <span className="discount-emoji">🏪</span>
            <span>
              You are signing up to <strong>apply as a Better Data agent</strong>.
              Complete your account to continue.
            </span>
          </div>
        ) : (
          <div className="auth-discount-banner">
            <span className="discount-emoji">🎉</span>
            <span>
              Sign up now and get <strong>a discount</strong> off your first purchase!
            </span>
          </div>
        )}

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
          onClick={handleGoogleSignup}
          disabled={isSubmitDisabled}
        >
          <GoogleIcon />
          {googleLoading ? "Signing up..." : "Continue with Google"}
        </button>

        {/* Divider */}
        <div className="auth-divider">
          <div className="line" />
          <span>or continue with email</span>
          <div className="line" />
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailSignup} noValidate>
          {/* Full Name */}
          <div className="form-field">
            <label htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
              type="text"
              placeholder="e.g. Kwame Asante"
              value={name}
              onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: "" })); }}
              className={fieldErrors.name ? "input-error" : ""}
              autoComplete="name"
            />
            {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
          </div>

          {/* Email */}
          <div className="form-field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: "" })); }}
              className={fieldErrors.email ? "input-error" : ""}
              autoComplete="email"
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>

          {/* Phone */}
          <div className="form-field">
            <label htmlFor="signup-phone">
              Phone Number{" "}
              {isAgentIntent ? (
                <span style={{ color: "var(--danger)" }}>*</span>
              ) : (
                <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
              )}
            </label>
            <input
              id="signup-phone"
              type="tel"
              placeholder="e.g. 054 123 4567"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setFieldErrors((p) => ({ ...p, phone: "" }));
              }}
              autoComplete="tel"
              className={fieldErrors.phone ? "input-error" : ""}
            />
            {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
          </div>

          {/* Password */}
          <div className="form-field">
            <label htmlFor="signup-password">Password</label>
            <div className="input-wrap">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: "" })); }}
                className={`has-toggle${fieldErrors.password ? " input-error" : ""}`}
                autoComplete="new-password"
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

            {/* Strength Bar */}
            {password.length > 0 && (
              <div className="strength-bar-container">
                <div className="strength-bar">
                  <div className="strength-bar-fill" data-strength={strength} />
                </div>
                <div className="strength-label" data-strength={strength}>
                  {STRENGTH_LABELS[strength]}
                </div>
              </div>
            )}

            {/* Password Rules */}
            <div className="password-rules">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                  <div key={rule.key} className="password-rule" data-met={met}>
                    <span className="rule-icon">
                      {met && <CheckSmallIcon />}
                    </span>
                    <span>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Confirm Password */}
          <div className="form-field">
            <label htmlFor="signup-confirm">Confirm Password</label>
            <div className="input-wrap">
              <input
                id="signup-confirm"
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((p) => ({ ...p, confirm: "" })); }}
                className={`has-toggle${fieldErrors.confirm ? " input-error" : ""}`}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {fieldErrors.confirm && <span className="field-error">{fieldErrors.confirm}</span>}
          </div>

          {/* Terms */}
          <label className="auth-terms">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => { setTermsAccepted(e.target.checked); setFieldErrors((p) => ({ ...p, terms: "" })); }}
            />
            <span>
              I agree to the{" "}
              <Link href="/terms">Terms &amp; Conditions</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>
              {fieldErrors.terms && (
                <span className="field-error" style={{ display: "block", marginTop: 4 }}>
                  {fieldErrors.terms}
                </span>
              )}
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full"
            disabled={isSubmitDisabled}
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{" "}
          <Link href="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-card">
          <div className="pkg-skeleton" style={{ width: "48px", height: "48px", borderRadius: "50%", margin: "0 auto 16px" }} />
          <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>Loading signup...</p>
        </div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}

async function syncAgentPhone(user: { getIdToken: (forceRefresh?: boolean) => Promise<string> }, phone: string) {
  const token = await user.getIdToken(true);
  await apiClient.createSession(token);
  await apiClient.updatePhone(phone, token);
}

function isValidGhanaPhoneNumber(value: string) {
  return /^(\+?233|0)\d{9}$/.test(value.replace(/\s/g, ""));
}
