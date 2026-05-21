"use client";

import { useState } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { convexApi } from "@betterdata/app-api";
import { useAdminAuth } from "../../lib/auth";
import { PaymentConfigEditor } from "../../components/PaymentConfigEditor";
import { DataTable, type ColumnDef } from "../../components/DataTable";
import { useToast } from "../../components/Toast";
import type { UserRole } from "@betterdata/config";

type AdminUser = {
  _id: string;
  displayName?: string;
  email?: string;
  phone?: string;
  role: UserRole;
  isSuspended: boolean;
};

export default function SettingsPage() {
  const { scope } = useAdminAuth();
  const isSuper = scope === "superadmin";
  const { showToast } = useToast();

  // State for Admin Search & Management
  const [searchQuery, setSearchQuery] = useState("");
  const [isPromoting, setIsPromoting] = useState<string | null>(null);
  const [isDemoting, setIsDemoting] = useState<string | null>(null);

  // Mutations
  const promoteToAdmin = useMutation(convexApi.admin.promoteToAdmin);
  const demoteFromAdmin = useMutation(convexApi.admin.demoteFromAdmin);

  // Queries
  // 1. Current Admins list
  const currentAdmins = useQuery(convexApi.admin.listAdmins);

  // 2. Search query for potential users to promote
  const searchArgs: { search?: string } = {};
  if (searchQuery.trim().length >= 3) {
    searchArgs.search = searchQuery;
  }
  const { results: searchResults, status: searchStatus } = usePaginatedQuery(
    convexApi.admin.listUsers,
    searchArgs,
    { initialNumItems: 10 }
  );

  const handlePromote = async (userId: string) => {
    try {
      setIsPromoting(userId);
      await promoteToAdmin({ userId: userId as any });
      setSearchQuery("");
      showToast("User successfully promoted to administrator role.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to promote user to admin.", "error");
    } finally {
      setIsPromoting(null);
    }
  };

  const handleDemote = async (userId: string) => {
    if (!confirm("Are you sure you want to demote this administrator? they will lose all admin privileges.")) {
      return;
    }
    try {
      setIsDemoting(userId);
      await demoteFromAdmin({ userId: userId as any });
      showToast("Administrator successfully demoted.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to demote admin.", "error");
    } finally {
      setIsDemoting(null);
    }
  };

  // Columns for Current Admins Table
  const adminColumns: ColumnDef<AdminUser>[] = [
    {
      key: "displayName",
      header: "Name",
      render: (row) => (
        <span style={{ fontWeight: 600, color: "var(--text)" }}>
          {row.displayName || <span className="text-muted italic">Unnamed User</span>}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (row) => <span className="text-muted">{row.email || "N/A"}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => <span className="font-mono">{row.phone || "N/A"}</span>,
    },
    {
      key: "role",
      header: "Role",
      render: (row) => (
        <span className="badge" style={{ textTransform: "capitalize" }}>
          {row.role}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        const isProtected = row.role === "superadmin";
        return (
          <button
            onClick={() => handleDemote(row._id)}
            disabled={isProtected || isDemoting === row._id}
            className="btn btn-ghost btn-sm text-danger"
            style={{ color: "var(--danger)" }}
          >
            {isProtected ? "Protected" : isDemoting === row._id ? "Demoting..." : "Demote"}
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Platform Settings</h1>
          <p className="page-subtitle">Configure system limits, payment thresholds, and administrative privileges</p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
      >
        {/* Platform Configuration (Payment Settings) */}
        <div>
          <PaymentConfigEditor />
        </div>

        {/* Admin User Management Section */}
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-header-subtitle">Administrative Scope</span>
              <h3 className="card-header-title">Admins & Superadmins</h3>
            </div>
          </div>
          <div className="card-body">
            {!isSuper ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "var(--space-8) var(--space-4)",
                  textAlign: "center",
                  background: "var(--bg-inset)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px dashed var(--border)",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  style={{ width: "40px", height: "40px", color: "var(--text-muted)", marginBottom: "var(--space-3)", opacity: 0.7 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "var(--space-1)" }}>
                  Superadmin Scope Required
                </div>
                <div className="text-muted text-sm" style={{ maxWidth: "340px" }}>
                  Admin user promotion and demotion actions are locked. Please contact a platform superadministrator if you need access.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                {/* Search / Promote area */}
                <div
                  style={{
                    background: "var(--bg-inset)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-4)",
                  }}
                >
                  <h4 style={{ margin: "0 0 var(--space-2) 0", fontSize: "var(--font-size-sm)", fontWeight: 600 }}>
                    Promote User to Admin
                  </h4>
                  <p className="text-xs text-muted" style={{ margin: "0 0 var(--space-3) 0" }}>
                    Search for an existing user by email, name, or phone (at least 3 characters).
                  </p>

                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Search by email, name, or phone number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => setSearchQuery("")}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {searchQuery.trim().length >= 3 && (
                    <div
                      style={{
                        marginTop: "var(--space-4)",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        maxHeight: "220px",
                        overflowY: "auto",
                      }}
                    >
                      {searchStatus === "LoadingFirstPage" ? (
                        <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--text-muted)" }}>
                          Searching users...
                        </div>
                      ) : !searchResults || searchResults.length === 0 ? (
                        <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--text-muted)" }}>
                          No users found matching query
                        </div>
                      ) : (
                        searchResults
                          .filter((u) => u.role !== "admin" && u.role !== "superadmin")
                          .map((user) => (
                            <div
                              key={user._id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "var(--space-3) var(--space-4)",
                                borderBottom: "1px solid var(--border)",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>
                                  {user.displayName || "Unnamed User"}
                                </div>
                                <div className="text-xs text-muted">
                                  {user.email || user.phone || "No email/phone"}
                                </div>
                              </div>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handlePromote(user._id)}
                                disabled={isPromoting === user._id}
                              >
                                {isPromoting === user._id ? "Promoting..." : "Promote"}
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>

                {/* Admins Table */}
                <div>
                  <h4 style={{ margin: "0 0 var(--space-3) 0", fontSize: "var(--font-size-md)", fontWeight: 600 }}>
                    Active Administrators
                  </h4>
                  <DataTable
                    columns={adminColumns}
                    data={(currentAdmins ?? []) as AdminUser[]}
                    isLoading={currentAdmins === undefined}
                    emptyStateTitle="No administrators found"
                    emptyStateDescription="There are no administrators in the system."
                    rowKey={(row) => row._id}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
