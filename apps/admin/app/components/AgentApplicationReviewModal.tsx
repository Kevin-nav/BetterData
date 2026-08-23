"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { convexApi } from "@betterdata/app-api";
import { Modal } from "./Modal";
import { useAdminAuth } from "../lib/auth";
import { getApiBaseUrl } from "../lib/api";

export type AgentApplicationReviewAction = "approve" | "reject";

type AgentApplicationReviewModalProps = {
  /** Current action to confirm, or null when the dialog is closed. */
  action: AgentApplicationReviewAction | null;
  application: {
    _id: string;
    userId: string;
    paymentReference?: string | undefined;
  } | null;
  user?: {
    displayName?: string;
    email?: string;
    phone?: string;
  } | null;
  /** Called when the dialog should close. Never invoked mid-submission. */
  onClose: () => void;
  /** Called after the mutation succeeds (approval-email failures are folded into the message). */
  onSuccess?: (message: string) => void;
  /** Called with a user-facing message when the mutation fails. */
  onError?: (message: string) => void;
};

/**
 * Confirmation dialog shared by the agent applications list and the agent
 * profile page. Owns the approve/reject mutations, the optional rejection
 * reason, and the approval-email trigger so callers only handle outcomes.
 */
export function AgentApplicationReviewModal({
  action,
  application,
  user,
  onClose,
  onSuccess,
  onError,
}: AgentApplicationReviewModalProps) {
  const { getAuthHeaders } = useAdminAuth();

  const approveApplication = useMutation(
    convexApi.admin.approveAgentApplication,
  );
  const rejectApplication = useMutation(
    convexApi.admin.rejectAgentApplication,
  );

  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (action === null) {
      setRejectReason("");
    }
  }, [action]);

  const requestClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (!application || !action) return;
    setIsSubmitting(true);
    try {
      if (action === "approve") {
        await approveApplication({
          applicationId: application._id as any,
        });
        let message = `Application for ${
          user?.displayName || "user"
        } approved successfully.`;
        try {
          await sendAgentApprovalEmail(application.userId, getAuthHeaders);
        } catch (emailErr) {
          console.error("Failed to trigger agent approval email:", emailErr);
          message = `Application for ${
            user?.displayName || "user"
          } approved, but the approval email failed to send.`;
        }
        onSuccess?.(message);
      } else {
        const reason = rejectReason.trim();
        await rejectApplication({
          applicationId: application._id as any,
          ...(reason.length > 0 ? { reason } : {}),
        });
        onSuccess?.(
          `Application for ${user?.displayName || "user"} rejected.`,
        );
      }
    } catch (err: any) {
      console.error("Agent application action failed:", err);
      onError?.(
        err?.message ||
          "An error occurred while processing the request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={action !== null && application !== null}
      onClose={requestClose}
      title={
        action === "approve"
          ? "Approve Agent Application"
          : "Reject Agent Application"
      }
      footer={
        <>
          <button
            className="btn btn-secondary"
            disabled={isSubmitting}
            onClick={requestClose}
          >
            Cancel
          </button>
          <button
            className={
              action === "approve" ? "btn btn-primary" : "btn btn-danger"
            }
            disabled={isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting
              ? "Processing..."
              : action === "approve"
                ? "Approve Application"
                : "Reject Application"}
          </button>
        </>
      }
    >
      {application && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <p>
            Are you sure you want to{" "}
            <strong>{action === "approve" ? "APPROVE" : "REJECT"}</strong> the
            agent application for{" "}
            <strong>{user?.displayName || "this user"}</strong>?
          </p>

          {(user?.email || user?.phone || application.paymentReference) && (
            <div
              style={{
                background: "var(--bg-inset)",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <div>Email: {user?.email || "N/A"}</div>
              <div>Phone: {user?.phone || "N/A"}</div>
              {application.paymentReference && (
                <div>Payment Ref: {application.paymentReference}</div>
              )}
            </div>
          )}

          {action === "approve" ? (
            <p
              className="text-muted"
              style={{ fontSize: "var(--font-size-sm)" }}
            >
              Approving this application will change the user&apos;s role to{" "}
              <strong>agent</strong> and grant them access to wholesale bundle
              rates.
            </p>
          ) : (
            <div className="form-group">
              <label className="form-label" htmlFor="agent-reject-reason">
                Reason for Rejection (Optional)
              </label>
              <textarea
                id="agent-reject-reason"
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
  );
}

async function sendAgentApprovalEmail(
  userId: string,
  getAuthHeaders: () => Promise<HeadersInit>,
) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${getApiBaseUrl()}/admin/agents/${userId}/email-approved`,
    {
      method: "POST",
      headers,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Agent approval email failed with status ${response.status}.`,
    );
  }
}
