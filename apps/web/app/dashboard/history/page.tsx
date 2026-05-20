"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/AuthContext";
import { createBetterDataApiClient } from "@betterdata/api-client";
import type { Order } from "@betterdata/contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiClient = createBetterDataApiClient({ baseUrl: API_BASE_URL });

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "32px", height: "32px", stroke: "var(--text-secondary)" }}>
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export default function OrderHistoryPage() {
  const { getAuthHeaders } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [networkFilter, setNetworkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function fetchOrders() {
      try {
        const headers = await getAuthHeaders();
        const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
        if (token) {
          const res = await apiClient.listOrders(token);
          setOrders(res.orders);
          setFilteredOrders(res.orders);
        }
      } catch (err) {
        console.error("Failed to load order history", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [getAuthHeaders]);

  // Apply filters
  useEffect(() => {
    let result = [...orders];

    if (networkFilter !== "all") {
      result = result.filter((o) => o.network === networkFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }

    setFilteredOrders(result);
  }, [networkFilter, statusFilter, orders]);

  return (
    <div>
      <div className="section-header-flex" style={{ marginBottom: "24px" }}>
        <h2 className="section-title" style={{ fontSize: "1.5rem" }}>Purchase History</h2>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div className="form-field" style={{ marginBottom: 0, flex: "1 1 180px" }}>
          <select
            value={networkFilter}
            onChange={(e) => setNetworkFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              color: "var(--text)",
              cursor: "pointer",
              outline: "none"
            }}
          >
            <option value="all">All Networks</option>
            <option value="mtn">MTN</option>
            <option value="telecel">Telecel</option>
            <option value="airteltigo">AirtelTigo</option>
          </select>
        </div>

        <div className="form-field" style={{ marginBottom: 0, flex: "1 1 180px" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              color: "var(--text)",
              cursor: "pointer",
              outline: "none"
            }}
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* List Container */}
      <div className="recent-orders-section">
        {loading ? (
          <div className="orders-list">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="order-row-item">
                <div className="pkg-skeleton" style={{ width: "38px", height: "38px", borderRadius: "50%" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "150px" }}>
                  <div className="pkg-skeleton" style={{ height: "14px", width: "100%" }} />
                  <div className="pkg-skeleton" style={{ height: "10px", width: "60%" }} />
                </div>
                <div className="pkg-skeleton" style={{ height: "16px", width: "50px", justifySelf: "end" }} />
                <div className="pkg-skeleton" style={{ height: "22px", width: "70px", justifySelf: "end" }} />
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state-card">
            <span className="empty-state-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <SearchIcon />
            </span>
            <div className="empty-state-text">
              No transactions match your search filter criteria.
            </div>
            {(networkFilter !== "all" || statusFilter !== "all") && (
              <button
                className="btn btn-secondary"
                onClick={() => { setNetworkFilter("all"); setStatusFilter("all"); }}
                style={{ marginTop: "12px" }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="orders-list">
            {filteredOrders.map((order) => {
              const displayNetwork =
                order.network === "mtn"
                  ? "MTN"
                  : order.network === "telecel"
                    ? "Telecel"
                    : "AirtelTigo";

              const relativeDate = new Date(order.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
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
      </div>
    </div>
  );
}
