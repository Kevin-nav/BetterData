"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { convexApi } from "@betterdata/app-api";
import { StatusBadge } from "./StatusBadge";
import { useToast } from "./Toast";

export function OpsAlertPanel() {
  const { showToast } = useToast();
  const alerts = useQuery(convexApi.admin.listOpenAlerts);
  const acknowledgeAlert = useMutation(convexApi.admin.acknowledgeAlert);
  const resolveAlert = useMutation(convexApi.admin.resolveAlert);

  const [actioningId, setActioningId] = useState<string | null>(null);

  const handleAcknowledge = async (alertId: any) => {
    setActioningId(alertId);
    try {
      await acknowledgeAlert({ alertId });
      showToast("Alert acknowledged.", "success");
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
      showToast("Failed to acknowledge alert. Make sure you are authorized.", "error");
    } finally {
      setActioningId(null);
    }
  };

  const handleResolve = async (alertId: any) => {
    setActioningId(alertId);
    try {
      await resolveAlert({ alertId });
      showToast("Alert resolved.", "success");
    } catch (err) {
      console.error("Failed to resolve alert:", err);
      showToast("Failed to resolve alert. Make sure you are authorized.", "error");
    } finally {
      setActioningId(null);
    }
  };

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
          <div className="skeleton" style={{ height: "48px", marginBottom: "var(--space-3)" }} />
          <div className="skeleton" style={{ height: "48px", marginBottom: "var(--space-3)" }} />
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
          <div className="card-header-title">
            Open Alerts ({alerts.length})
          </div>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {alerts.length === 0 ? (
          <div className="empty-state" style={{ padding: "var(--space-8) var(--space-4)" }}>
            <div className="empty-state-title">No open alerts</div>
            <div className="empty-state-description">
              Platform operations are currently running smoothly.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {alerts.map((alert) => {
              // Map severity to visual indicator border color
              const borderLeftColor =
                alert.severity === "critical"
                  ? "var(--danger)"
                  : alert.severity === "warning"
                  ? "var(--warning)"
                  : "var(--info)";

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
                    background: alert.severity === "critical" 
                      ? "color-mix(in srgb, var(--danger) 3%, transparent)"
                      : "transparent"
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", color: "var(--text)" }}>
                        {alert.category.toUpperCase()}
                      </span>
                      <StatusBadge status={alert.severity} />
                      {alert.reference && (
                        <code style={{ fontSize: "var(--font-size-xs)", background: "var(--bg-root)", padding: "2px 6px", borderRadius: "var(--radius-sm)" }}>
                          {alert.reference}
                        </code>
                      )}
                    </div>
                    <p style={{ margin: "var(--space-1) 0 0 0", fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                      {alert.message}
                    </p>
                    <small style={{ display: "block", marginTop: "var(--space-1)", fontSize: "11px", color: "var(--text-muted)" }}>
                      {new Date(alert.createdAt).toLocaleString()}
                    </small>
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                    {alert.status === "open" && (
                      <button
                        onClick={() => handleAcknowledge(alert._id)}
                        disabled={actioningId !== null}
                        className="btn btn-secondary"
                        style={{ height: "32px", fontSize: "var(--font-size-xs)", padding: "0 var(--space-3)" }}
                      >
                        {actioningId === alert._id ? "..." : "Acknowledge"}
                      </button>
                    )}
                    <button
                      onClick={() => handleResolve(alert._id)}
                      disabled={actioningId !== null}
                      className="btn btn-primary"
                      style={{ height: "32px", fontSize: "var(--font-size-xs)", padding: "0 var(--space-3)" }}
                    >
                      {actioningId === alert._id ? "..." : "Resolve"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
