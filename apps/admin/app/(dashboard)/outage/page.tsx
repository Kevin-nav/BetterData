"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { convexApi } from "@betterdata/app-api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { useAdminAuth } from "../../lib/auth";
import { getApiBaseUrl } from "../../lib/api";
import { DataTable, type ColumnDef } from "../../components/DataTable";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";

type PurchaseOutageStatus = {
  isActive: boolean;
  updatedAt: number | null;
  message: string | null;
};

type RestorationSubscriber = {
  _id: string;
  email: string;
  normalizedEmail: string;
  notifiedAt?: number;
  createdAt: number;
  updatedAt: number;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OutagePage() {
  const { scope, getAuthHeaders } = useAdminAuth();
  const { showToast } = useToast();

  const isSuperadmin = scope === "superadmin";

  // Reactive status + subscriber list. Convex re-runs these automatically
  // after the REST mutations change the underlying platformConfig rows.
  const status = useQuery(convexApi.admin.getPurchaseOutageStatus);
  const subscribers = useQuery(convexApi.admin.listRestorationSubscribers);

  const [toggling, setToggling] = React.useState(false);
  const [savingMessage, setSavingMessage] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = React.useState(false);

  const [draftMessage, setDraftMessage] = React.useState("");
  const [messageLoaded, setMessageLoaded] = React.useState(false);

  // Seed the textarea once the stored message arrives (never clobber typing).
  React.useEffect(() => {
    if (status && !messageLoaded) {
      setDraftMessage(status.message ?? "");
      setMessageLoaded(true);
    }
  }, [status, messageLoaded]);

  async function postOutageUpdate(body: {
    isActive: boolean;
    message?: string;
  }): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${getApiBaseUrl()}/admin/purchase-outage`, {
      method: "POST",
      headers: {
        ...(headers as Record<string, string>),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        (errData as { message?: string }).message ||
          "Failed to update purchase availability."
      );
    }
  }

  const handleToggle = async (nextIsActive: boolean) => {
    setToggling(true);
    try {
      await postOutageUpdate({ isActive: nextIsActive });
      showToast(
        nextIsActive
          ? "Purchases are now paused for customers."
          : "Purchases are live again.",
        "success"
      );
    } catch (err: any) {
      console.error("Failed to update purchase outage:", err);
      showToast(err.message || "Failed to update purchase availability.", "error");
    } finally {
      setToggling(false);
    }
  };

  const handleSaveMessage = async () => {
    if (!status) return;
    setSavingMessage(true);
    try {
      await postOutageUpdate({
        isActive: status.isActive,
        message: draftMessage,
      });
      showToast("Customer-facing message saved.", "success");
    } catch (err: any) {
      console.error("Failed to save outage message:", err);
      showToast(err.message || "Failed to save message.", "error");
    } finally {
      setSavingMessage(false);
    }
  };

  const handleRestoreNotify = async () => {
    setRestoring(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${getApiBaseUrl()}/admin/purchase-outage/restore-notify`,
        {
          method: "POST",
          headers,
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as { message?: string }).message ||
            "Failed to restore purchases."
        );
      }

      const data = (await res.json()) as {
        attempted: number;
        successCount: number;
        failureCount: number;
      };
      showToast(
        `Purchases restored. Emailed ${data.successCount} of ${data.attempted} recipient(s)` +
          (data.failureCount > 0 ? `, ${data.failureCount} failed.` : "."),
        data.failureCount > 0 ? "warning" : "success"
      );
      setRestoreConfirmOpen(false);
    } catch (err: any) {
      console.error("Restore & notify failed:", err);
      showToast(err.message || "Failed to restore purchases.", "error");
    } finally {
      setRestoring(false);
    }
  };

  const subscriberColumns: ColumnDef<RestorationSubscriber>[] = [
    {
      key: "email",
      header: "Email",
      render: (row) => (
        <span style={{ fontWeight: 500, color: "var(--text)" }}>{row.email}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Subscribed",
      render: (row) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "notifiedAt",
      header: "Notified",
      hiddenOnMobile: true,
      render: (row) =>
        row.notifiedAt ? (
          <span className="text-muted-foreground text-sm">
            {formatDate(row.notifiedAt)}
          </span>
        ) : (
          <Badge variant="warning">Pending</Badge>
        ),
    },
  ];

  const statusLoading = status === undefined;

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Purchase Availability</h1>
          <p className="page-subtitle">
            Control whether customers can place new data purchases.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
      >
        {/* Status control */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-header-title">Current Status</h3>
          </div>
          <div
            className="card-body"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          >
            {statusLoading ? (
              <p className="text-muted-foreground text-sm">Loading status…</p>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-4)",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: "1.35rem",
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      color: status!.isActive ? "var(--danger)" : "var(--text)",
                    }}
                  >
                    {status!.isActive ? "OUTAGE ACTIVE" : "Active purchases"}
                  </span>
                  <Badge variant={status!.isActive ? "destructive" : "success"}>
                    {status!.isActive ? "Purchases paused" : "Purchases live"}
                  </Badge>
                </div>
                <Switch
                  checked={status!.isActive}
                  disabled={toggling || !isSuperadmin}
                  aria-label="Toggle purchase availability"
                  onCheckedChange={(checked) => void handleToggle(checked)}
                />
              </div>
            )}

            {!isSuperadmin && (
              <p className="text-muted-foreground text-sm">
                You have view-only access — only superadmins can change purchase
                availability.
              </p>
            )}

            {status && status.updatedAt !== null && (
              <p className="text-muted-foreground text-xs">
                Last updated {formatDate(status.updatedAt)}
              </p>
            )}
          </div>
        </div>

        {/* Customer-facing message */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-header-title">Customer-Facing Message</h3>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveMessage();
            }}
            className="card-body"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          >
            <p className="text-muted-foreground text-sm">
              Shown to customers while the outage is active. Leave empty to use
              the default notice.
            </p>
            <Textarea
              rows={4}
              placeholder="e.g. We're performing scheduled maintenance and will be back shortly."
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              disabled={!isSuperadmin || savingMessage || toggling}
            />
            <div>
              <Button type="submit" size="sm" disabled={!isSuperadmin || savingMessage}>
                {savingMessage ? "Saving…" : "Save message"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Danger zone */}
      <div
        className="card"
        style={{
          marginTop: "var(--space-6)",
          borderColor: "var(--danger)",
        }}
      >
        <div className="card-header">
          <h3 className="card-header-title" style={{ color: "var(--danger)" }}>
            Danger Zone
          </h3>
        </div>
        <div
          className="card-body"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <p className="text-muted-foreground text-sm">
            Restoring service immediately ends the outage and emails{" "}
            <strong>all registered users and outage subscribers</strong> that
            purchases are available again.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Button
              type="button"
              variant="destructive"
              disabled={restoring || !isSuperadmin}
              onClick={() => setRestoreConfirmOpen(true)}
            >
              Restore service &amp; notify customers
            </Button>
            {!isSuperadmin && (
              <span className="text-muted-foreground text-xs">
                Superadmins only.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Restoration subscribers */}
      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div
          className="card-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <h3 className="card-header-title">
            Restoration Subscribers
            {subscribers ? (
              <Badge variant="secondary" style={{ marginLeft: "var(--space-2)" }}>
                {subscribers.length}
              </Badge>
            ) : null}
          </h3>
        </div>
        <div className="card-body">
          <DataTable
            columns={subscriberColumns}
            data={subscribers ?? []}
            isLoading={subscribers === undefined}
            emptyStateTitle="No subscribers yet"
            emptyStateDescription="Customers who sign up for restoration updates will appear here."
            rowKey={(row) => row._id}
          />
        </div>
      </div>

      <ConfirmDialog
        open={restoreConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !restoring) setRestoreConfirmOpen(false);
        }}
        title="Restore purchases and notify customers?"
        description={
          <>
            This immediately ends outage mode and sends an email to{" "}
            <strong>all registered users</strong> plus every customer subscribed
            to restoration updates. This cannot be undone.
          </>
        }
        confirmLabel="Restore & Notify"
        cancelLabel="Cancel"
        destructive
        loading={restoring}
        onConfirm={() => void handleRestoreNotify()}
      />
    </div>
  );
}
