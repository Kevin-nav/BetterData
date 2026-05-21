"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { convexApi } from "@betterdata/app-api";
import { DataTable, type ColumnDef } from "../../components/DataTable";
import { SearchFilter, type FilterSpec } from "../../components/SearchFilter";
import { StatusBadge } from "../../components/StatusBadge";
import type { UserRole } from "@betterdata/config";

type UserRow = {
  _id: string;
  firebaseUid?: string;
  email?: string;
  phone?: string;
  displayName?: string;
  role: UserRole;
  isSuspended: boolean;
  walletBalanceGhs: number;
  _creationTime: number;
};

export default function UsersListPage() {
  const router = useRouter();

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" | "active" | "suspended"

  // Dynamically build query arguments to satisfy exactOptionalPropertyTypes: true
  const queryArgs: {
    role?: UserRole;
    isSuspended?: boolean;
    search?: string;
  } = {};

  if (roleFilter) {
    queryArgs.role = roleFilter as UserRole;
  }
  if (statusFilter === "active") {
    queryArgs.isSuspended = false;
  } else if (statusFilter === "suspended") {
    queryArgs.isSuspended = true;
  }
  if (search) {
    queryArgs.search = search;
  }

  const {
    results: users,
    status,
    loadMore,
  } = usePaginatedQuery(
    convexApi.admin.listUsers,
    queryArgs,
    { initialNumItems: 25 }
  );

  const isLoading = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";
  const hasMore = status === "CanLoadMore";

  // Filter Specifications
  const filters: FilterSpec[] = [
    {
      key: "role",
      label: "Role",
      value: roleFilter,
      onChange: setRoleFilter,
      options: [
        { value: "user", label: "User" },
        { value: "agent", label: "Agent" },
        { value: "admin", label: "Admin" },
        { value: "superadmin", label: "Superadmin" },
      ],
    },
    {
      key: "status",
      label: "Status",
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: "active", label: "Active" },
        { value: "suspended", label: "Suspended" },
      ],
    },
  ];

  const handleClearFilters = () => {
    setRoleFilter("");
    setStatusFilter("");
    setSearch("");
  };

  // DataTable Columns
  const columns: ColumnDef<UserRow>[] = [
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
      render: (row) => (
        <span className="text-muted">{row.email || "N/A"}</span>
      ),
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
        <span
          className="badge"
          style={{
            textTransform: "capitalize",
            fontWeight: 600,
            background:
              row.role === "admin" || row.role === "superadmin"
                ? "var(--danger-light)"
                : row.role === "agent"
                  ? "var(--primary-light)"
                  : "var(--bg-inset)",
            color:
              row.role === "admin" || row.role === "superadmin"
                ? "var(--danger)"
                : row.role === "agent"
                  ? "var(--primary)"
                  : "var(--text-secondary)",
          }}
        >
          {row.role}
        </span>
      ),
    },
    {
      key: "walletBalanceGhs",
      header: "Wallet Balance",
      render: (row) => (
        <strong style={{ color: "var(--text)" }}>
          GHS {row.walletBalanceGhs.toFixed(2)}
        </strong>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge
          status={row.isSuspended ? "failed" : "completed"}
          label={row.isSuspended ? "Suspended" : "Active"}
        />
      ),
    },
    {
      key: "_creationTime",
      header: "Joined Date",
      render: (row) => (
        <span className="text-muted text-sm">
          {new Date(row._creationTime).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage system users, agents, administrators, and their wallets</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <SearchFilter
            placeholder="Search by name, email, or phone number..."
            search={search}
            onSearchChange={setSearch}
            filters={filters}
            onClear={handleClearFilters}
          />

          <DataTable
            columns={columns}
            data={users as UserRow[]}
            isLoading={isLoading}
            emptyStateTitle="No users found"
            emptyStateDescription="Try adjusting your filters or search query."
            onRowClick={(row) => router.push(`/users/${row._id}`)}
            rowKey={(row) => row._id}
          />

          {hasMore && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "var(--space-4)",
              }}
            >
              <button
                className="btn btn-secondary"
                disabled={isLoadingMore}
                onClick={() => loadMore(25)}
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
