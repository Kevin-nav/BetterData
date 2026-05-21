"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { convexApi } from "@betterdata/app-api";
import { StatusBadge } from "../../../components/StatusBadge";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/Toast";

type AgentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = use(params);
  const { showToast } = useToast();

  // Queries
  const user = useQuery(convexApi.admin.getUser, { userId: id as any });
  const application = useQuery(convexApi.admin.getAgentApplication, { userId: id as any });
  const stats = useQuery(convexApi.admin.getAgentStats, { userId: id as any });

  // Mutations
  const approveApplication = useMutation(convexApi.admin.approveAgentApplication);
  const rejectApplication = useMutation(convexApi.admin.rejectAgentApplication);

  // Action Modals State
  const [modalAction, setModalAction] = useState<"approve" | "reject" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user === undefined || application === undefined) {
    return (
      <div style={{ padding: "var(--space-6)" }}>
        <div className="skeleton skeleton-heading" style={{ marginBottom: "var(--space-4)" }} />
        <div className="skeleton skeleton-card" style={{ height: "300px" }} />
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="card" style={{ padding: "var(--space-6)", textAlign: "center" }}>
        <h2 className="card-header-title" style={{ color: "var(--danger)" }}>User Not Found</h2>
        <p className="text-muted" style={{ margin: "var(--space-4) 0" }}>
          We couldn't find a user with ID: <strong>{id}</strong>
        </p>
        <Link href="/agents" className="btn btn-secondary">
          Back to Agents
        </Link>
      </div>
    );
  }

  const handleAction = async () => {
    if (!application || !modalAction) return;
    setIsSubmitting(true);
    try {
      if (modalAction === "approve") {
        await approveApplication({ applicationId: application._id as any });
        showToast("Agent application approved successfully.", "success");
      } else {
        const args: { applicationId: any; reason?: string } = {
          applicationId: application._id as any,
        };
        if (rejectReason.trim()) {
          args.reason = rejectReason.trim();
        }
        await rejectApplication(args);
        showToast("Agent application rejected.", "success");
      }
      setModalAction(null);
      setRejectReason("");
    } catch (err: any) {
      console.error("Action failed:", err);
      showToast(err.message || "An error occurred while processing the request.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-6)",
        }}
      >
        <div>
          <div style={{ marginBottom: "var(--space-2)" }}>
            <Link href="/agents" className="btn btn-secondary btn-sm" style={{ paddingLeft: 0, border: "none", background: "none" }}>
              &larr; Back to Agents
            </Link>
          </div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            Agent Profile
            <span className="font-mono text-muted text-sm" style={{ fontWeight: "normal" }}>
              {user.displayName || user.email || id}
            </span>
          </h1>
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Link href={`/users/${user._id}`} className="btn btn-secondary">
            View User Wallet & Profile
          </Link>
        </div>
      </div>



      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)", alignItems: "start" }}>
        {/* Left Column: Application Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">Application Status</h2>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {application ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="text-muted">Current Status</span>
                    <StatusBadge status={application.status} />
                  </div>

                  {application.paymentReference && (
                    <div>
                      <span className="text-muted text-sm" style={{ display: "block" }}>Onboarding Fee Payment Reference</span>
                      <span className="font-mono" style={{ fontWeight: 600 }}>{application.paymentReference}</span>
                    </div>
                  )}

                  <div>
                    <span className="text-muted text-sm" style={{ display: "block" }}>Applied On</span>
                    <span>{new Date(application._creationTime).toLocaleString()}</span>
                  </div>

                  {application.status !== "pending" && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                      <div>
                        <span className="text-muted text-sm" style={{ display: "block" }}>Reviewed By</span>
                        <span>{application.reviewer?.displayName || application.reviewer?.email || "System/Admin"}</span>
                      </div>
                      {application.reviewedAt && (
                        <div>
                          <span className="text-muted text-sm" style={{ display: "block" }}>Reviewed At</span>
                          <span>{new Date(application.reviewedAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {application.status === "pending" && (
                    <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        onClick={() => setModalAction("approve")}
                      >
                        Approve Application
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ flex: 1 }}
                        onClick={() => setModalAction("reject")}
                      >
                        Reject Application
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "var(--space-4)" }} className="text-muted italic">
                  No agent application record exists for this user.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Reseller Performance Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">Reseller Metrics</h2>
            </div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>Total Orders Count</span>
                <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>
                  {stats?.ordersCount ?? 0}
                </div>
              </div>
              <div>
                <span className="text-muted text-sm" style={{ display: "block" }}>Completed Orders</span>
                <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, color: "var(--success)" }}>
                  {stats?.totalOrders ?? 0}
                </div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <span className="text-muted text-sm" style={{ display: "block" }}>Total Volume Purchased</span>
                <div style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, color: "var(--primary)" }}>
                  GHS {stats?.totalSpendGhs.toFixed(2) ?? "0.00"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Approve/Reject Confirmation Modal */}
      <Modal
        isOpen={modalAction !== null}
        onClose={() => {
          if (!isSubmitting) {
            setModalAction(null);
            setRejectReason("");
          }
        }}
        title={modalAction === "approve" ? "Approve Agent" : "Reject Agent Application"}
        footer={
          <>
            <button
              className="btn btn-secondary"
              disabled={isSubmitting}
              onClick={() => {
                setModalAction(null);
                setRejectReason("");
              }}
            >
              Cancel
            </button>
            <button
              className={modalAction === "approve" ? "btn btn-primary" : "btn btn-danger"}
              disabled={isSubmitting}
              onClick={handleAction}
            >
              {isSubmitting ? "Processing..." : modalAction === "approve" ? "Confirm Approve" : "Confirm Reject"}
            </button>
          </>
        }
      >
        {application && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <p>
              Are you sure you want to <strong>{modalAction === "approve" ? "APPROVE" : "REJECT"}</strong> the agent application for{" "}
              <strong>{user.displayName || "this user"}</strong>?
            </p>

            {modalAction === "approve" ? (
              <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
                This updates their role to <strong>agent</strong>, which gives them access to cheaper reseller packages.
              </p>
            ) : (
              <div className="form-group">
                <label className="form-label" htmlFor="reason">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  id="reason"
                  className="textarea"
                  placeholder="Provide a reason for rejection..."
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
