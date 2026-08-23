"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { convexApi } from "@betterdata/app-api";
import { StatusBadge } from "../../../components/StatusBadge";
import { Modal } from "../../../components/Modal";
import { JsonViewer } from "../../../components/JsonViewer";

type OrderDetailPageProps = {
  params: Promise<{ reference: string }>;
};

type TimelineStep = {
  label: string;
  done: boolean;
  current: boolean;
  error?: boolean;
  neutral?: boolean;
};

type OpsAlert = {
  _id: string;
  reference?: string;
  message: string;
  category: string;
  createdAt: number;
};

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { reference } = use(params);

  // Queries
  const order = useQuery(convexApi.admin.getOrderByReference, { reference });
  const openAlerts = useQuery(convexApi.admin.listOpenAlerts) as
    | OpsAlert[]
    | undefined;

  // Mutations
  const refundOrderMutation = useMutation(convexApi.admin.refundOrder);

  // UI States
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundNotes, setRefundNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (order === undefined) {
    return (
      <div style={{ padding: "var(--space-6)" }}>
        <div
          className="skeleton skeleton-heading"
          style={{ marginBottom: "var(--space-4)" }}
        />
        <div className="skeleton skeleton-card" style={{ height: "300px" }} />
      </div>
    );
  }

  if (order === null) {
    return (
      <div
        className="card"
        style={{ padding: "var(--space-6)", textAlign: "center" }}
      >
        <h2 className="card-header-title" style={{ color: "var(--danger)" }}>
          Order Not Found
        </h2>
        <p className="text-muted" style={{ margin: "var(--space-4) 0" }}>
          We couldn't find an order with reference: <strong>{reference}</strong>
        </p>
        <Link href="/orders" className="btn btn-secondary">
          Back to Orders
        </Link>
      </div>
    );
  }

  // Extract user safely to avoid TS refinement loss
  const user = order.user;

  // Filter alerts related to this order reference
  const relatedAlerts =
    openAlerts?.filter((alert) => alert.reference === reference) || [];

  const handleRefund = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const args: { orderId: typeof order._id; notes?: string } = {
        orderId: order._id as any,
      };
      if (refundNotes) {
        args.notes = refundNotes;
      }
      await refundOrderMutation(args);
      setSuccessMessage("Order has been successfully marked as refunded.");
      setIsRefundModalOpen(false);
      setRefundNotes("");
    } catch (err: any) {
      console.error("Refund failed:", err);
      setErrorMessage(
        err.message || "An error occurred while processing the refund.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Timeline nodes helper
  const getTimelineSteps = (): TimelineStep[] => {
    const steps: TimelineStep[] = [
      { label: "Created", done: true, current: false },
      {
        label: "Processing",
        done: order.status !== "pending",
        current: order.status === "processing",
      },
    ];

    if (order.status === "failed") {
      steps.push({ label: "Failed", done: true, current: true, error: true });
    } else if (order.status === "refunded") {
      steps.push({
        label: "Refunded",
        done: true,
        current: true,
        neutral: true,
      });
    } else {
      steps.push({
        label: "Completed",
        done: order.status === "completed",
        current: order.status === "completed",
      });
    }

    return steps;
  };

  return (
    <div>
      {/* Top Header */}
      <div className="flex-responsive-header">
        <div>
          <div style={{ marginBottom: "var(--space-2)" }}>
            <Link
              href="/orders"
              className="btn btn-secondary btn-sm"
              style={{ paddingLeft: 0, border: "none", background: "none" }}
            >
              &larr; Back to Orders
            </Link>
          </div>
          <h1
            className="page-title"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            Order details
            <span
              className="font-mono text-muted text-sm"
              style={{ fontWeight: "normal" }}
            >
              #{order.reference}
            </span>
          </h1>
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {order.status !== "refunded" && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setIsRefundModalOpen(true)}
            >
              Refund Order
            </button>
          )}
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

      {/* Visual Timeline */}
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div className="card-body">
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              position: "relative",
              padding: "0 var(--space-8)",
            }}
          >
            {getTimelineSteps().map((step, idx, arr) => (
              <div
                key={step.label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  zIndex: 2,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    background: step.error
                      ? "var(--danger)"
                      : step.neutral
                        ? "var(--text-muted)"
                        : step.done
                          ? "var(--primary)"
                          : "var(--bg-inset)",
                    color:
                      step.done || step.error || step.neutral
                        ? "#ffffff"
                        : "var(--text-muted)",
                    border: `2px solid ${
                      step.current
                        ? step.error
                          ? "var(--danger)"
                          : "var(--primary)"
                        : "transparent"
                    }`,
                  }}
                >
                  {step.error ? "✗" : step.done ? "✓" : idx + 1}
                </div>
                <span
                  style={{
                    marginTop: "var(--space-2)",
                    fontSize: "var(--font-size-sm)",
                    fontWeight: step.current ? 600 : 500,
                    color: step.current
                      ? "var(--text)"
                      : "var(--text-secondary)",
                  }}
                >
                  {step.label}
                </span>

                {/* Progress bar line connecting nodes */}
                {idx < arr.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      left: "calc(50% + 24px)",
                      top: "18px",
                      width: "calc(100% - 48px)",
                      height: "3px",
                      background: arr[idx + 1]?.done
                        ? "var(--primary)"
                        : "var(--bg-inset)",
                      zIndex: -1,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-responsive-2-1">
        {/* Left Column: Order details & API payload */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">Order Information</h2>
            </div>
            <div
              className="card-body grid-responsive-1-1"
              style={{
                gap: "var(--space-4)",
              }}
            >
              <div>
                <div className="form-label">Reference</div>
                <div className="font-mono" style={{ fontWeight: 600 }}>
                  {order.reference}
                </div>
              </div>
              <div>
                <div className="form-label">Network</div>
                <div style={{ textTransform: "uppercase", fontWeight: 600 }}>
                  {order.network}
                </div>
              </div>
              <div>
                <div className="form-label">Recipient Number</div>
                <div className="font-mono">{order.recipientPhone}</div>
              </div>
              <div>
                <div className="form-label">Purchase Amount</div>
                <div
                  style={{ fontSize: "var(--font-size-lg)", fontWeight: 700 }}
                >
                  GHS {order.amountGhs.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="form-label">Order Status</div>
                <div>
                  <StatusBadge status={order.status} />
                </div>
              </div>
              <div>
                <div className="form-label">Created At</div>
                <div className="text-muted">
                  {new Date(order._creationTime).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">
                Vendor & Fulfillment Details
              </h2>
            </div>
            <div
              className="card-body grid-responsive-1-1"
              style={{
                gap: "var(--space-4)",
              }}
            >
              <div>
                <div className="form-label">Vendor ID</div>
                <div>{order.vendorId}</div>
              </div>
              <div>
                <div className="form-label">Vendor Package ID</div>
                <div>{order.vendorPackageId || "N/A"}</div>
              </div>
              <div>
                <div className="form-label">Vendor Reference</div>
                <div className="font-mono">
                  {order.vendorOrderReference || "N/A"}
                </div>
              </div>
              <div>
                <div className="form-label">Recipient Confirmed At</div>
                <div>
                  {order.recipientConfirmedAt
                    ? new Date(order.recipientConfirmedAt).toLocaleString()
                    : "Pending confirmation"}
                </div>
              </div>
            </div>
          </div>

          {order.vendorRaw && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-header-title">Vendor Raw Payload</h2>
              </div>
              <div className="card-body">
                <JsonViewer value={order.vendorRaw} label="Vendor Response" />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: User & Payment Details */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">User Account</h2>
            </div>
            <div className="card-body">
              {user ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      marginBottom: "var(--space-4)",
                    }}
                  >
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: "var(--primary-light)",
                        color: "var(--primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                      }}
                    >
                      {user.displayName
                        ? user.displayName.charAt(0).toUpperCase()
                        : "U"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {user.displayName || "No Name"}
                      </div>
                      <div className="text-sm text-muted">
                        {user.email || "No Email"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2)",
                    }}
                  >
                    <div>
                      <span className="text-muted text-sm">Role: </span>
                      <span
                        style={{ textTransform: "capitalize", fontWeight: 500 }}
                      >
                        {user.role}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted text-sm">Phone: </span>
                      <span className="font-mono">{user.phone || "N/A"}</span>
                    </div>
                    <div style={{ marginTop: "var(--space-3)" }}>
                      <Link
                        href={`/users/${user._id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ width: "100%" }}
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "var(--space-2) 0" }}>
                  <div
                    style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}
                  >
                    Guest Purchase
                  </div>
                  {order.guestContactPhone ? (
                    <div className="text-muted text-sm">
                      Contact:{" "}
                      <span className="font-mono">
                        {order.guestContactPhone}
                      </span>
                    </div>
                  ) : (
                    <div className="text-muted text-sm">
                      No contact phone provided
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">Payment Information</h2>
            </div>
            <div
              className="card-body"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <div>
                <div className="form-label">Payment Method</div>
                <div style={{ fontWeight: 600 }}>
                  {order.paymentMethod === "paystack_momo"
                    ? "Paystack Mobile Money"
                    : "Wallet Balance"}
                </div>
              </div>
              <div>
                <div className="form-label">Payment Status</div>
                <div>
                  <StatusBadge status={order.paymentStatus} />
                </div>
              </div>
              {order.paystackReference && (
                <div>
                  <div className="form-label">Paystack Reference</div>
                  <div className="font-mono text-sm">
                    {order.paystackReference}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Related Alerts Panel */}
          {relatedAlerts.length > 0 && (
            <div className="card" style={{ borderColor: "var(--danger)" }}>
              <div
                className="card-header"
                style={{ background: "var(--danger-light)" }}
              >
                <h2
                  className="card-header-title"
                  style={{
                    color: "var(--danger)",
                    fontSize: "var(--font-size-md)",
                  }}
                >
                  Active alerts ({relatedAlerts.length})
                </h2>
              </div>
              <div
                className="card-body"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                {relatedAlerts.map((alert) => (
                  <div
                    key={alert._id}
                    style={{
                      padding: "var(--space-3)",
                      background: "var(--bg-inset)",
                      borderRadius: "var(--radius-md)",
                      borderLeft: `3px solid var(--danger)`,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "var(--font-size-sm)",
                      }}
                    >
                      {alert.message}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "var(--space-2)",
                        fontSize: "var(--font-size-xs)",
                      }}
                      className="text-muted"
                    >
                      <span>Category: {alert.category}</span>
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Refund Confirmation Modal */}
      <Modal
        isOpen={isRefundModalOpen}
        onClose={() => {
          if (!isSubmitting) setIsRefundModalOpen(false);
        }}
        title="Refund order"
        footer={
          <>
            <button
              className="btn btn-secondary"
              disabled={isSubmitting}
              onClick={() => setIsRefundModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              disabled={isSubmitting}
              onClick={handleRefund}
            >
              {isSubmitting ? "Refunding..." : "Confirm Refund"}
            </button>
          </>
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <p>
            Are you sure you want to refund this order? This will mark the order
            status and payment status as <strong>refunded</strong>.
          </p>
          {order.userId && (
            <div
              style={{
                background: "var(--primary-light)",
                color: "var(--primary)",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--font-size-sm)",
                fontWeight: 500,
              }}
            >
              This order has a registered user. The purchase amount of{" "}
              <strong>GHS {order.amountGhs.toFixed(2)}</strong> will be
              automatically credited back to their wallet balance.
            </div>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor="refund-reason">
              Reason / Notes (Optional)
            </label>
            <textarea
              id="refund-reason"
              className="textarea"
              placeholder="Provide a reason for the refund (e.g. Vendor transaction failed)"
              value={refundNotes}
              onChange={(e) => setRefundNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
