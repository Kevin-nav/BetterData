"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { createBetterDataApiClient, type WalletTransaction } from "@betterdata/api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function WalletPage() {
  const { getAuthHeaders, refreshProfile } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Top Up form state
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState("");

  useEffect(() => {
    async function loadWalletSummary() {
      try {
        const headers = await getAuthHeaders();
        const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
        if (token) {
          const client = createBetterDataApiClient({
            baseUrl: API_BASE_URL,
            headers: { Authorization: `Bearer ${token}` }
          });
          const res = await client.getWalletSummary(token);
          setBalance(res.balanceGhs);
          setTransactions(res.transactions);
        }
      } catch (err) {
        console.error("Failed to load wallet", err);
      } finally {
        setLoading(false);
      }
    }

    loadWalletSummary();
  }, [getAuthHeaders]);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    setTopUpError("");

    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      setTopUpError("Enter a valid amount greater than zero GHS.");
      return;
    }

    try {
      setTopUpLoading(true);
      const headers = await getAuthHeaders();
      const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");

      if (!token) {
        setTopUpError("You must be logged in to perform this action.");
        return;
      }

      const client = createBetterDataApiClient({
        baseUrl: API_BASE_URL,
        headers: { Authorization: `Bearer ${token}` }
      });

      const res = await client.createPaymentIntent({
        purpose: "wallet_top_up",
        amountGhs: amount
      });

      // Redirect user to Paystack to complete payment
      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      } else {
        setTopUpError("Failed to initiate payment. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setTopUpError("Unable to initiate top up. Please try again.");
    } finally {
      setTopUpLoading(false);
    }
  }

  return (
    <div>
      <div className="section-header-flex" style={{ marginBottom: "24px" }}>
        <h2 className="section-title" style={{ fontSize: "1.5rem" }}>My Wallet</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px", alignItems: "start" }} className="wallet-grid-responsive">
        {/* Left Side: Balance Visual & Top-Up Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Balance card */}
          <div className="wallet-card" style={{ marginBottom: 0 }}>
            <div className="wallet-info">
              <div className="wallet-label">Current Balance</div>
              <div className="wallet-balance">
                <span>GHS</span>
                {loading ? "..." : balance.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Top-up Form Card */}
          <div className="recent-orders-section">
            <h3 className="section-title" style={{ fontSize: "1.1rem", marginBottom: "16px" }}>Top Up Wallet</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
              Add money instantly to your wallet using Mobile Money (MTN, Telecel, AirtelTigo).
            </p>

            {topUpError && (
              <div className="auth-error" style={{ marginBottom: "16px" }}>
                <span>{topUpError}</span>
              </div>
            )}

            <form onSubmit={handleTopUp}>
              <div className="form-field">
                <label htmlFor="topup-amount">Amount (GHS)</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontWeight: 600, color: "var(--text-secondary)" }}>
                    GH₵
                  </span>
                  <input
                    id="topup-amount"
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 50"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    style={{ paddingLeft: "42px" }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={topUpLoading}
                style={{ marginTop: "12px" }}
              >
                {topUpLoading ? "Redirecting to Payment..." : "Fund Wallet"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Wallet Transaction History */}
        <div className="recent-orders-section">
          <h3 className="section-title" style={{ fontSize: "1.1rem", marginBottom: "20px" }}>Transaction History</h3>

          {loading ? (
            <div className="orders-list">
              {[1, 2, 3].map((n) => (
                <div key={n} className="order-row-item">
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "150px" }}>
                    <div className="pkg-skeleton" style={{ height: "14px", width: "100%" }} />
                    <div className="pkg-skeleton" style={{ height: "10px", width: "60%" }} />
                  </div>
                  <div className="pkg-skeleton" style={{ height: "16px", width: "50px", justifySelf: "end" }} />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="empty-state-card">
              <span className="empty-state-icon">💸</span>
              <div className="empty-state-text">
                No wallet transactions found. Fill your account balance to buy data.
              </div>
            </div>
          ) : (
            <div className="orders-list">
              {transactions.map((tx) => {
                const isCredit = tx.type === "top_up" || tx.type === "refund" || tx.type === "admin_credit";
                const displayType = tx.type === "top_up" ? "Top Up" : tx.type === "purchase" ? "Data Purchase" : tx.type;

                const relativeDate = new Date(tx.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div key={tx.id} className="order-row-item" style={{ gridTemplateColumns: "1fr auto" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{tx.description || displayType}</div>
                      <div className="order-meta-info" style={{ marginTop: "2px" }}>
                        Ref: {tx.reference.substring(0, 8)}... • {relativeDate}
                      </div>
                    </div>
                    <div className="order-amount-col" style={{ color: isCredit ? "#22c55e" : "var(--text)" }}>
                      {isCredit ? "+" : "-"}<span>GHS</span>
                      {tx.amountGhs.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          .wallet-grid-responsive {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
        }
      `}</style>
    </div>
  );
}
