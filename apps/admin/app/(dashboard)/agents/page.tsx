"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { convexApi } from "@betterdata/app-api";
import { DataTable, type ColumnDef } from "../../components/DataTable";
import { StatusBadge } from "../../components/StatusBadge";
import { Modal } from "../../components/Modal";

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
  const applications = useQuery(convexApi.admin.listAgentApplications, {}) as
    | AgentApplicationRow[]
    | undefined;
  const agents = useQuery(convexApi.admin.listAgents) as
    | ActiveAgentRow[]
    | undefined;

  // Mutations
  const approveApplication = useMutation(
    convexApi.admin.approveAgentApplication,
  );
  const rejectApplication = useMutation(convexApi.admin.rejectAgentApplication);

  // Action Modals State
  const [selectedApp, setSelectedApp] = useState<AgentApplicationRow | null>(
    null,
  );
  const [modalAction, setModalAction] = useState<"approve" | "reject" | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAction = async () => {
    if (!selectedApp || !modalAction) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (modalAction === "approve") {
        await approveApplication({ applicationId: selectedApp._id as any });
        setSuccessMessage(
          `Application for ${selectedApp.user?.displayName || "user"} approved successfully.`,
        );
      } else {
        const args: { applicationId: any; reason?: string } = {
          applicationId: selectedApp._id as any,
        };
        if (rejectReason.trim()) {
          args.reason = rejectReason.trim();
        }
        await rejectApplication(args);
        setSuccessMessage(
          `Application for ${selectedApp.user?.displayName || "user"} rejected.`,
        );
      }
      setSelectedApp(null);
      setModalAction(null);
      setRejectReason("");
    } catch (err: any) {
      console.error("Action failed:", err);
      setErrorMessage(
        err.message || "An error occurred while processing the request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
                setSelectedApp(row);
                setModalAction("approve");
              }}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedApp(row);
                setModalAction("reject");
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
          Pending Applications (
          {applications?.filter((a) => a.status === "pending").length || 0})
        </button>
        <button
          className={`tab${activeTab === "agents" ? " tab-active" : ""}`}
          onClick={() => setActiveTab("agents")}
        >
          Active Agents ({agents?.length || 0})
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          {activeTab === "applications" ? (
            <DataTable
              columns={appColumns}
              data={applications ?? []}
              isLoading={applications === undefined}
              emptyStateTitle="No applications found"
              emptyStateDescription="There are no pending or reviewed agent applications."
              onRowClick={(row) => router.push(`/users/${row.userId}`)}
              rowKey={(row) => row._id}
            />
          ) : (
            <DataTable
              columns={agentColumns}
              data={agents ?? []}
              isLoading={agents === undefined}
              emptyStateTitle="No active agents"
              emptyStateDescription="No users have been promoted to agent status yet."
              onRowClick={(row) => router.push(`/users/${row._id}`)}
              rowKey={(row) => row._id}
            />
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={selectedApp !== null && modalAction !== null}
        onClose={() => {
          if (!isSubmitting) {
            setSelectedApp(null);
            setModalAction(null);
            setRejectReason("");
          }
        }}
        title={
          modalAction === "approve"
            ? "Approve Agent Application"
            : "Reject Agent Application"
        }
        footer={
          <>
            <button
              className="btn btn-secondary"
              disabled={isSubmitting}
              onClick={() => {
                setSelectedApp(null);
                setModalAction(null);
                setRejectReason("");
              }}
            >
              Cancel
            </button>
            <button
              className={
                modalAction === "approve" ? "btn btn-primary" : "btn btn-danger"
              }
              disabled={isSubmitting}
              onClick={handleAction}
            >
              {isSubmitting
                ? "Processing..."
                : modalAction === "approve"
                  ? "Approve Agent"
                  : "Reject Application"}
            </button>
          </>
        }
      >
        {selectedApp && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <p>
              Are you sure you want to{" "}
              <strong>
                {modalAction === "approve" ? "APPROVE" : "REJECT"}
              </strong>{" "}
              the agent application for{" "}
              <strong>{selectedApp.user?.displayName || "this user"}</strong>?
            </p>
            <div
              style={{
                background: "var(--bg-inset)",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <div>Email: {selectedApp.user?.email || "N/A"}</div>
              <div>Phone: {selectedApp.user?.phone || "N/A"}</div>
              {selectedApp.paymentReference && (
                <div>Payment Ref: {selectedApp.paymentReference}</div>
              )}
            </div>

            {modalAction === "approve" ? (
              <p
                className="text-muted"
                style={{ fontSize: "var(--font-size-sm)" }}
              >
                Approving this application will change the user's role to{" "}
                <strong>agent</strong> and grant them access to wholesale bundle
                rates.
              </p>
            ) : (
              <div className="form-group">
                <label className="form-label" htmlFor="reject-reason">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  id="reject-reason"
                  className="textarea"
                  placeholder="Provide a reason for rejection (e.g., Unverified payment reference)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
