"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { convexApi } from "@betterdata/app-api";
import { AlertCircle, RotateCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "./StatusBadge";
import { useToast } from "./Toast";

type OpsAlertSeverity = "info" | "warning" | "critical";
type OpsAlertStatus = "open" | "acknowledged" | "resolved";
type OpsAlertCategory =
  | "payment"
  | "webhook"
  | "fulfillment"
  | "config"
  | "security";
type OpsRetryAction =
  | "verify_payment"
  | "fulfill_order"
  | "credit_wallet"
  | "complete_agent_application";
type OpsRetryStatus =
  | "not_started"
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

type OpsAlert = {
  _id: string;
  severity: OpsAlertSeverity;
  status: OpsAlertStatus;
  category: OpsAlertCategory;
  reference?: string;
  message: string;
  metadata?: unknown;
  retryable: boolean;
  retryAction?: OpsRetryAction;
  retryStatus?: OpsRetryStatus;
  retryCount: number;
  lastRetriedAt?: number;
  nextRetryAt?: number;
  createdAt: number;
  updatedAt: number;
};

const RETRY_ACTION_LABELS: Record<OpsRetryAction, string> = {
  verify_payment: "Verify Payment",
  fulfill_order: "Fulfill Order",
  credit_wallet: "Credit Wallet",
  complete_agent_application: "Complete Agent Application",
};

// Retry status -> StatusBadge-compatible status key
// (queued=warning, running=info, failed=destructive, succeeded=success, not_started=muted/outline)
const RETRY_STATUS_VARIANTS: Record<OpsRetryStatus, string> = {
  queued: "warning",
  running: "info",
  failed: "failed",
  succeeded: "completed",
  not_started: "neutral",
};

const RETRY_STATUS_LABELS: Record<OpsRetryStatus, string> = {
  not_started: "Not started",
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

const SEVERITY_FILTERS: Array<{
  value: "all" | OpsAlertSeverity;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

function formatRetryDue(nextRetryAt: number, now: number): string {
  const diffMs = nextRetryAt - now;
  const absMs = Math.abs(diffMs);
  const minutes = Math.floor(absMs / 60000);
  const hours = Math.floor(absMs / 3600000);
  const days = Math.floor(absMs / 86400000);

  let span: string;
  if (minutes < 1) {
    span = "under a minute";
  } else if (minutes < 60) {
    span = `${minutes}m`;
  } else if (hours < 24) {
    span = `${hours}h`;
  } else {
    span = `${days}d`;
  }

  return diffMs >= 0 ? `due in ${span}` : `overdue by ${span}`;
}

function formatShortTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Catches render-time throws from Convex `useQuery` (e.g. auth errors) and
 * renders a destructive alert with a Retry button that remounts the subtree
 * via key increment, instead of leaving an infinite skeleton.
 */
class AlertQueryErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; resetKey: number }
> {
  override state = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[OpsAlertPanel] query error:", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      resetKey: prev.resetKey + 1,
    }));
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="card-body">
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Failed to load open alerts</AlertTitle>
            <AlertDescription>
              <p>
                The alert feed could not be read. Check your authorization and
                try again.
              </p>
              <Button variant="outline" size="sm" onClick={this.handleRetry}>
                <RotateCw aria-hidden="true" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    // Keying on resetKey remounts the subtree so hooks re-run after a retry.
    return (
      <React.Fragment key={this.state.resetKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

function RetryStrip({ alert, now }: { alert: OpsAlert; now: number }) {
  const retryStatus = alert.retryStatus ?? "not_started";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        flexWrap: "wrap",
        marginTop: "var(--space-2)",
        padding: "var(--space-2) var(--space-3)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-root)",
        border: "1px solid var(--border)",
      }}
    >
      {alert.retryAction && (
        <span
          style={{
            fontSize: "var(--font-size-xs)",
            fontWeight: 600,
            color: "var(--text-secondary)",
          }}
        >
          {RETRY_ACTION_LABELS[alert.retryAction]}
        </span>
      )}
      <StatusBadge
        status={RETRY_STATUS_VARIANTS[retryStatus]}
        label={RETRY_STATUS_LABELS[retryStatus]}
      />
      <span
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--text-muted)",
        }}
      >
        Attempt {alert.retryCount + 1}
      </span>
      {retryStatus !== "succeeded" && alert.nextRetryAt !== undefined && (
        <span
          style={{
            fontSize: "var(--font-size-xs)",
            color:
              alert.nextRetryAt < now ? "var(--warning)" : "var(--text-muted)",
            fontWeight: alert.nextRetryAt < now ? 600 : 400,
          }}
        >
          {formatRetryDue(alert.nextRetryAt, now)}
        </span>
      )}
      {alert.lastRetriedAt !== undefined && (
        <span
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--text-muted)",
          }}
        >
          Last retried {formatShortTime(alert.lastRetriedAt)}
        </span>
      )}
    </div>
  );
}

function OpsAlertPanelInner() {
  const { showToast } = useToast();

  const alerts = useQuery(convexApi.admin.listOpenAlerts) as
    | OpsAlert[]
    | undefined;
  const acknowledgeAlert = useMutation(convexApi.admin.acknowledgeAlert);
  const resolveAlert = useMutation(convexApi.admin.resolveAlert);
  const escalateAlert = useMutation(convexApi.admin.escalateAlert);
  const retryAlertNow = useMutation(convexApi.admin.retryAlertNow);

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<
    "all" | OpsAlertSeverity
  >("all");
  const [escalateTarget, setEscalateTarget] = useState<OpsAlert | null>(null);
  const [escalateNote, setEscalateNote] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // Re-render periodically so relative retry times ("due in 3m") stay current.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const runAction = async (
    alertId: string,
    action: () => Promise<unknown>,
    successMessage: string,
    failurePrefix: string,
  ) => {
    setActioningId(alertId);
    try {
      await action();
      showToast(successMessage, "success");
    } catch (err) {
      console.error(`${failurePrefix}:`, err);
      showToast(
        `${failurePrefix} failed. Make sure you are authorized.`,
        "error",
      );
    } finally {
      setActioningId(null);
    }
  };

  const handleAcknowledge = (alertId: string) =>
    runAction(
      alertId,
      () => acknowledgeAlert({ alertId: alertId as any }),
      "Alert acknowledged.",
      "Failed to acknowledge alert",
    );

  const handleResolve = (alertId: string) =>
    runAction(
      alertId,
      () => resolveAlert({ alertId: alertId as any }),
      "Alert resolved.",
      "Failed to resolve alert",
    );

  const handleRetryNow = (alertId: string) =>
    runAction(
      alertId,
      () => retryAlertNow({ alertId: alertId as any }),
      "Retry queued. The retry worker will pick it up within a minute.",
      "Failed to queue retry",
    );

  const openEscalateDialog = (alert: OpsAlert) => {
    setEscalateTarget(alert);
    setEscalateNote("");
  };

  const closeEscalateDialog = () => {
    if (actioningId !== null) return;
    setEscalateTarget(null);
    setEscalateNote("");
  };

  const handleEscalate = async () => {
    if (!escalateTarget) return;
    const target = escalateTarget;
    const note = escalateNote.trim();
    setActioningId(target._id);
    try {
      await escalateAlert({
        alertId: target._id as any,
        ...(note.length > 0 ? { message: note } : {}),
      });
      showToast("Alert escalated to critical.", "success");
      setEscalateTarget(null);
      setEscalateNote("");
    } catch (err) {
      console.error("Failed to escalate alert:", err);
      showToast(
        "Failed to escalate alert. Make sure you are authorized.",
        "error",
      );
    } finally {
      setActioningId(null);
    }
  };

  const filteredAlerts = (alerts ?? []).filter(
    (alert) => severityFilter === "all" || alert.severity === severityFilter,
  );

  if (alerts === undefined) {
    return (
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-header-subtitle">Operations</div>
            <div className="card-header-title">Open Alerts</div>
          </div>
        </div>
        <div className="card-body">
          <div
            className="skeleton"
            style={{ height: "48px", marginBottom: "var(--space-3)" }}
          />
          <div
            className="skeleton"
            style={{ height: "48px", marginBottom: "var(--space-3)" }}
          />
          <div className="skeleton" style={{ height: "48px" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-header-subtitle">Operations</div>
          <div className="card-header-title">Open Alerts ({alerts.length})</div>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {/* Severity filter chips */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            padding: "var(--space-3) var(--space-6)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {SEVERITY_FILTERS.map((filter) => {
            const isActive = severityFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSeverityFilter(filter.value)}
                className="btn btn-sm"
                style={{
                  height: "28px",
                  fontSize: "var(--font-size-xs)",
                  padding: "0 var(--space-3)",
                  border: "1px solid var(--border)",
                  borderRadius: "999px",
                  background: isActive ? "var(--primary)" : "transparent",
                  color: isActive ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: isActive ? 600 : 400,
                }}
                aria-pressed={isActive}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {filteredAlerts.length === 0 ? (
          <div
            className="empty-state"
            style={{ padding: "var(--space-8) var(--space-4)" }}
          >
            <div className="empty-state-title">
              {alerts.length === 0
                ? "No open alerts"
                : `No ${severityFilter} alerts`}
            </div>
            <div className="empty-state-description">
              {alerts.length === 0
                ? "Platform operations are currently running smoothly."
                : "Try a different severity filter."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filteredAlerts.map((alert) => {
              // Map severity to visual indicator border color
              const borderLeftColor =
                alert.severity === "critical"
                  ? "var(--danger)"
                  : alert.severity === "warning"
                    ? "var(--warning)"
                    : "var(--info)";

              const isActing = actioningId === alert._id;
              const showRetryNow =
                alert.retryable && alert.retryStatus !== "succeeded";

              return (
                <div
                  key={alert._id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--space-4)",
                    padding: "var(--space-4) var(--space-6)",
                    borderBottom: "1px solid var(--border)",
                    borderLeft: `4px solid ${borderLeftColor}`,
                    background:
                      alert.severity === "critical"
                        ? "color-mix(in srgb, var(--danger) 3%, transparent)"
                        : "transparent",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        flexWrap: "wrap",
                      }}
                    >
                      <StatusBadge status={alert.severity} />
                      <span
                        className="badge"
                        style={{
                          fontSize: "var(--font-size-xs)",
                          background: "var(--bg-inset)",
                          color: "var(--text-secondary)",
                          textTransform: "capitalize",
                        }}
                      >
                        {alert.category}
                      </span>
                      {alert.reference && (
                        <code
                          style={{
                            fontSize: "var(--font-size-xs)",
                            background: "var(--bg-root)",
                            padding: "2px 6px",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          {alert.reference}
                        </code>
                      )}
                    </div>
                    <p
                      style={{
                        margin: "var(--space-1) 0 0 0",
                        fontSize: "var(--font-size-sm)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {alert.message}
                    </p>
                    <small
                      style={{
                        display: "block",
                        marginTop: "var(--space-1)",
                        fontSize: "11px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {new Date(alert.createdAt).toLocaleString()}
                    </small>
                    {alert.retryable && <RetryStrip alert={alert} now={now} />}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-2)",
                      flexShrink: 0,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    {alert.status === "open" && (
                      <button
                        onClick={() => handleAcknowledge(alert._id)}
                        disabled={actioningId !== null}
                        className="btn btn-secondary"
                        style={{
                          height: "32px",
                          fontSize: "var(--font-size-xs)",
                          padding: "0 var(--space-3)",
                        }}
                      >
                        {isActing ? "..." : "Acknowledge"}
                      </button>
                    )}
                    {showRetryNow && (
                      <button
                        onClick={() => handleRetryNow(alert._id)}
                        disabled={actioningId !== null}
                        className="btn btn-secondary"
                        style={{
                          height: "32px",
                          fontSize: "var(--font-size-xs)",
                          padding: "0 var(--space-3)",
                        }}
                      >
                        {isActing ? "..." : "Retry Now"}
                      </button>
                    )}
                    <button
                      onClick={() => openEscalateDialog(alert)}
                      disabled={actioningId !== null}
                      className="btn btn-secondary"
                      style={{
                        height: "32px",
                        fontSize: "var(--font-size-xs)",
                        padding: "0 var(--space-3)",
                      }}
                    >
                      {isActing ? "..." : "Escalate"}
                    </button>
                    <button
                      onClick={() => handleResolve(alert._id)}
                      disabled={actioningId !== null}
                      className="btn btn-primary"
                      style={{
                        height: "32px",
                        fontSize: "var(--font-size-xs)",
                        padding: "0 var(--space-3)",
                      }}
                    >
                      {isActing ? "..." : "Resolve"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Escalate dialog */}
      <Dialog
        open={escalateTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeEscalateDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escalate Alert</DialogTitle>
            <DialogDescription>
              Escalation sets the alert severity to critical and records an
              audit entry. You can optionally attach a note.
            </DialogDescription>
          </DialogHeader>
          {escalateTarget && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                }}
              >
                <StatusBadge status={escalateTarget.severity} />
                <span
                  className="badge"
                  style={{
                    fontSize: "var(--font-size-xs)",
                    background: "var(--bg-inset)",
                    color: "var(--text-secondary)",
                    textTransform: "capitalize",
                  }}
                >
                  {escalateTarget.category}
                </span>
                {escalateTarget.reference && (
                  <code
                    style={{
                      fontSize: "var(--font-size-xs)",
                      background: "var(--bg-root)",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    {escalateTarget.reference}
                  </code>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  color: "var(--text-secondary)",
                }}
              >
                {escalateTarget.message}
              </p>
            </div>
          )}
          <Textarea
            placeholder="Optional note for the audit log (e.g. why this is being escalated)..."
            value={escalateNote}
            onChange={(event) => setEscalateNote(event.target.value)}
            disabled={actioningId !== null}
            rows={3}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={actioningId !== null}
              onClick={closeEscalateDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={actioningId !== null}
              onClick={() => void handleEscalate()}
            >
              {actioningId !== null && escalateTarget
                ? "Escalating..."
                : "Escalate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OpsAlertPanel() {
  return (
    <AlertQueryErrorBoundary>
      <OpsAlertPanelInner />
    </AlertQueryErrorBoundary>
  );
}
