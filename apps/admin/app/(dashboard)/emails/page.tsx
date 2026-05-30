"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { convexApi } from "@betterdata/app-api";
import { DataTable, type ColumnDef } from "../../components/DataTable";
import { SearchFilter, type FilterSpec } from "../../components/SearchFilter";
import { StatusBadge } from "../../components/StatusBadge";
import { Modal } from "../../components/Modal";

type SentEmailRow = {
  _id: string;
  userId?: string;
  toEmail: string;
  subject: string;
  type:
    | "welcome"
    | "first_purchase"
    | "wallet_top_up"
    | "agent_application_received"
    | "agent_application_approved"
    | "reengagement"
    | "broadcast"
    | "manual";
  status: "sent" | "failed";
  errorMessage?: string;
  sentAt: number;
};

export default function SentEmailsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<SentEmailRow | null>(null);

  // Dynamically build query args
  const queryArgs: {
    type?: SentEmailRow["type"];
    search?: string;
  } = {};

  if (typeFilter) {
    queryArgs.type = typeFilter as SentEmailRow["type"];
  }
  if (search) {
    queryArgs.search = search;
  }

  const {
    results: emails,
    status,
    loadMore,
  } = usePaginatedQuery(
    convexApi.emails.listSentEmails,
    queryArgs,
    { initialNumItems: 25 }
  );

  const isLoading = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";
  const hasMore = status === "CanLoadMore";

  const filters: FilterSpec[] = [
    {
      key: "type",
      label: "Email Type",
      value: typeFilter,
      onChange: setTypeFilter,
      options: [
        { value: "welcome", label: "Welcome Signup" },
        { value: "first_purchase", label: "First Purchase" },
        { value: "wallet_top_up", label: "Wallet Top-Up" },
        { value: "agent_application_received", label: "Agent Applied" },
        { value: "agent_application_approved", label: "Agent Approved" },
        { value: "reengagement", label: "Re-engagement (3w)" },
        { value: "broadcast", label: "Broadcast" },
        { value: "manual", label: "Manual" },
      ],
    },
  ];

  const handleClearFilters = () => {
    setTypeFilter("");
    setSearch("");
  };

  const columns: ColumnDef<SentEmailRow>[] = [
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge
          status={row.status === "sent" ? "completed" : "failed"}
          label={row.status === "sent" ? "Sent" : "Failed"}
        />
      ),
    },
    {
      key: "toEmail",
      header: "Recipient",
      render: (row) => (
        <span style={{ fontWeight: 600, color: "var(--text)" }}>
          {row.toEmail}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => {
        let label = row.type.replace("_", " ");
        let color = "var(--text-secondary)";
        let bg = "var(--bg-inset)";

        switch (row.type) {
          case "welcome":
            label = "Welcome";
            color = "var(--success)";
            bg = "rgba(34, 197, 94, 0.1)";
            break;
          case "first_purchase":
            label = "First Purchase";
            color = "var(--primary)";
            bg = "rgba(37, 99, 235, 0.1)";
            break;
          case "wallet_top_up":
            label = "Top-Up";
            color = "#0ea5e9";
            bg = "rgba(14, 165, 233, 0.1)";
            break;
          case "agent_application_received":
            label = "Agent Received";
            color = "#ca8a04";
            bg = "rgba(202, 138, 4, 0.1)";
            break;
          case "agent_application_approved":
            label = "Agent Approved";
            color = "#8b5cf6";
            bg = "rgba(139, 92, 246, 0.1)";
            break;
          case "reengagement":
            label = "Re-engagement";
            color = "#ec4899";
            bg = "rgba(236, 72, 153, 0.1)";
            break;
          case "broadcast":
            label = "Broadcast";
            color = "#f97316";
            bg = "rgba(249, 115, 22, 0.1)";
            break;
        }

        return (
          <span
            className="badge"
            style={{
              textTransform: "capitalize",
              fontWeight: 600,
              color,
              background: bg,
            }}
          >
            {label}
          </span>
        );
      },
    },
    {
      key: "subject",
      header: "Subject",
      render: (row) => <span className="text-muted">{row.subject}</span>,
    },
    {
      key: "sentAt",
      header: "Date Sent",
      render: (row) => (
        <span className="text-muted text-sm">
          {new Date(row.sentAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Email Dispatch Logs</h1>
          <p className="page-subtitle">Track system automated emails, campaign broadcasts, and delivery status</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <SearchFilter
            placeholder="Search by recipient or subject..."
            search={search}
            onSearchChange={setSearch}
            filters={filters}
            onClear={handleClearFilters}
          />

          <DataTable
            columns={columns}
            data={emails as SentEmailRow[]}
            isLoading={isLoading}
            emptyStateTitle="No emails tracked"
            emptyStateDescription="Verify if your Resend environment variables and email dispatches are triggering correctly."
            onRowClick={(row) => setSelectedEmail(row)}
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

      {/* Details modal */}
      <Modal
        isOpen={selectedEmail !== null}
        onClose={() => setSelectedEmail(null)}
        title="Email Details"
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedEmail(null)}>
            Close
          </button>
        }
      >
        {selectedEmail && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "var(--space-3)" }}>
              <span className="text-muted text-sm" style={{ display: "block" }}>Recipient Address</span>
              <strong>{selectedEmail.toEmail}</strong>
            </div>
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "var(--space-3)" }}>
              <span className="text-muted text-sm" style={{ display: "block" }}>Subject</span>
              <span>{selectedEmail.subject}</span>
            </div>
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "var(--space-3)", display: "flex", justifyContent: "space-between" }}>
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>Email Type</span>
                <span className="badge" style={{ textTransform: "capitalize" }}>{selectedEmail.type.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>Sent Time</span>
                <span>{new Date(selectedEmail.sentAt).toLocaleString()}</span>
              </div>
            </div>
            <div>
              <span className="text-muted text-sm" style={{ display: "block" }}>Delivery Status</span>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
                <StatusBadge
                  status={selectedEmail.status === "sent" ? "completed" : "failed"}
                  label={selectedEmail.status === "sent" ? "Successfully Dispatched via Resend" : "Dispatch Failed"}
                />
              </div>
            </div>
            {selectedEmail.errorMessage && (
              <div style={{ backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid var(--danger)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                <span className="text-muted text-sm" style={{ display: "block", color: "var(--danger)", fontWeight: 600, marginBottom: "var(--space-1)" }}>Error Log</span>
                <code style={{ fontSize: "var(--font-size-xs)", wordBreak: "break-all" }}>{selectedEmail.errorMessage}</code>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
