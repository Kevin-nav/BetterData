"use client";

import { use, useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { convexApi } from "@betterdata/app-api";
import { StatusBadge } from "../../../components/StatusBadge";
import { AgentApplicationReviewModal } from "../../../components/AgentApplicationReviewModal";
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

  // Action Modal State
  const [modalAction, setModalAction] = useState<"approve" | "reject" | null>(null);

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

  return (
    <div>
      {/* Header */}
      <div className="flex-responsive-header">
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



      <div className="grid-responsive-1-1">
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
            <div className="card-body grid-responsive-1-1" style={{ gap: "var(--space-4)" }}>
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
                  GHS {(stats?.totalSpendGhs ?? 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Approve/Reject Confirmation Modal */}
      <AgentApplicationReviewModal
        action={modalAction}
        application={
          application
            ? {
                _id: application._id as any,
                userId: id,
                paymentReference: application.paymentReference,
              }
            : null
        }
        user={user}
        onClose={() => setModalAction(null)}
        onSuccess={(message) => {
          showToast(message, "success");
          setModalAction(null);
        }}
        onError={(message) => {
          showToast(message, "error");
        }}
      />
    </div>
  );
}
