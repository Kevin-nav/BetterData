"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/AuthContext";
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
          <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px" }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      }
      if (isFailure) {
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px" }}>
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px" }} className="spin-icon">
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>
      );
    case "wallet_update":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px" }}>
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" /><path d="M16 8h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
        </svg>
      );
    case "announcement":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px" }}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "agent_update":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px" }}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px" }}>
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

type FilterType = "all" | "unread" | "orders" | "wallet" | "announcements";

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      const headers = await getAuthHeaders();
      const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
      if (token) {
        const res = await apiClient.listNotifications(token);
        setNotifications(res.notifications);
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [isAuthenticated]);

  const handleMarkRead = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
      if (token) {
        await apiClient.markNotificationRead(id, token);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: Date.now() } : n))
        );
      }
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const handleMarkAllRead = async () => {
    setActionLoading(true);
    try {
      const headers = await getAuthHeaders();
      const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
      if (token) {
        await apiClient.markAllNotificationsRead(token);
        const now = Date.now();
        setNotifications((prev) => prev.map((n) => ({ ...n, readAt: now })));
      }
    } catch (err) {
      console.error("Failed to mark all read", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const token = (headers as Record<string, string>)["Authorization"]?.replace("Bearer ", "");
      if (token) {
        await apiClient.deleteNotification(id, token);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.readAt) {
      await handleMarkRead(notif.id);
    }
    if (notif.type === "order_status") {
      router.push("/dashboard/history");
    } else if (notif.type === "wallet_update") {
      router.push("/dashboard/wallet");
    } else if (notif.type === "agent_update") {
      router.push("/dashboard/agent");
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.readAt;
    if (filter === "orders") return n.type === "order_status";
    if (filter === "wallet") return n.type === "wallet_update";
    if (filter === "announcements") return n.type === "announcement";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="notifications-page-container">
      <div className="page-header-flex">
        <div>
          <h2 className="page-title-main">Notification Center</h2>
          <p className="page-subtitle-main">
            Manage your updates, order transactions, and account alerts.
            {unreadCount > 0 && (
              <span className="unread-badge-text">
                {unreadCount} unread update{unreadCount > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleMarkAllRead}
            disabled={actionLoading}
          >
            {actionLoading ? "Clearing..." : "Mark all read"}
          </button>
        )}
      </div>

      {/* Filters Pilled Bar */}
      <div className="filters-bar-pills">
        {(["all", "unread", "orders", "wallet", "announcements"] as const).map((type) => {
          const isActive = filter === type;
          const label = type === "all"
            ? "All"
            : type === "unread"
              ? `Unread (${unreadCount})`
              : type === "orders"
                ? "Orders"
                : type === "wallet"
                  ? "Wallet"
                  : "Announcements";
          return (
            <button
              key={type}
              className={`filter-pill ${isActive ? "active" : ""}`}
              onClick={() => setFilter(type)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div className="notifications-page-list">
        {loading ? (
          <div className="loading-state-page">
            {[1, 2, 3].map((n) => (
              <div key={n} className="notification-skeleton">
                <div className="skeleton-circle" />
                <div className="skeleton-lines">
                  <div className="skeleton-line title" />
                  <div className="skeleton-line body" />
                  <div className="skeleton-line time" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="empty-state-page-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "48px", height: "48px" }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <div className="empty-title">All Caught Up!</div>
            <p className="empty-desc">There are no notifications matching the selected filter.</p>
            <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: "12px" }}>
              Back to Home
            </Link>
          </div>
        ) : (
          <div className="notifications-items-grid">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`notification-card-item ${!notif.readAt ? "unread" : ""}`}
                onClick={() => handleNotificationClick(notif)}
              >
                <div className={`notification-icon-container ${notif.type}`}>
                  {getNotificationIcon(notif.type, notif.title)}
                </div>
                <div className="notification-details">
                  <div className="notif-title-row">
                    <h4 className="notif-title">{notif.title}</h4>
                    {!notif.readAt && <span className="unread-dot" />}
                  </div>
                  <p className="notif-body">{notif.body}</p>
                  <span className="notif-time">{formatRelativeTime(notif.createdAt)}</span>
                </div>
                <div className="notification-item-actions">
                  {!notif.readAt && (
                    <button
                      className="btn-action mark-read"
                      title="Mark as read"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(notif.id);
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                  )}
                  <button
                    className="btn-action delete"
                    title="Delete notification"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNotification(notif.id);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
