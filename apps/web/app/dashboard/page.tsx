"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";
import { createBetterDataApiClient } from "@betterdata/api-client";
import type { Order } from "@betterdata/contracts";

/* ── Icons ── */
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px", marginRight: "6px" }}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EmptyBoxIcon = () => (
  <span className="empty-state-icon">📦</span>
);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiClient = createBetterDataApiClient({ baseUrl: API_BASE_URL });

export default function DashboardHomePage() {
  const router = useRouter();
  const { userProfile, getAuthHeaders } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Time-based greeting helper
  const greeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return "Good morning";
    if (hrs < 17) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    async function fetchRecentOrders() {
      try {
        const headers = await getAuthHeaders();
        const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
        if (token) {
          const res = await apiClient.listOrders(token);
          // Sort by creation time desc (should be sorted by backend, but safe)
          setOrders(res.orders.slice(0, 5));
        }
      } catch (err) {
        console.error("Failed to load recent orders", err);
      } finally {
        setLoadingOrders(false);
      }
    }

    fetchRecentOrders();
  }, [getAuthHeaders]);

  const userDisplayName = userProfile?.displayName || userProfile?.email?.split("@")[0] || "User";

  return (
    <div>
      {/* Welcome Greeting */}
      <div className="welcome-banner">
        <h2>{greeting()}, {userDisplayName} 👋</h2>
        <p>Here is what is happening with your account today.</p>
      </div>

      {/* First Purchase Discount Banner */}
      {userProfile && !userProfile.firstPurchaseDiscountUsed && (
        <Link href="/buy" className="auth-discount-banner" style={{ textDecoration: "none", display: "flex", cursor: "pointer", borderRadius: "var(--radius-xl)" }}>
          <span className="discount-emoji">🎉</span>
          <span>
            You have a <strong>welcome discount</strong> waiting! Use it on your first data bundle purchase. <strong style={{ textDecoration: "underline" }}>Buy Data Now &rarr;</strong>
          </span>
        </Link>
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
          <Link href="/buy" className="quick-action-card">
            <div className="quick-action-icon buy">📶</div>
            <div className="quick-action-info">
              <div className="quick-action-name">Buy Data</div>
              <div className="quick-action-desc">MTN, Telecel, AirtelTigo</div>
            </div>
          </Link>
          <Link href="/dashboard/wallet" className="quick-action-card">
            <div className="quick-action-icon wallet">💰</div>
            <div className="quick-action-info">
              <div className="quick-action-name">Top Up</div>
              <div className="quick-action-desc">Add money via MoMo</div>
            </div>
          </Link>
          <Link href="/dashboard/history" className="quick-action-card">
            <div className="quick-action-icon history">📋</div>
            <div className="quick-action-info">
              <div className="quick-action-name">History</div>
              <div className="quick-action-desc">View data transactions</div>
            </div>
          </Link>
          <Link href="/dashboard/saved-numbers" className="quick-action-card">
            <div className="quick-action-icon saved">📱</div>
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
            <Link href="/buy" className="btn btn-primary" style={{ marginTop: "12px" }}>
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
