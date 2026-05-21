"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBetterDataApiClient } from "@betterdata/api-client";
import type { NetworkCode, SavedNumber } from "@betterdata/contracts";
import { useAuth } from "../../lib/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiClient = createBetterDataApiClient({ baseUrl: API_BASE_URL });

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "32px", height: "32px", stroke: "var(--text-secondary)" }}>
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

function detectNetwork(number: string): NetworkCode {
  const clean = number.replace(/\D/g, "").replace(/^233/, "0");
  if (/^(024|054|055|059|025|053)/.test(clean)) return "mtn";
  if (/^(020|050)/.test(clean)) return "telecel";
  if (/^(026|056|027|057)/.test(clean)) return "airteltigo";
  return "mtn";
}

function displayNetworkName(network: NetworkCode) {
  return network === "mtn" ? "MTN" : network === "telecel" ? "Telecel" : "AirtelTigo";
}

export default function SavedNumbersPage() {
  const { getAuthHeaders } = useAuth();
  const [numbers, setNumbers] = useState<SavedNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSavedNumbers() {
      try {
        const token = await readAuthToken(getAuthHeaders);
        if (!token) {
          throw new Error("Authentication is required.");
        }

        const result = await apiClient.listSavedNumbers(token);
        if (active) setNumbers(result.numbers);
      } catch (err) {
        console.error(err);
        if (active) setError("Unable to load saved numbers.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSavedNumbers();
    return () => {
      active = false;
    };
  }, [getAuthHeaders]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!label.trim()) {
      setError("Please provide a name or label.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      setError("Please provide a phone number.");
      return;
    }

    if (!/^\+?233[235]\d{8}$|^0[235]\d{8}$/.test(phone.replace(/\s+/g, ""))) {
      setError("Enter a valid Ghanaian phone number, for example 0541234567.");
      return;
    }

    try {
      const token = await readAuthToken(getAuthHeaders);
      if (!token) {
        setError("You must be logged in to save numbers.");
        return;
      }

      const saved = await apiClient.saveSavedNumber({
        label: label.trim(),
        phone: cleanPhone,
        network: detectNetwork(cleanPhone)
      }, token);

      setNumbers((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setLabel("");
      setPhone("");
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save number.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this saved number?")) {
      return;
    }

    try {
      const token = await readAuthToken(getAuthHeaders);
      if (!token) {
        setError("You must be logged in to delete saved numbers.");
        return;
      }

      await apiClient.deleteSavedNumber(id, token);
      setNumbers((current) => current.filter((n) => n.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete number.");
    }
  }

  return (
    <div>
      <div className="section-header-flex" style={{ marginBottom: "24px" }}>
        <h2 className="section-title" style={{ fontSize: "1.5rem" }}>Saved Numbers</h2>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
            + Add Number
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="recent-orders-section" style={{ marginBottom: "24px", animation: "auth-card-in 0.3s ease" }}>
          <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: "16px" }}>Add New Saved Number</h3>

          {error && (
            <div className="auth-error" style={{ marginBottom: "16px" }}>
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: "1 1 200px", marginBottom: 0 }}>
              <label>Name / Label</label>
              <input
                type="text"
                placeholder="e.g. My Number, Mum, Bro"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="form-field" style={{ flex: "1 1 200px", marginBottom: 0 }}>
              <label>Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. 054 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Number
            </button>
          </div>
        </form>
      )}

      <div className="recent-orders-section">
        {!showAddForm && error && (
          <div className="auth-error" style={{ marginBottom: "16px" }}>
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="orders-list">
            {[1, 2].map((n) => (
              <div key={n} className="order-row-item">
                <div className="pkg-skeleton" style={{ width: "38px", height: "38px", borderRadius: "50%" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "120px" }}>
                  <div className="pkg-skeleton" style={{ height: "14px", width: "100%" }} />
                  <div className="pkg-skeleton" style={{ height: "10px", width: "60%" }} />
                </div>
                <div className="pkg-skeleton" style={{ height: "30px", width: "70px", justifySelf: "end" }} />
              </div>
            ))}
          </div>
        ) : numbers.length === 0 ? (
          <div className="empty-state-card">
            <span className="empty-state-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <PhoneIcon />
            </span>
            <div className="empty-state-text">
              You haven&apos;t saved any numbers yet. Save contacts to purchase data faster.
            </div>
            <button onClick={() => setShowAddForm(true)} className="btn btn-primary" style={{ marginTop: "12px" }}>
              Add Your First Number
            </button>
          </div>
        ) : (
          <div className="orders-list">
            {numbers.map((num) => {
              const network = num.network ?? detectNetwork(num.phone);
              const displayNetwork = displayNetworkName(network);

              return (
                <div key={num.id} className="order-row-item">
                  <div className={`network-dot-avatar ${network}`}>
                    {displayNetwork[0]}
                  </div>
                  <div className="order-recipient-info">
                    <div className="order-phone">{num.label}</div>
                    <div className="order-meta-info">
                      {formatPhone(num.phone)} - {displayNetwork}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", justifySelf: "end" }}>
                    <Link
                      href={`/dashboard/buy?phone=${encodeURIComponent(num.phone)}`}
                      className="btn btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                    >
                      Buy Data
                    </Link>
                    <button
                      onClick={() => void handleDelete(num.id)}
                      className="btn btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                    >
                      Delete
                    </button>
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

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return value;
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
