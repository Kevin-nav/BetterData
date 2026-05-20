"use client";

import { useState } from "react";
import { useAuth } from "../../lib/AuthContext";

export default function ProfilePage() {
  const { userProfile, isEmailVerified, isEmailPasswordProvider, updateName } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || "");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!displayName.trim()) {
      setError("Display name cannot be empty.");
      return;
    }

    try {
      setSubmitting(true);
      await updateName(displayName.trim());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError("Failed to update profile name. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const userRole = userProfile?.role || "user";
  const userEmail = userProfile?.email || "No email linked";

  return (
    <div>
      <div className="section-header-flex" style={{ marginBottom: "24px" }}>
        <h2 className="section-title" style={{ fontSize: "1.5rem" }}>Profile & Settings</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px", alignItems: "start" }} className="profile-grid-responsive">
        {/* Left Side: Profile Details */}
        <div className="recent-orders-section">
          <h3 className="section-title" style={{ fontSize: "1.1rem", marginBottom: "20px" }}>Account Details</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Email Address
              </label>
              <div style={{ fontSize: "0.95rem", fontWeight: 500, marginTop: "4px" }}>{userEmail}</div>
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Role
              </label>
              <div style={{ marginTop: "4px" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    background: userRole === "admin" ? "rgba(168,85,247,0.1)" : userRole === "agent" ? "rgba(59,130,246,0.1)" : "var(--bg-input)",
                    color: userRole === "admin" ? "#a855f7" : userRole === "agent" ? "#3b82f6" : "var(--text-secondary)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {userRole}
                </span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Email Status
              </label>
              <div style={{ marginTop: "4px" }}>
                <span
                  className={`status-pill ${isEmailVerified ? "completed" : "failed"}`}
                  style={{ fontSize: "0.76rem", padding: "4px 8px" }}
                >
                  {isEmailVerified ? "Verified" : "Unverified"}
                </span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Sign In Provider
              </label>
              <div style={{ fontSize: "0.95rem", fontWeight: 500, marginTop: "4px" }}>
                {isEmailPasswordProvider ? "Email & Password" : "Google Sign-In"}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Update Profile Info */}
        <div className="recent-orders-section">
          <h3 className="section-title" style={{ fontSize: "1.1rem", marginBottom: "20px" }}>Personal Details</h3>

          {error && (
            <div className="auth-error" style={{ marginBottom: "16px" }}>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="auth-success" style={{ marginBottom: "16px" }}>
              <span>Profile updated successfully!</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile}>
            <div className="form-field">
              <label htmlFor="profile-display-name">Display Name</label>
              <input
                id="profile-display-name"
                type="text"
                placeholder="Your Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ marginTop: "12px" }}
            >
              {submitting ? "Updating..." : "Save Settings"}
            </button>
          </form>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          .profile-grid-responsive {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
        }
      `}</style>
    </div>
  );
}
