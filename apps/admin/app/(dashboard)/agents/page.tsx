"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { convexApi } from "@betterdata/app-api";
import { DataTable, type ColumnDef } from "../../components/DataTable";
import { StatusBadge } from "../../components/StatusBadge";
import { AgentApplicationReviewModal } from "../../components/AgentApplicationReviewModal";
import { useAdminAuth } from "../../lib/auth";

type AgentApplicationRow = {
  _id: string;
  userId: string;
  paymentReference?: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: number;
  user: {
    displayName?: string;
    email?: string;
    phone?: string;
    isSuspended: boolean;
  } | null;
  _creationTime: number;
};

type ActiveAgentRow = {
  _id: string;
  displayName?: string;
  email?: string;
  phone?: string;
  walletBalanceGhs: number;
  isSuspended: boolean;
  totalOrders: number;
  totalSpendGhs: number;
  _creationTime: number;
};

export default function AgentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"applications" | "agents">(
    "applications",
  );

  // Queries
  const {
    results: applications,
    status: applicationsStatus,
    loadMore: loadMoreApplications,
  } = usePaginatedQuery(
    convexApi.admin.listAgentApplicationsPage,
    {},
    { initialNumItems: 25 },
  ) as {
    results: AgentApplicationRow[] | undefined;
    status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
    loadMore: (numItems: number) => void;
  };
  const {
    results: agents,
    status: agentsStatus,
    loadMore: loadMoreAgents,
  } = usePaginatedQuery(convexApi.admin.listAgentsPage, {}, { initialNumItems: 25 }) as {
    results: ActiveAgentRow[] | undefined;
    status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
    loadMore: (numItems: number) => void;
  };

  // Shared review dialog state
  const [review, setReview] = useState<{
    app: AgentApplicationRow;
    action: "approve" | "reject";
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const appColumns: ColumnDef<AgentApplicationRow>[] = [
    {
      key: "displayName",
      header: "Applicant",
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>
            {row.user?.displayName || (
              <span className="text-muted italic">Unnamed User</span>
            )}
          </span>
          <div className="text-xs text-muted font-mono">{row.userId}</div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact Info",
      hiddenOnMobile: true,
      render: (row) => (
        <div>
          <div>{row.user?.email || "No Email"}</div>
          <div className="font-mono text-sm text-muted">
            {row.user?.phone || "No Phone"}
          </div>
        </div>
      ),
    },
    {
      key: "paymentReference",
      header: "Payment Ref",
      hiddenOnMobile: true,
      render: (row) => (
        <span className="font-mono text-sm">
          {row.paymentReference || <span className="text-muted">—</span>}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "_creationTime",
      header: "Applied Date",
      hiddenOnMobile: true,
      render: (row) => (
        <span className="text-muted text-sm">
          {new Date(row._creationTime).toLocaleString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        if (row.status !== "pending")
          return <span className="text-muted text-sm">Reviewed</span>;
        return (
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                setReview({ app: row, action: "approve" });
              }}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                setReview({ app: row, action: "reject" });
              }}
            >
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  const agentColumns: ColumnDef<ActiveAgentRow>[] = [
    {
      key: "displayName",
      header: "Agent Name",
      render: (row) => (
        <span style={{ fontWeight: 600, color: "var(--text)" }}>
          {row.displayName || (
            <span className="text-muted italic">Unnamed User</span>
          )}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      hiddenOnMobile: true,
      render: (row) => <span className="text-muted">{row.email || "N/A"}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      hiddenOnMobile: true,
      render: (row) => <span className="font-mono">{row.phone || "N/A"}</span>,
    },
    {
      key: "walletBalanceGhs",
      header: "Wallet Balance",
      render: (row) => (
        <strong style={{ color: "var(--primary)" }}>
          GHS {row.walletBalanceGhs.toFixed(2)}
        </strong>
      ),
    },
    {
      key: "totalOrders",
      header: "Orders Fulfilled",
      hiddenOnMobile: true,
      render: (row) => <span>{row.totalOrders}</span>,
    },
    {
      key: "totalSpendGhs",
      header: "Total Volume",
      render: (row) => <strong>GHS {row.totalSpendGhs.toFixed(2)}</strong>,
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
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Agent Management</h1>
          <p className="page-subtitle">
            Review applications and manage active resellers
          </p>
        </div>
      </div>

      {successMessage && (
        <div
          className="badge badge-success"
          style={{
            width: "100%",
            padding: "var(--space-3)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-4)",
          }}
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          className="badge badge-danger"
          style={{
            width: "100%",
            padding: "var(--space-3)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-4)",
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Tabs Selector */}
      <div className="tabs">
        <button
          className={`tab${activeTab === "applications" ? " tab-active" : ""}`}
          onClick={() => setActiveTab("applications")}
        >
          Pending Applications
        </button>
        <button
          className={`tab${activeTab === "agents" ? " tab-active" : ""}`}
          onClick={() => setActiveTab("agents")}
        >
          Active Agents
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          {activeTab === "applications" ? (
            <>
              <DataTable
                columns={appColumns}
                data={applications ?? []}
                isLoading={applicationsStatus === "LoadingFirstPage"}
                emptyStateTitle="No applications found"
                emptyStateDescription="There are no pending or reviewed agent applications."
                onRowClick={(row) => router.push(`/agents/${row.userId}`)}
                rowKey={(row) => row._id}
              />
              {(applicationsStatus === "CanLoadMore" ||
                applicationsStatus === "LoadingMore") && (
                <LoadMoreRow
                  loading={applicationsStatus === "LoadingMore"}
                  onClick={() => loadMoreApplications(25)}
                />
              )}
            </>
          ) : (
            <>
              <DataTable
                columns={agentColumns}
                data={agents ?? []}
                isLoading={agentsStatus === "LoadingFirstPage"}
                emptyStateTitle="No active agents"
                emptyStateDescription="No users have been promoted to agent status yet."
                onRowClick={(row) => router.push(`/agents/${row._id}`)}
                rowKey={(row) => row._id}
              />
              {(agentsStatus === "CanLoadMore" || agentsStatus === "LoadingMore") && (
                <LoadMoreRow
                  loading={agentsStatus === "LoadingMore"}
                  onClick={() => loadMoreAgents(25)}
                />
              )}
            </>
          )}
        </div>
      </div>

      <AgentApplicationReviewModal
        action={review?.action ?? null}
        application={
          review
            ? {
                _id: review.app._id,
                userId: review.app.userId,
                paymentReference: review.app.paymentReference,
              }
            : null
        }
        user={review?.app.user ?? null}
        onClose={() => setReview(null)}
        onSuccess={(message) => {
          setErrorMessage(null);
          setSuccessMessage(message);
          setReview(null);
        }}
        onError={(message) => {
          setSuccessMessage(null);
          setErrorMessage(message);
        }}
      />
    </div>
  );
}

function LoadMoreRow({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginTop: "var(--space-4)",
      }}
    >
      <button
        type="button"
        className="btn btn-secondary"
        disabled={loading}
        onClick={onClick}
      >
        {loading ? "Loading..." : "Load More"}
      </button>
    </div>
  );
}

