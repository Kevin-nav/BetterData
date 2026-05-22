"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBetterDataApiClient } from "@betterdata/api-client";
import type { AgentPricingConfig, AgentApplicationStatus } from "@betterdata/contracts";
import { useAuth } from "../../lib/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiClient = createBetterDataApiClient({ baseUrl: API_BASE_URL });

/* ── Icons ── */
const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default function AgentsApplyPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, userProfile, getAuthHeaders, refreshProfile } = useAuth();

  const [pricing, setPricing] = useState<AgentPricingConfig | null>(null);
  const [application, setApplication] = useState<AgentApplicationStatus | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [updatingPhone, setUpdatingPhone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // If logged out, collect phone and redirect to signup
  const [loggedOutPhone, setLoggedOutPhone] = useState("");
  const [loggedOutPhoneError, setLoggedOutPhoneError] = useState("");

  // Redirect if already an agent
  useEffect(() => {
    if (!authLoading && isAuthenticated && userProfile?.role === "agent") {
      router.replace("/dashboard/agent");
    }
  }, [authLoading, isAuthenticated, userProfile, router]);

  // Load pricing + application status
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const pricingData = await apiClient.getAgentPricingConfig();
        if (active) setPricing(pricingData);
      } catch {
        /* pricing unavailable */
      }

      if (isAuthenticated) {
        try {
          const token = await readAuthToken(getAuthHeaders);
          if (token) {
            const appData = await apiClient.getMyAgentApplication(token);
            if (active) {
              setApplication(appData);
            }
          }
        } catch {
          /* application status unavailable */
        }
      }

      if (active) setLoadingData(false);
    }

    if (!authLoading) {
      void load();
    }

    return () => { active = false; };
  }, [authLoading, isAuthenticated, getAuthHeaders]);

  // Pre-fill phone from profile
  useEffect(() => {
    if (userProfile?.phone) {
      setPhone(userProfile.phone);
    }
  }, [userProfile]);

  // ── Logged-Out Flow ──
  if (!authLoading && !isAuthenticated) {
    const handleLoggedOutContinue = () => {
      setLoggedOutPhoneError("");
      const trimmed = loggedOutPhone.trim();
      if (!trimmed) {
        setLoggedOutPhoneError("Phone number is required to apply as an agent.");
        return;
      }
      if (!/^(\+?233|0)\d{9}$/.test(trimmed.replace(/\s/g, ""))) {
        setLoggedOutPhoneError("Enter a valid Ghana phone number.");
        return;
      }
      router.push(`/signup?intent=agent&phone=${encodeURIComponent(trimmed)}`);
    };

    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: "480px" }}>
          <Link href="/" className="auth-logo">
            <div className="logo-dot" />
            Better Data
          </Link>
          <div className="auth-header">
            <h1>Become an Agent</h1>
            <p>Create an account to apply for the agent program</p>
          </div>

          <div className="agent-apply-info-box">
            <p>
              To apply as a Better Data agent, you need an account. We will also need
              your phone number as a required business contact.
            </p>
          </div>

          <div className="form-field">
            <label htmlFor="agent-phone">Phone Number <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              id="agent-phone"
              type="tel"
              placeholder="e.g. 054 123 4567"
              value={loggedOutPhone}
              onChange={(e) => { setLoggedOutPhone(e.target.value); setLoggedOutPhoneError(""); }}
              className={loggedOutPhoneError ? "input-error" : ""}
              autoComplete="tel"
            />
            {loggedOutPhoneError && <span className="field-error">{loggedOutPhoneError}</span>}
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg btn-full"
            onClick={handleLoggedOutContinue}
          >
            Continue to Sign Up
          </button>

          <div className="auth-footer">
            Already have an account?{" "}
            <Link href="/login">Log in</Link> and apply from your dashboard.
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (authLoading || loadingData) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: "520px", textAlign: "center" }}>
          <div className="pkg-skeleton" style={{ width: "48px", height: "48px", borderRadius: "50%", margin: "0 auto 16px" }} />
          <p style={{ color: "var(--text-secondary)" }}>Loading application...</p>
        </div>
      </div>
    );
  }

  // ── Pending Application ──
  if (application?.status === "pending") {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: "520px" }}>
          <Link href="/" className="auth-logo">
            <div className="logo-dot" />
            Better Data
          </Link>
          <div className="agent-status-card pending">
            <div className="agent-status-icon"><ClockIcon /></div>
            <h2>Application Under Review</h2>
            <p>
              Your agent application has been received and is currently being reviewed
              by our team. You will be notified once a decision has been made.
            </p>
            {application.paymentReference && (
              <div className="agent-status-ref">
                <span>Payment Reference</span>
                <strong>{application.paymentReference}</strong>
              </div>
            )}
          </div>
          <Link href="/dashboard" className="btn btn-ghost btn-lg btn-full" style={{ marginTop: "16px" }}>
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── Rejected Application ──
  if (application?.status === "rejected") {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: "520px" }}>
          <Link href="/" className="auth-logo">
            <div className="logo-dot" />
            Better Data
          </Link>
          <div className="agent-status-card rejected">
            <div className="agent-status-icon"><AlertCircleIcon /></div>
            <h2>Application Not Approved</h2>
            <p>
              Unfortunately, your agent application was not approved at this time.
              If you believe this was an error, please contact our support team.
            </p>
          </div>
          <Link href="/dashboard" className="btn btn-ghost btn-lg btn-full" style={{ marginTop: "16px" }}>
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── Apply Flow (logged in, no existing application) ──
  const hasPhone = !!userProfile?.phone || !!phone.trim();

  async function handleUpdatePhone() {
    setPhoneError("");
    const trimmed = phone.trim();
    if (!trimmed) {
      setPhoneError("Phone number is required for agent applications.");
      return;
    }
    if (!/^(\+?233|0)\d{9}$/.test(trimmed.replace(/\s/g, ""))) {
      setPhoneError("Enter a valid Ghana phone number.");
      return;
    }

    try {
      setUpdatingPhone(true);
      const token = await readAuthToken(getAuthHeaders);
      if (token) {
        await apiClient.updatePhone(trimmed, token);
        await refreshProfile();
      }
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Failed to update phone number.");
    } finally {
      setUpdatingPhone(false);
    }
  }

  async function handlePayApplication() {
    setError("");

    // Ensure phone is saved first
    if (!userProfile?.phone) {
      const trimmed = phone.trim();
      if (!trimmed) {
        setPhoneError("Phone number is required before payment.");
        return;
      }
      try {
        setUpdatingPhone(true);
        const token = await readAuthToken(getAuthHeaders);
        if (token) {
          await apiClient.updatePhone(trimmed, token);
        }
      } catch (err) {
        setPhoneError(err instanceof Error ? err.message : "Failed to save phone number.");
        setUpdatingPhone(false);
        return;
      } finally {
        setUpdatingPhone(false);
      }
    }

    try {
      setSubmitting(true);
      const token = await readAuthToken(getAuthHeaders);

      if (!token) {
        setError("You must be logged in to apply as an agent.");
        setSubmitting(false);
        return;
      }

      const result = await apiClient.createPaymentIntent(
        { purpose: "agent_application_fee" },
        token
      );

      window.location.href = result.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to initialize payment.");
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: "520px" }}>
        <Link href="/" className="auth-logo">
          <div className="logo-dot" />
          Better Data
        </Link>

        <div className="auth-header">
          <h1>Agent Application</h1>
          <p>Complete your application to become a Better Data agent</p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircleIcon />
            <span>{error}</span>
          </div>
        )}

        {/* Phone Section */}
        <div className="agent-apply-section">
          <h3 className="agent-apply-section-title">1. Confirm your phone number</h3>
          <div className="form-field">
            <label htmlFor="apply-phone">Phone Number <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              id="apply-phone"
              type="tel"
              placeholder="e.g. 054 123 4567"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
              className={phoneError ? "input-error" : ""}
              autoComplete="tel"
              disabled={!!userProfile?.phone}
            />
            {phoneError && <span className="field-error">{phoneError}</span>}
            {userProfile?.phone && (
              <span className="field-success">
                <CheckCircleIcon /> Phone confirmed
              </span>
            )}
          </div>
          {!userProfile?.phone && phone.trim() && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleUpdatePhone}
              disabled={updatingPhone}
              style={{ marginTop: "8px" }}
            >
              {updatingPhone ? "Saving..." : "Save Phone Number"}
            </button>
          )}
        </div>

        {/* Payment Section */}
        <div className="agent-apply-section">
          <h3 className="agent-apply-section-title">2. Pay onboarding fee</h3>
          <div className="agent-apply-fee-card">
            <div className="agent-apply-fee-row">
              <span>Application Fee</span>
              <strong>
                {pricing ? `GHS ${pricing.agentOnboardingFeeGhs.toFixed(2)}` : "Loading..."}
              </strong>
            </div>
            {pricing && pricing.agentDiscountPercentage > 0 && (
              <div className="agent-apply-fee-benefit">
                Upon approval, you will receive <strong>{pricing.agentDiscountPercentage}% off</strong> every data purchase.
              </div>
            )}
          </div>

          <div className="agent-apply-info-box" style={{ marginTop: "12px" }}>
            <p>
              Payment submits your application for review. Your account will be
              upgraded to agent status only after admin approval.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg btn-full"
            onClick={handlePayApplication}
            disabled={submitting || !pricing || (!userProfile?.phone && !phone.trim())}
            style={{ marginTop: "16px" }}
          >
            {submitting ? "Opening Paystack..." : `Pay GHS ${pricing?.agentOnboardingFeeGhs.toFixed(2) ?? "..."} with Mobile Money`}
          </button>

          <div className="widget-footer" style={{ marginTop: "12px" }}>
            <LockIcon />
            <span>Secured by Paystack Mobile Money.</span>
          </div>
        </div>

        <Link href="/agents" className="btn btn-ghost btn-full" style={{ marginTop: "8px" }}>
          ← Back to Agent Program
        </Link>
      </div>
    </div>
  );
}

async function readAuthToken(getAuthHeaders: () => Promise<HeadersInit>) {
  const headers = await getAuthHeaders();
  const authorization =
    headers instanceof Headers
      ? headers.get("authorization") ?? headers.get("Authorization")
      : Array.isArray(headers)
        ? headers.find(([key]) => key.toLowerCase() === "authorization")?.[1]
        : headers?.Authorization ?? headers?.authorization;

  return typeof authorization === "string"
    ? authorization.replace(/^Bearer\s+/i, "").trim() || null
    : null;
}
