"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";
import { createBetterDataApiClient, type Notification } from "@betterdata/api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiClient = createBetterDataApiClient({ baseUrl: API_BASE_URL });

function getNotificationIcon(type: string, title: string) {
  const isSuccess = title.toLowerCase().includes("success") || title.toLowerCase().includes("approve");
  const isFailure = title.toLowerCase().includes("failed") || title.toLowerCase().includes("reject") || title.toLowerCase().includes("error");

  switch (type) {
    case "order_status":
      if (isSuccess) {
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px" }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      }
      if (isFailure) {
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px" }}>
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px" }} className="spin-icon">
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>
      );
    case "wallet_update":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px" }}>
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" /><path d="M16 8h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
        </svg>
      );
    case "announcement":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px" }}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "agent_update":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px" }}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px" }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

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

const AgentIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
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
    getAuthHeaders,
  } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifySent, setVerifySent] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

  // Click outside to close notifications dropdown
  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClose = () => setNotificationsOpen(false);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [notificationsOpen]);

  const fetchNotifications = async () => {
    try {
      const headers = await getAuthHeaders();
      const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
      if (token) {
        const res = await apiClient.listNotifications(token);
        setNotifications(res.notifications);
        const unread = res.notifications.filter((n) => !n.readAt).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleMarkRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const headers = await getAuthHeaders();
      const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
      if (token) {
        await apiClient.markNotificationRead(id, token);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: Date.now() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const headers = await getAuthHeaders();
      const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
      if (token) {
        await apiClient.markAllNotificationsRead(token);
        const now = Date.now();
        setNotifications((prev) => prev.map((n) => ({ ...n, readAt: now })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark all notifications read", err);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const headers = await getAuthHeaders();
      const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
      if (token) {
        await apiClient.deleteNotification(id, token);
        const target = notifications.find((n) => n.id === id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (target && !target.readAt) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
      }
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    setNotificationsOpen(false);
    if (!notification.readAt) {
      try {
        const headers = await getAuthHeaders();
        const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
        if (token) {
          await apiClient.markNotificationRead(notification.id, token);
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, readAt: Date.now() } : n))
          );
          setUnreadCount((c) => Math.max(0, c - 1));
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (notification.type === "order_status") {
      router.push("/dashboard/history");
    } else if (notification.type === "wallet_update") {
      router.push("/dashboard/wallet");
    } else if (notification.type === "agent_update") {
      router.push("/dashboard/agent");
    } else {
      router.push("/dashboard/notifications");
    }
  };

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
    { label: "Buy Data", href: "/dashboard/buy", icon: BuyIcon },
    { label: "Order History", href: "/dashboard/history", icon: HistoryIcon },
    { label: "Saved Numbers", href: "/dashboard/saved-numbers", icon: SavedIcon },
    { label: "My Wallet", href: "/dashboard/wallet", icon: WalletIcon },
    { label: "Profile & Settings", href: "/dashboard/profile", icon: ProfileIcon },
    {
      label: userProfile?.role === "agent" ? "Agent Status" : "Become an Agent",
      href: "/dashboard/agent",
      icon: AgentIcon,
    },
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
            {/* Notifications Dropdown Container */}
            <div className="notifications-dropdown-container" style={{ position: "relative" }}>
              <button
                className="notification-bell"
                aria-label="Notifications"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.innerWidth < 768) {
                    router.push("/dashboard/notifications");
                  } else {
                    setNotificationsOpen(!notificationsOpen);
                  }
                }}
              >
                <BellIcon />
                {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
              </button>

              {notificationsOpen && (
                <div className="notifications-dropdown" onClick={(e) => e.stopPropagation()}>
                  <div className="dropdown-header">
                    <h3>Notifications</h3>
                    {unreadCount > 0 && (
                      <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="dropdown-body">
                    {loadingNotifications ? (
                      <div className="loading-state">
                        <div className="spinner" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="empty-state">All caught up! No notifications.</div>
                    ) : (
                      <div className="notifications-list-mini">
                        {notifications.slice(0, 5).map((notif) => (
                          <div
                            key={notif.id}
                            className={`notification-item-mini ${!notif.readAt ? "unread" : ""}`}
                            onClick={() => handleNotificationClick(notif)}
                          >
                            <div className={`notification-icon ${notif.type}`}>
                              {getNotificationIcon(notif.type, notif.title)}
                            </div>
                            <div className="notification-content">
                              <div className="notification-title-bar">
                                <span className="notification-title">{notif.title}</span>
                                {!notif.readAt && <span className="unread-dot-pulse" />}
                              </div>
                              <div className="notification-body">{notif.body}</div>
                              <div className="notification-time">{formatRelativeTime(notif.createdAt)}</div>
                            </div>
                            <div className="notification-actions">
                              {!notif.readAt && (
                                <button
                                  className="action-btn read"
                                  title="Mark as read"
                                  onClick={(e) => handleMarkRead(e, notif.id)}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px" }}><polyline points="20 6 9 17 4 12"/></svg>
                                </button>
                              )}
                              <button
                                className="action-btn delete"
                                title="Delete"
                                onClick={(e) => handleDeleteNotification(e, notif.id)}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px" }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="dropdown-footer">
                    <Link href="/dashboard/notifications" onClick={() => setNotificationsOpen(false)}>
                      View all notifications &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>

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
