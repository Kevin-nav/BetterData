"use client";

import { useState } from "react";
import Link from "next/link";
import { FirebaseError } from "firebase/app";

import { sendPasswordReset } from "../lib/firebase";

/* ── Icons ── */
const AlertCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px", marginRight: "6px" }}>
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEmailError("");

    if (!email.trim()) {
      setEmailError("Email is required.");
      return;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    try {
      setSubmitting(true);
      await sendPasswordReset(email.trim());
      setSuccess(true);
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/user-not-found") {
          // Do not disclose that the email does not exist for security reasons,
          // or show a generic success message, but standard UX can show the success screen anyway.
          setSuccess(true);
        } else {
          setError(err.message || "Unable to send password reset email.");
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          <div className="logo-dot" />
          Better Data
        </Link>

        <div className="auth-header">
          <h1>Reset Password</h1>
          <p>We will send you instructions to reset your password</p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircleIcon />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="auth-success-state">
            <div className="auth-success" style={{ marginBottom: "20px" }}>
              <CheckCircleIcon />
              <span>Reset link sent successfully to Kw-auth! Check your email.</span>
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "24px", textAlign: "center" }}>
              We have sent a password reset link to <strong>{email}</strong>. Follow the instructions in the email to set a new password.
            </p>
            <Link href="/login" className="btn btn-primary btn-lg btn-full">
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} noValidate>
            <div className="form-field">
              <label htmlFor="reset-email">Email Address</label>
              <input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                className={emailError ? "input-error" : ""}
                autoComplete="email"
              />
              {emailError && <span className="field-error">{emailError}</span>}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={submitting}
              style={{ marginTop: "12px" }}
            >
              {submitting ? "Sending..." : "Send Reset Link"}
            </button>

            <div className="auth-footer" style={{ marginTop: "24px" }}>
              <Link href="/login" style={{ display: "inline-flex", alignItems: "center" }}>
                <ArrowLeftIcon /> Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
