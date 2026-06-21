"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";
import { createBetterDataApiClient } from "@betterdata/api-client";
import type { AgentPricingConfig, Order } from "@betterdata/contracts";

/* ── Icons ── */
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px", marginRight: "6px" }}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EmptyBoxIcon = () => (
  <span className="empty-state-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "32px", height: "32px", stroke: "var(--text-secondary)" }}>
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  </span>
);

const GiftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px", marginRight: "8px", verticalAlign: "middle" }}>
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);

const SignalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px", stroke: "currentColor" }}>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const WalletIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px", stroke: "currentColor" }}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const ClipboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px", stroke: "currentColor" }}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px", stroke: "currentColor" }}>
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiClient = createBetterDataApiClient({ baseUrl: API_BASE_URL });

export default function DashboardHomePage() {
  const router = useRouter();
  const { userProfile, getAuthHeaders } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [agentPricing, setAgentPricing] = useState<AgentPricingConfig | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Time-based greeting helper
  const greeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return "Good morning";
    if (hrs < 17) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const headers = await getAuthHeaders();
        const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
        const ordersPromise = token
          ? apiClient.listOrders(token)
          : Promise.resolve(null);
        const pricingPromise = userProfile?.role === "agent"
          ? apiClient.getAgentPricingConfig().catch(() => null)
          : Promise.resolve(null);
        const [ordersResult, pricingResult] = await Promise.all([
          ordersPromise,
          pricingPromise
        ]);

        if (ordersResult) {
          setOrders(ordersResult.orders.slice(0, 5));
        }
        setAgentPricing(pricingResult);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoadingOrders(false);
      }
    }

    fetchDashboardData();
  }, [getAuthHeaders, userProfile?.role]);

  const userDisplayName = userProfile?.displayName || userProfile?.email?.split("@")[0] || "User";

  return (
    <div>
      {/* Welcome Greeting */}
      <div className="welcome-banner">
        <h2>{greeting()}, {userDisplayName}</h2>
        <p>Here is what is happening with your account today.</p>
      </div>

      {/* First Purchase Discount Banner */}
      {userProfile && !userProfile.firstPurchaseDiscountUsed && (
        <Link href="/dashboard/buy" className="auth-discount-banner" style={{ textDecoration: "none", display: "flex", cursor: "pointer", borderRadius: "var(--radius-xl)" }}>
          <GiftIcon />
          <span>
            You have a <strong>welcome discount</strong> waiting! Use it on your first data bundle purchase. <strong style={{ textDecoration: "underline" }}>Buy Data Now &rarr;</strong>
          </span>
        </Link>
      )}

      {userProfile?.role === "agent" && (
        <div className="agent-home-discount-card">
          <div>
            <span className="agent-home-kicker">Agent pricing active</span>
            <h3>{agentPricing?.agentDiscountPercentage ?? 0}% discount on data bundles</h3>
            <p>Your approved agent rate is applied automatically at checkout.</p>
          </div>
          <Link href="/dashboard/buy" className="btn btn-primary">
            Buy at Agent Rate
          </Link>
        </div>
      )}

      {/* Wallet Balance Card */}
      <div className="wallet-card">
        <div className="wallet-info">
          <div className="wallet-label">Wallet Balance</div>
          <div className="wallet-balance">
            <span>GHS</span>
            {(userProfile?.walletBalanceGhs ?? 0).toFixed(2)}
          </div>
        </div>
        <div className="wallet-actions">
          <Link href="/dashboard/wallet" className="btn btn-primary">
            <PlusIcon /> Top Up Wallet
          </Link>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <section className="quick-actions-section">
        <h3 className="quick-actions-title">Quick Actions</h3>
        <div className="quick-actions-grid">
          <Link href="/dashboard/buy" className="quick-action-card">
            <div className="quick-action-icon buy" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <SignalIcon />
            </div>
            <div className="quick-action-info">
              <div className="quick-action-name">Buy Data</div>
              <div className="quick-action-desc">MTN, Telecel, AirtelTigo</div>
            </div>
          </Link>
          <Link href="/dashboard/wallet" className="quick-action-card">
            <div className="quick-action-icon wallet" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <WalletIcon />
            </div>
            <div className="quick-action-info">
              <div className="quick-action-name">Top Up</div>
              <div className="quick-action-desc">Add money via MoMo</div>
            </div>
          </Link>
          <Link href="/dashboard/history" className="quick-action-card">
            <div className="quick-action-icon history" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardIcon />
            </div>
            <div className="quick-action-info">
              <div className="quick-action-name">History</div>
              <div className="quick-action-desc">View data transactions</div>
            </div>
          </Link>
          <Link href="/dashboard/saved-numbers" className="quick-action-card">
            <div className="quick-action-icon saved" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <PhoneIcon />
            </div>
            <div className="quick-action-info">
              <div className="quick-action-name">Saved Numbers</div>
              <div className="quick-action-desc">Manage saved contacts</div>
            </div>
          </Link>
        </div>
      </section>

      {/* Recent Orders Section */}
      <section className="recent-orders-section">
        <div className="section-header-flex">
          <h3 className="section-title">Recent Purchases</h3>
          {orders.length > 0 && (
            <Link href="/dashboard/history" className="section-link">
              View All &rarr;
            </Link>
          )}
        </div>

        {loadingOrders ? (
          <div className="orders-list">
            {[1, 2, 3].map((n) => (
              <div key={n} className="order-row-item">
                <div className="pkg-skeleton" style={{ width: "38px", height: "38px", borderRadius: "50%" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "120px" }}>
                  <div className="pkg-skeleton" style={{ height: "14px", width: "100%" }} />
                  <div className="pkg-skeleton" style={{ height: "10px", width: "70%" }} />
                </div>
                <div className="pkg-skeleton" style={{ height: "16px", width: "40px", justifySelf: "end" }} />
                <div className="pkg-skeleton" style={{ height: "22px", width: "70px", justifySelf: "end" }} />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state-card">
            <EmptyBoxIcon />
            <div className="empty-state-text">
              No orders found. Buy your first data bundle package to get started!
            </div>
            <Link href="/dashboard/buy" className="btn btn-primary" style={{ marginTop: "12px" }}>
              Buy Data
            </Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const displayNetwork =
                order.network === "mtn"
                  ? "MTN"
                  : order.network === "telecel"
                    ? "Telecel"
                    : "AirtelTigo";

              const relativeDate = new Date(order.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={order.reference} className="order-row-item">
                  <div className={`network-dot-avatar ${order.network}`}>
                    {displayNetwork[0]}
                  </div>
                  <div className="order-recipient-info">
                    <div className="order-phone">{order.recipientPhone}</div>
                    <div className="order-meta-info">
                      {displayNetwork} • {relativeDate}
                    </div>
                  </div>
                  <div className="order-amount-col">
                    <span>GHS</span>
                    {order.amountGhs.toFixed(2)}
                  </div>
                  <div>
                    <span className={`status-pill ${order.status}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
