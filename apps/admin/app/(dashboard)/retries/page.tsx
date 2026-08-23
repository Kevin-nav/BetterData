"use client";

import * as React from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { convexApi } from "@betterdata/app-api";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConvexQueryErrorBoundary } from "../../components/ConvexQueryBoundary";
import { StatusBadge } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";

type OpsAlertSeverity = "info" | "warning" | "critical";
type OpsAlertStatus = "open" | "acknowledged" | "resolved";
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

type RetriableAlert = {
  _id: string;
  severity: OpsAlertSeverity;
  status: OpsAlertStatus;
  category: string;
  reference?: string;
  message: string;
  retryable: boolean;
  retryAction?: OpsRetryAction;
  retryStatus?: OpsRetryStatus;
  retryCount: number;
  lastRetriedAt?: number;
  nextRetryAt?: number;
  createdAt: number;
};

const RETRY_ACTION_LABELS: Record<OpsRetryAction, string> = {
  verify_payment: "Verify Payment",
  fulfill_order: "Fulfill Order",
  credit_wallet: "Credit Wallet",
  complete_agent_application: "Complete Agent Application",
};

// Maps retry status -> StatusBadge key
// (queued=warning, running=info, failed=destructive, succeeded=success)
const RETRY_STATUS_BADGE_STATUS: Record<OpsRetryStatus, string> = {
  queued: "pending", // warning variant via StatusBadge map
  running: "processing", // info variant
  failed: "failed", // destructive variant
  succeeded: "completed", // success variant
  not_started: "neutral", // muted outline
};

const RETRY_STATUS_LABELS: Record<OpsRetryStatus, string> = {
  not_started: "Not started",
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

type TabKey = "queued" | "running" | "failed" | "succeeded";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "queued", label: "Queued" },
  { key: "running", label: "Running" },
  { key: "failed", label: "Failed" },
  { key: "succeeded", label: "Succeeded" },
];

function formatShortTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

function truncateMessage(message: string, max = 90): string {
  return message.length > max ? `${message.slice(0, max)}…` : message;
}

function RetryQueueSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

function EmptyTabState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state" style={{ padding: "var(--space-8) var(--space-4)" }}>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-description">{description}</div>
    </div>
  );
}

function RetryQueueTab({ retryStatus }: { retryStatus: TabKey }) {
  const { showToast } = useToast();

  const {
    results: alerts,
    status,
    loadMore,
  } = usePaginatedQuery(
    convexApi.admin.listRetriableAlerts,
    { retryStatus },
    { initialNumItems: 25 },
  );

  const resolveAlert = useMutation(convexApi.admin.resolveAlert);
  const escalateAlert = useMutation(convexApi.admin.escalateAlert);
  const retryAlertNow = useMutation(convexApi.admin.retryAlertNow);

  const [actioningId, setActioningId] = React.useState<string | null>(null);
  const [escalateTarget, setEscalateTarget] =
    React.useState<RetriableAlert | null>(null);
  const [escalateNote, setEscalateNote] = React.useState("");
  const [now, setNow] = React.useState(() => Date.now());

  // Keep relative "due in X" labels fresh.
  React.useEffect(() => {
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
      showToast(`${failurePrefix}. Make sure you are authorized.`, "error");
    } finally {
      setActioningId(null);
    }
  };

  const handleRetryNow = (alertId: string) =>
    runAction(
      alertId,
      () => retryAlertNow({ alertId: alertId as any }),
      "Retry queued. The worker will process it within a minute.",
      "Failed to queue retry",
    );

  const handleResolve = (alertId: string) =>
    runAction(
      alertId,
      () => resolveAlert({ alertId: alertId as any }),
      "Alert resolved.",
      "Failed to resolve alert",
    );

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
      showToast("Failed to escalate alert. Make sure you are authorized.", "error");
    } finally {
      setActioningId(null);
    }
  };

  if (status === "LoadingFirstPage") {
    return <RetryQueueSkeleton />;
  }

  if (!alerts || alerts.length === 0) {
    return (
      <EmptyTabState
        title={`No ${RETRY_STATUS_LABELS[retryStatus as OpsRetryStatus].toLowerCase()} retries`}
        description={
          retryStatus === "queued"
            ? "Nothing is waiting for the retry worker right now."
            : "No retriable alerts currently match this status."
        }
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alertRaw) => {
            const alert = alertRaw as unknown as RetriableAlert;
            const isActing = actioningId === alert._id;
            const showSchedule =
              alert.nextRetryAt !== undefined &&
              alert.retryStatus !== "succeeded"
                ? formatRetryDue(alert.nextRetryAt, now)
                : alert.lastRetriedAt !== undefined
                  ? `last ${formatShortTime(alert.lastRetriedAt)}`
                  : "—";

            return (
              <TableRow key={alert._id}>
                <TableCell>
                  {alert.reference ? (
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
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium">
                    {alert.retryAction
                      ? RETRY_ACTION_LABELS[alert.retryAction]
                      : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    Attempt {alert.retryCount + 1}
                    {alert.retryStatus && (
                      <StatusBadge
                        status={RETRY_STATUS_BADGE_STATUS[alert.retryStatus]}
                        label={RETRY_STATUS_LABELS[alert.retryStatus]}
                      />
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className="text-xs"
                    style={{
                      color:
                        alert.nextRetryAt !== undefined &&
                        alert.nextRetryAt < now &&
                        alert.retryStatus !== "succeeded"
                          ? "var(--warning)"
                          : "var(--text-muted)",
                    }}
                  >
                    {showSchedule}
                  </span>
                </TableCell>
                <TableCell className="max-w-[260px] truncate text-muted-foreground">
                  {truncateMessage(alert.message)}
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-xs">
                    {formatShortTime(alert.createdAt)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div
                    style={{
                      display: "inline-flex",
                      gap: "var(--space-1)",
                      justifyContent: "flex-end",
                      flexWrap: "wrap",
                    }}
                  >
                    {(retryStatus === "queued" || retryStatus === "failed") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actioningId !== null}
                        onClick={() => handleRetryNow(alert._id)}
                      >
                        {isActing ? "..." : "Retry Now"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actioningId !== null}
                      onClick={() =>
                        runAction(
                          alert._id,
                          () => resolveAlert({ alertId: alert._id as any }),
                          "Alert resolved.",
                          "Failed to resolve alert",
                        )
                      }
                    >
                      {isActing ? "..." : "Resolve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={actioningId !== null}
                      onClick={() => {
                        setEscalateTarget(alert);
                        setEscalateNote("");
                      }}
                    >
                      {isActing ? "..." : "Escalate"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button
            variant="secondary"
            size="sm"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(25)}
          >
            {status === "LoadingMore" ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

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
              Escalation sets severity to critical and records an audit entry.
              You can optionally attach a note.
            </DialogDescription>
          </DialogHeader>
          {escalateTarget && (
            <p className="text-sm text-muted-foreground">
              {escalateTarget.reference ? (
                <>
                  Reference{" "}
                  <code>{escalateTarget.reference}</code> —{" "}
                </>
              ) : null}
              {truncateMessage(escalateTarget.message, 160)}
            </p>
          )}
          <Textarea
            placeholder="Optional note for the audit log..."
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
              {actioningId !== null ? "Escalating..." : "Escalate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RetryQueuePage() {
  const [errorResetKey, setErrorResetKey] = React.useState(0);

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Payment Retries</h1>
          <p className="page-subtitle">
            Queued fulfillment and wallet retries processed automatically every
            minute.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <ConvexQueryErrorBoundary
            key={`retries-error-boundary-${errorResetKey}`}
            errorMessage="Could not load the retry queue"
            onRetry={() => setErrorResetKey((prev) => prev + 1)}
          >
            <Tabs defaultValue="queued">
              <TabsList>
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {TABS.map((tab) => (
                <TabsContent key={tab.key} value={tab.key}>
                  <RetryQueueTab retryStatus={tab.key} />
                </TabsContent>
              ))}
            </Tabs>
          </ConvexQueryErrorBoundary>
        </div>
      </div>
    </div>
  );
}
