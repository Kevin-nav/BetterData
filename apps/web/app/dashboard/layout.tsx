"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";

/* ── Icons ── */
const HomeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const BuyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const HistoryIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="12 8 12 12 14 14" />
    <path d="M3.05 11a9 9 0 1 1 .3 4m-.3-4v-4m0 4h4" />
  </svg>
);

const WalletIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const SavedIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ProfileIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const BellIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const LogOutIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    loading,
    isAuthenticated,
    userProfile,
    signOut,
    isEmailVerified,
    isEmailPasswordProvider,
    resendVerification,
  } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifySent, setVerifySent] = useState(false);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!menuOpen) return;
    const handleClose = () => setMenuOpen(false);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [menuOpen]);

  if (loading || !isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", background: "var(--bg-root)" }}>
        <div className="pkg-skeleton" style={{ width: "60px", height: "60px", borderRadius: "50%", animation: "pulse-dot 1.2s infinite" }} />
      </div>
    );
  }

  const userInitials = userProfile?.displayName
    ? userProfile.displayName
        .split(" ")
        .map((n: string) => n[0] ?? "")
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : userProfile?.email
      ? (userProfile.email[0] ?? "U").toUpperCase()
      : "U";

  const navigationItems = [
    { label: "Dashboard", href: "/dashboard", icon: HomeIcon },
    { label: "Buy Data", href: "/buy", icon: BuyIcon },
    { label: "Order History", href: "/dashboard/history", icon: HistoryIcon },
    { label: "Saved Numbers", href: "/dashboard/saved-numbers", icon: SavedIcon },
    { label: "My Wallet", href: "/dashboard/wallet", icon: WalletIcon },
    { label: "Profile & Settings", href: "/dashboard/profile", icon: ProfileIcon },
  ];

  async function handleResendVerification() {
    try {
      setVerifying(true);
      await resendVerification();
      setVerifySent(true);
      setTimeout(() => setVerifySent(false), 8000);
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar (Desktop) */}
      <aside className="dashboard-sidebar">
        <Link href="/" className="sidebar-logo">
          <div className="logo-dot" />
          Better Data
        </Link>
        <nav className="dashboard-sidebar-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link${isActive ? " active" : ""}`}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button onClick={signOut} className="sidebar-link" style={{ width: "100%", background: "none", border: "none", textAlign: "left" }}>
            <LogOutIcon />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-title">
            {navigationItems.find((item) => item.href === pathname)?.label || "Dashboard"}
          </div>
          <div className="header-actions">
            <button className="notification-bell" aria-label="Notifications">
              <BellIcon />
              <span className="badge" />
            </button>

            {/* Profile Dropdown */}
            <div className="user-dropdown">
              <button
                className="user-menu-trigger"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              >
                <div className="user-avatar">{userInitials}</div>
                <span className="user-name-text user-mobile-hide" style={{ display: "inline-block" }}>
                  {userProfile?.displayName || userProfile?.email || "User"}
                </span>
                <ChevronDownIcon className="dropdown-chevron" />
              </button>
              {menuOpen && (
                <div className="user-dropdown-menu">
                  <Link href="/dashboard/profile" className="dropdown-item">
                    <ProfileIcon /> Profile
                  </Link>
                  <Link href="/dashboard/wallet" className="dropdown-item">
                    <WalletIcon /> Wallet
                  </Link>
                  <div className="line" style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />
                  <button onClick={signOut} className="dropdown-item logout">
                    <LogOutIcon /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="dashboard-content">
          {/* Email Verification Banner */}
          {isEmailPasswordProvider && !isEmailVerified && (
            <div className="verification-banner">
              <InfoIcon />
              <p>
                {verifySent
                  ? "Verification link sent! Check your inbox."
                  : "Please verify your email address to unlock full wallet and ordering access."}
              </p>
              {!verifySent && (
                <button onClick={handleResendVerification} disabled={verifying}>
                  {verifying ? "Sending..." : "Verify Email"}
                </button>
              )}
            </div>
          )}

          {children}
        </div>
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="bottom-nav">
        {navigationItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-nav-item${isActive ? " active" : ""}`}
            >
              <Icon />
              <span>{item.label === "Dashboard" ? "Home" : item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
