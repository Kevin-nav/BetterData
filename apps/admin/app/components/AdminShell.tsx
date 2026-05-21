"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";

import { useAdminAuth } from "../lib/auth";
import { Sidebar } from "./Sidebar";

export function AdminShell({ children }: { children: ReactNode }) {
  const { loading, isAuthorized, firebaseUser } = useAdminAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Still checking auth state
  if (loading) {
    return (
      <div className="login-page">
        <div style={{ textAlign: "center" }}>
          <div className="sidebar-brand-dot" style={{ margin: "0 auto 16px", width: 40, height: 40, fontSize: "1rem" }}>
            BD
          </div>
          <p className="text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  // Not signed in — redirect to login
  if (!firebaseUser) {
    router.replace("/login");
    return null;
  }

  // Signed in but not authorized (not admin/superadmin)
  if (!isAuthorized) {
    return <UnauthorizedScreen />;
  }

  // Authorized — show the admin layout
  return (
    <div className="admin-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="admin-content">
        <div className="admin-topbar">
          <button
            className="btn btn-ghost btn-icon sidebar-mobile-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>
          <div />
        </div>

        <main className="admin-page">{children}</main>
      </div>
    </div>
  );
}

function UnauthorizedScreen() {
  const { email, signOut } = useAdminAuth();

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <div className="sidebar-brand-dot">BD</div>
            <span className="sidebar-brand-text">Better Data</span>
          </div>
          <h1 className="login-title">Access Denied</h1>
          <p className="login-subtitle">
            <strong>{email}</strong> does not have admin access.
          </p>
        </div>
        <div className="login-body">
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)", textAlign: "center" }}>
            Contact a superadmin to request admin access, or sign in with a
            different account.
          </p>
          <button className="btn btn-secondary" onClick={signOut} style={{ width: "100%" }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
