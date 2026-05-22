"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBetterDataApiClient } from "@betterdata/api-client";
import type { AgentPricingConfig, AgentApplicationStatus } from "@betterdata/contracts";
import { useAuth } from "../../lib/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiClient = createBetterDataApiClient({ baseUrl: API_BASE_URL });

/* ── Icons ── */
const ClockIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const XCircleIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const StarIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default function DashboardAgentPage() {
  const { userProfile, getAuthHeaders, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const paymentRef = searchParams?.get("ref");

  const [pricing, setPricing] = useState<AgentPricingConfig | null>(null);
  const [application, setApplication] = useState<AgentApplicationStatus | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [reconcilingPayment, setReconcilingPayment] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const pricingData = await apiClient.getAgentPricingConfig();
        if (active) setPricing(pricingData);
      } catch {
        /* pricing unavailable */
      }

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

      if (active) setLoadingData(false);
    }

    void load();
    return () => { active = false; };
  }, [getAuthHeaders]);

  useEffect(() => {
    if (!paymentRef || application !== null) {
      return;
    }

    let active = true;
    const reference = paymentRef;

    async function reconcileAgentPayment() {
      setReconcilingPayment(true);

      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const status = await apiClient.getPaymentIntentStatus(reference);

          if (!active) {
            return;
          }

          if (status.purpose !== "agent_application_fee") {
            setReconcilingPayment(false);
            return;
          }

          if (status.status === "failed" || status.status === "abandoned") {
            setReconcilingPayment(false);
            return;
          }

          const token = await readAuthToken(getAuthHeaders);

          if (token) {
            const appData = await apiClient.getMyAgentApplication(token);
            if (!active) {
              return;
            }

            if (appData !== null) {
              setApplication(appData);
              await refreshProfile();
              setReconcilingPayment(false);
              return;
            }
          }
        } catch {
          /* Paystack callbacks can arrive before webhooks settle. */
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      if (active) {
        setReconcilingPayment(false);
      }
    }

    void reconcileAgentPayment();

    return () => {
      active = false;
    };
  }, [application, getAuthHeaders, paymentRef, refreshProfile]);

  const isAgent = userProfile?.role === "agent";

  if (loadingData) {
    return (
      <div>
        <div className="welcome-banner">
          <h2>Agent Program</h2>
          <p>Loading your agent status...</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "24px" }}>
          <div className="pkg-skeleton" style={{ height: "120px", borderRadius: "var(--radius-xl)" }} />
          <div className="pkg-skeleton" style={{ height: "80px", borderRadius: "var(--radius-xl)" }} />
        </div>
      </div>
    );
  }

  // ── Active Agent ──
  if (isAgent) {
    return (
      <div>
        <div className="welcome-banner">
          <h2>Agent Status</h2>
          <p>You are an active Better Data agent.</p>
        </div>

        <div className="agent-dash-status-card approved">
          <div className="agent-dash-status-icon"><CheckCircleIcon /></div>
          <div className="agent-dash-status-content">
            <h3>Agent Active</h3>
            <p>Your account has agent privileges. You receive discounted rates on all data purchases.</p>
          </div>
        </div>

        {pricing && pricing.agentDiscountPercentage > 0 && (
          <div className="agent-dash-discount-banner">
            <strong>{pricing.agentDiscountPercentage}% discount</strong> is applied automatically on every data purchase.
          </div>
        )}

        <div className="quick-actions-grid" style={{ marginTop: "24px" }}>
          <Link href="/dashboard/buy" className="quick-action-card">
            <div className="quick-action-icon buy" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px" }}>
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            </div>
            <div className="quick-action-info">
              <div className="quick-action-name">Buy Data</div>
              <div className="quick-action-desc">At discounted agent prices</div>
            </div>
          </Link>
          <Link href="/dashboard/history" className="quick-action-card">
            <div className="quick-action-icon history" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px" }}>
                <polyline points="12 8 12 12 14 14" /><path d="M3.05 11a9 9 0 1 1 .3 4m-.3-4v-4m0 4h4" />
              </svg>
            </div>
            <div className="quick-action-info">
              <div className="quick-action-name">Order History</div>
              <div className="quick-action-desc">View your transactions</div>
            </div>
          </Link>
        </div>
      </div>
    );
  }

  // ── Pending ──
  if (application?.status === "pending") {
    const ref = paymentRef || application.paymentReference;
    return (
      <div>
        <div className="welcome-banner">
          <h2>Agent Application</h2>
          <p>Your application is being reviewed.</p>
        </div>

        <div className="agent-dash-status-card pending">
          <div className="agent-dash-status-icon"><ClockIcon /></div>
          <div className="agent-dash-status-content">
            <h3>Under Review</h3>
            <p>
              Your agent application and payment have been received. Our team will
              review your application and notify you once a decision has been made.
            </p>
            {ref && (
              <div className="agent-dash-ref">
                <span>Payment Reference:</span>
                <code>{ref}</code>
              </div>
            )}
          </div>
        </div>

        {paymentRef && (
          <div className="agent-dash-success-toast">
            Payment confirmed! Your application is now queued for review.
          </div>
        )}
      </div>
    );
  }

  // ── Rejected ──
  if (application?.status === "rejected") {
    return (
      <div>
        <div className="welcome-banner">
          <h2>Agent Application</h2>
          <p>Application status update.</p>
        </div>

        <div className="agent-dash-status-card rejected">
          <div className="agent-dash-status-icon"><XCircleIcon /></div>
          <div className="agent-dash-status-content">
            <h3>Not Approved</h3>
            <p>
              Your agent application was not approved at this time. If you believe this
              was an error, please reach out to our support team for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── No Application ──
  if (paymentRef && reconcilingPayment) {
    return (
      <div>
        <div className="welcome-banner">
          <h2>Confirming Agent Payment</h2>
          <p>We are confirming your payment and application status.</p>
        </div>

        <div className="agent-dash-status-card pending">
          <div className="agent-dash-status-icon"><ClockIcon /></div>
          <div className="agent-dash-status-content">
            <h3>Payment received by Paystack</h3>
            <p>
              We are waiting for final payment confirmation before marking your
              application as under review. This usually takes a few seconds.
            </p>
            <div className="agent-dash-ref">
              <span>Payment Reference:</span>
              <code>{paymentRef}</code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="welcome-banner">
        <h2>Become an Agent</h2>
        <p>Access discounted data rates and serve your community.</p>
      </div>

      <div className="agent-dash-promo-card">
        <div className="agent-dash-promo-icon"><StarIcon /></div>
        <div className="agent-dash-promo-content">
          <h3>Agent Program</h3>
          <p>
            Apply to become a Better Data agent and unlock
            {pricing ? ` ${pricing.agentDiscountPercentage}% discounts` : " exclusive discounts"} on
            every data bundle purchase. Perfect for resellers, community leaders, and
            anyone looking to provide affordable data to others.
          </p>
          <div className="agent-dash-promo-pricing">
            {pricing && (
              <>
                <div className="agent-dash-promo-pill">
                  One-time fee: <strong>GHS {pricing.agentOnboardingFeeGhs.toFixed(2)}</strong>
                </div>
                <div className="agent-dash-promo-pill accent">
                  Discount: <strong>{pricing.agentDiscountPercentage}% off</strong> all purchases
                </div>
              </>
            )}
          </div>
          <Link href="/agents/apply" className="btn btn-primary btn-lg" style={{ marginTop: "16px" }}>
            Apply Now
          </Link>
        </div>
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
