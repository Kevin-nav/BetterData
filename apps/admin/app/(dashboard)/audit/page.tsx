"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { convexApi } from "@betterdata/app-api";
import { DataTable, type ColumnDef } from "../../components/DataTable";
import { Modal } from "../../components/Modal";

type AuditLog = {
  _id: string;
  _creationTime: number;
  actorId?: string;
  action: string;
  target: string;
  metadata?: any;
  actor: {
    displayName?: string | undefined;
    email?: string | undefined;
    role: string;
  } | null;
};

const ACTION_TYPES = [
  { value: "create_announcement", label: "Create Announcement" },
  { value: "delete_announcement", label: "Delete Announcement" },
  { value: "promote_to_admin", label: "Promote to Admin" },
  { value: "demote_from_admin", label: "Demote from Admin" },
  { value: "suspend_user", label: "Suspend User" },
  { value: "unsuspend_user", label: "Unsuspend User" },
  { value: "credit_wallet", label: "Credit Wallet" },
  { value: "debit_wallet", label: "Debit Wallet" },
  { value: "approve_agent_application", label: "Approve Agent" },
  { value: "reject_agent_application", label: "Reject Agent" },
  { value: "upsert_pricing_rule", label: "Upsert Pricing Rule" },
  { value: "delete_pricing_rule", label: "Delete Pricing Rule" },
  { value: "acknowledge_alert", label: "Acknowledge Alert" },
  { value: "resolve_alert", label: "Resolve Alert" },
];

function formatActionName(action: string): string {
  const match = ACTION_TYPES.find((t) => t.value === action);
  if (match) return match.label;
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function AuditLogsPage() {
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch audit logs with action filter
  const queryArgs: { action?: string } = {};
  if (selectedAction) {
    queryArgs.action = selectedAction;
  }

  const logs = useQuery(convexApi.admin.listAuditLogs, queryArgs);

  const columns: ColumnDef<AuditLog>[] = [
    {
      key: "_creationTime",
      header: "Timestamp",
      hiddenOnMobile: true,
      render: (row) => (
        <span className="text-muted text-sm font-mono">
          {new Date(row._creationTime).toLocaleString()}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (row) => {
        if (!row.actor) {
          return <span className="text-muted italic">System / Unknown</span>;
        }
        return (
          <div>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>
              {row.actor.displayName || "Unnamed Admin"}
            </div>
            <div className="text-xs text-muted font-mono">
              {row.actor.email}
            </div>
          </div>
        );
      },
    },
    {
      key: "action",
      header: "Action",
      render: (row) => {
        let badgeClass = "badge-info";
        if (
          row.action.startsWith("promote") ||
          row.action.startsWith("approve")
        ) {
          badgeClass = "badge-success";
        } else if (
          row.action.startsWith("demote") ||
          row.action.startsWith("suspend") ||
          row.action.startsWith("delete")
        ) {
          badgeClass = "badge-danger";
        } else if (
          row.action.startsWith("credit") ||
          row.action.startsWith("debit")
        ) {
          badgeClass = "badge-warning";
        }

        return (
          <span className={`badge ${badgeClass}`}>
            {formatActionName(row.action)}
          </span>
        );
      },
    },
    {
      key: "target",
      header: "Target Entity",
      hiddenOnMobile: true,
      render: (row) => (
        <span className="font-mono text-sm text-muted">{row.target}</span>
      ),
    },
    {
      key: "details",
      header: "Metadata",
      render: (row) => (
        <button
          onClick={() => setSelectedLog(row)}
          className="btn btn-secondary btn-sm"
        >
          View JSON
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">System Audit Logs</h1>
          <p className="page-subtitle">
            Security and administration activity log trail
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div
          className="card-body flex-responsive-row"
          style={{
            alignItems: "flex-end",
          }}
        >
          <div className="form-group" style={{ margin: 0, minWidth: "240px", flex: 1 }}>
            <label
              className="form-label"
              htmlFor="actionFilter"
              style={{ marginBottom: "var(--space-1)" }}
            >
              Filter by Action Type
            </label>
            <select
              id="actionFilter"
              className="select"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
            >
              <option value="">All Action Types</option>
              {ACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {selectedAction && (
            <button
              onClick={() => setSelectedAction("")}
              className="btn btn-ghost"
              style={{ height: "40px" }}
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <DataTable
            columns={columns}
            data={logs ?? []}
            isLoading={logs === undefined}
            emptyStateTitle="No audit logs recorded"
            emptyStateDescription="Activity events will be populated as admin actions occur."
            rowKey={(row) => row._id}
          />
        </div>
      </div>

      {/* Metadata JSON Modal */}
      <Modal
        isOpen={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title="Audit Log Details"
        footer={
          <button
            onClick={() => setSelectedLog(null)}
            className="btn btn-primary"
          >
            Close
          </button>
        }
      >
        {selectedLog && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr",
                gap: "var(--space-2)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                Log ID:
              </span>
              <span className="font-mono">{selectedLog._id}</span>

              <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                Timestamp:
              </span>
              <span>
                {new Date(selectedLog._creationTime).toLocaleString()}
              </span>

              <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                Actor:
              </span>
              <span>
                {selectedLog.actor
                  ? `${selectedLog.actor.displayName || "Admin"} (${selectedLog.actor.email})`
                  : "System / Unknown"}
              </span>

              <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                Action:
              </span>
              <span
                className="badge badge-info"
                style={{ display: "inline-block", width: "fit-content" }}
              >
                {formatActionName(selectedLog.action)}
              </span>

              <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                Target ID:
              </span>
              <span className="font-mono">{selectedLog.target}</span>
            </div>

            <div>
              <span
                style={{
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: "var(--space-2)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Metadata Payload:
              </span>
              <pre
                style={{
                  background: "var(--bg-inset)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-3)",
                  overflowX: "auto",
                  fontSize: "var(--font-size-xs)",
                  color: "var(--text)",
                  fontFamily: "monospace",
                  margin: 0,
                }}
              >
                {JSON.stringify(selectedLog.metadata || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
