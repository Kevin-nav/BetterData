"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "32px", height: "32px", stroke: "var(--text-secondary)" }}>
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

type SavedNumber = {
  id: string;
  label: string;
  phone: string;
  network: "mtn" | "telecel" | "airteltigo";
};

/* ── Network Detection Helper ── */
function detectNetwork(number: string): "mtn" | "telecel" | "airteltigo" {
  const clean = number.replace(/\s+/g, "").replace(/^\+233/, "0");
  if (/^(024|054|055|059|025|053)/.test(clean)) return "mtn";
  if (/^(020|050)/.test(clean)) return "telecel";
  if (/^(026|056|027|057)/.test(clean)) return "airteltigo";
  return "mtn"; // Default to MTN
}

export default function SavedNumbersPage() {
  const [numbers, setNumbers] = useState<SavedNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form inputs
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("betterdata_saved_numbers");
    if (saved) {
      try {
        setNumbers(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    } else {
      // Seed initial mock numbers for presentation/wow factor
      const mockNumbers: SavedNumber[] = [
        { id: "1", label: "My MTN Number", phone: "054 123 4567", network: "mtn" },
        { id: "2", label: "Mum's Telecel", phone: "020 987 6543", network: "telecel" },
      ];
      setNumbers(mockNumbers);
      localStorage.setItem("betterdata_saved_numbers", JSON.stringify(mockNumbers));
    }
    setLoading(false);
  }, []);

  function saveNumbers(updatedList: SavedNumber[]) {
    setNumbers(updatedList);
    localStorage.setItem("betterdata_saved_numbers", JSON.stringify(updatedList));
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!label.trim()) {
      setError("Please provide a name/label.");
      return;
    }

    const cleanPhone = phone.replace(/\s+/g, "");
    if (!cleanPhone) {
      setError("Please provide a phone number.");
      return;
    }

    if (!/^\+?233[25]\d{8}$|^0[25]\d{8}$/.test(cleanPhone)) {
      setError("Enter a valid Ghanaian phone number (e.g. 0541234567).");
      return;
    }

    const newNumber: SavedNumber = {
      id: Date.now().toString(),
      label: label.trim(),
      phone: phone.trim(),
      network: detectNetwork(cleanPhone),
    };

    const updated = [newNumber, ...numbers];
    saveNumbers(updated);

    // Reset form
    setLabel("");
    setPhone("");
    setShowAddForm(false);
  }

  function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this saved number?")) {
      const updated = numbers.filter((n) => n.id !== id);
      saveNumbers(updated);
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
              You haven&apos;t saved any numbers yet. Save contacts to purchase data even faster!
            </div>
            <button onClick={() => setShowAddForm(true)} className="btn btn-primary" style={{ marginTop: "12px" }}>
              Add Your First Number
            </button>
          </div>
        ) : (
          <div className="orders-list">
            {numbers.map((num) => {
              const displayNetwork =
                num.network === "mtn"
                  ? "MTN"
                  : num.network === "telecel"
                    ? "Telecel"
                    : "AirtelTigo";

              return (
                <div key={num.id} className="order-row-item">
                  <div className={`network-dot-avatar ${num.network}`}>
                    {displayNetwork[0]}
                  </div>
                  <div className="order-recipient-info">
                    <div className="order-phone">{num.label}</div>
                    <div className="order-meta-info">
                      {num.phone} • {displayNetwork}
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
                      onClick={() => handleDelete(num.id)}
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
