"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  UserCheck,
  Tag,
  Settings,
  Megaphone,
  ClipboardList,
  LogOut,
  X,
  Mail,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";

import { useAdminAuth } from "../lib/auth";

const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Users", href: "/users", icon: Users },
  { label: "Agents", href: "/agents", icon: UserCheck },
  { label: "Pricing", href: "/pricing", icon: Tag },
];

const SYSTEM_ITEMS = [
  { label: "Emails", href: "/emails", icon: Mail },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
  { label: "Audit Log", href: "/audit", icon: ClipboardList },
  { label: "Retry Queue", href: "/retries", icon: RefreshCcw },
  { label: "Availability", href: "/outage", icon: ShieldAlert },
];

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(" ")
      .filter((part) => part.length > 0)
      .map((part) => part[0]!)
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  if (email) {
    return email.charAt(0).toUpperCase();
  }

  return "A";
}

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { displayName, email, scope, signOut } = useAdminAuth();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-mobile-overlay${isOpen ? " visible" : ""}`}
        onClick={onClose}
      />

      <aside className={`sidebar${isOpen ? " sidebar-open" : ""}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-dot">BD</div>
          <div style={{ flex: 1 }}>
            <div className="sidebar-brand-text">Better Data</div>
            <div className="sidebar-brand-label">Admin</div>
          </div>
          <button
            className="btn btn-ghost btn-icon sidebar-close-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Main</div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive(item.href) ? " active" : ""}`}
              onClick={onClose}
            >
              <item.icon />
              {item.label}
            </Link>
          ))}

          <div className="sidebar-section-label">System</div>
          {SYSTEM_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive(item.href) ? " active" : ""}`}
              onClick={onClose}
            >
              <item.icon />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer — user info + sign out */}
        <div className="sidebar-footer">
          <div className="sidebar-avatar">
            {getInitials(displayName, email)}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {displayName ?? email ?? "Admin"}
            </div>
            <div className="sidebar-user-scope">{scope ?? "admin"}</div>
          </div>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={signOut}
            title="Sign out"
          >
            <LogOut />
          </button>
        </div>
      </aside>
    </>
  );
}
