"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { convexApi } from "@betterdata/app-api";
import {
  createBetterDataApiClient,
  type AdminOverviewResponse,
} from "@betterdata/api-client";
import { useAdminAuth } from "../lib/auth";
import { MetricCard } from "../components/MetricCard";
import { OpsAlertPanel } from "../components/OpsAlertPanel";
import { PaymentConfigEditor } from "../components/PaymentConfigEditor";
import { StatusBadge } from "../components/StatusBadge";

type RecentOrder = {
  _id: string;
  reference: string;
  network: string;
  amountGhs: number;
  status: string;
};

type DashboardStats = {
  totalUsers: number;
  totalAgents: number;
  pendingAgentApplications: number;
  recentOrders: RecentOrder[];
};

type RevenueOverview = {
  dailyGhs: number;
  weeklyGhs: number;
  monthlyGhs: number;
};

export default function AdminDashboardPage() {
  const { getAuthHeaders } = useAdminAuth();

  // Convex Subscriptions (Real-time)
  const stats = useQuery(convexApi.admin.dashboardStats) as
    | DashboardStats
    | undefined;
  const revenue = useQuery(convexApi.admin.revenueOverview) as
    | RevenueOverview
    | undefined;

  // API State (Vendor Balance, Queue Depths, Redis Metrics)
  const [apiData, setApiData] = useState<AdminOverviewResponse | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchApiOverview = useCallback(async () => {
    setApiLoading(true);
    setApiError(null);
    try {
      const headers = await getAuthHeaders();
      const client = createBetterDataApiClient({
        baseUrl:
          process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000",
        headers,
      });
      const data = await client.getAdminOverview();
      setApiData(data);
    } catch (err: any) {
      console.error("Failed to fetch API overview:", err);
      setApiError(err?.message || "Failed to load vendor and queue metrics.");
    } finally {
      setApiLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchApiOverview();
  }, [fetchApiOverview]);

  // Format currencies
  const formatGhs = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "GHS 0.00";
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(val);
  };

  const recentOrders = stats?.recentOrders || [];
  const metrics = apiData?.metrics || {};

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">
            Platform operations and financials at a glance
          </p>
        </div>
        <div>
          <button
            onClick={fetchApiOverview}
            disabled={apiLoading}
            className="btn btn-secondary"
            style={{ height: "40px", padding: "0 var(--space-4)" }}
          >
            {apiLoading ? "Refreshing..." : "Refresh Queue & Vendor"}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="metric-grid">
        <MetricCard
          label="Daily Revenue"
          value={revenue ? formatGhs(revenue.dailyGhs) : "..."}
          detail="Last 24 hours"
          tone="neutral"
        />
        <MetricCard
          label="Weekly Revenue"
          value={revenue ? formatGhs(revenue.weeklyGhs) : "..."}
          detail="Last 7 days"
          tone="neutral"
        />
        <MetricCard
          label="Monthly Revenue"
          value={revenue ? formatGhs(revenue.monthlyGhs) : "..."}
          detail="Last 30 days"
          tone="neutral"
        />
        <MetricCard
          label="Vendor Balance"
          value={
            apiData?.vendorBalanceGhs !== null
              ? formatGhs(apiData?.vendorBalanceGhs)
              : "..."
          }
          detail={
            apiData?.vendor
              ? `${apiData.vendor.displayName} • Status: ${apiData.vendor.balanceStatus.toUpperCase()}`
              : "Checking vendor..."
          }
          tone={apiData?.vendor?.balanceStatus}
        />
      </div>

      {/* Operational Stats Row */}
      <div className="grid-3">
        {/* User Stats Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-header-subtitle">Users</div>
              <div className="card-header-title">Accounts Overview</div>
            </div>
          </div>
          <div
            className="card-body"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "var(--space-2)",
              }}
            >
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Total Registered
              </span>
              <strong style={{ color: "var(--text)" }}>
                {stats?.totalUsers ?? "..."}
              </strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "var(--space-2)",
              }}
            >
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Active Agents
              </span>
              <strong style={{ color: "var(--text)" }}>
                {stats?.totalAgents ?? "..."}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Pending Agent Apps
              </span>
              <strong
                style={{
                  color: stats?.pendingAgentApplications
                    ? "var(--warning)"
                    : "var(--text)",
                }}
              >
                {stats?.pendingAgentApplications ?? "..."}
              </strong>
            </div>
          </div>
        </div>

        {/* Fulfillment Queue Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-header-subtitle">Fulfillment</div>
              <div className="card-header-title">RabbitMQ Queues</div>
            </div>
          </div>
          <div
            className="card-body"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "var(--space-2)",
              }}
            >
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Purchase Queue Depth
              </span>
              <strong style={{ color: "var(--text)" }}>
                {apiData?.queue?.purchaseDepth ?? "..."}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Dead Letter Queue
              </span>
              <strong
                style={{
                  color: apiData?.queue?.deadLetterDepth
                    ? "var(--danger)"
                    : "var(--text)",
                }}
              >
                {apiData?.queue?.deadLetterDepth ?? "..."}
              </strong>
            </div>
          </div>
        </div>

        {/* Redis Performance / System Cache Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-header-subtitle">Cache & Telemetry</div>
              <div className="card-header-title">System Metrics</div>
            </div>
          </div>
          <div
            className="card-body"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "var(--space-2)",
              }}
            >
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Successful Deliveries
              </span>
              <strong style={{ color: "var(--success)" }}>
                {metrics["purchase.success"] ?? 0}
              </strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "var(--space-2)",
              }}
            >
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Failed/Dead Letter Jobs
              </span>
              <strong style={{ color: "var(--danger)" }}>
                {metrics["purchase.dead_letter"] ?? 0}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Active Retries
              </span>
              <strong style={{ color: "var(--warning)" }}>
                {metrics["purchase.retry"] ?? 0}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Recent Orders + Ops Panel & Config Editor */}
      <div className="grid-2">
        {/* Left Column: Recent Orders & API Status */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          {/* Recent Orders Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-header-subtitle">Fulfillment</div>
                <div className="card-header-title">Recent Orders</div>
              </div>
            </div>
            <div
              className="card-body"
              style={{ padding: 0, overflowX: "auto" }}
            >
              {recentOrders.length === 0 ? (
                <div
                  className="empty-state"
                  style={{ padding: "var(--space-8) var(--space-4)" }}
                >
                  <div className="empty-state-title">No orders found</div>
                  <div className="empty-state-description">
                    There are no orders in the platform yet.
                  </div>
                </div>
              ) : (
                <table
                  className="table"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <thead>
                    <tr>
                      <th
                        className="table-header"
                        style={{
                          padding: "var(--space-3) var(--space-4)",
                          textAlign: "left",
                        }}
                      >
                        Reference
                      </th>
                      <th
                        className="table-header"
                        style={{
                          padding: "var(--space-3) var(--space-4)",
                          textAlign: "left",
                        }}
                      >
                        Network
                      </th>
                      <th
                        className="table-header"
                        style={{
                          padding: "var(--space-3) var(--space-4)",
                          textAlign: "right",
                        }}
                      >
                        Amount
                      </th>
                      <th
                        className="table-header"
                        style={{
                          padding: "var(--space-3) var(--space-4)",
                          textAlign: "center",
                        }}
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order._id} className="table-row">
                        <td
                          className="table-cell"
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            fontFamily: "monospace",
                          }}
                        >
                          {order.reference}
                        </td>
                        <td
                          className="table-cell"
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            textTransform: "uppercase",
                          }}
                        >
                          {order.network}
                        </td>
                        <td
                          className="table-cell"
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            textAlign: "right",
                          }}
                        >
                          {formatGhs(order.amountGhs)}
                        </td>
                        <td
                          className="table-cell"
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            textAlign: "center",
                          }}
                        >
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* DataMart Vendor API Status Section */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-header-subtitle">Integrations</div>
                <div className="card-header-title">DataMart Gateway</div>
              </div>
            </div>
            <div
              className="card-body"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              {apiError ? (
                <div
                  style={{
                    color: "var(--danger)",
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 500,
                  }}
                >
                  {apiError}
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--font-size-sm)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      API Gateway Endpoint
                    </span>
                    <code
                      style={{
                        fontSize: "var(--font-size-xs)",
                        background: "var(--bg-root)",
                        padding: "2px 6px",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      {process.env.NEXT_PUBLIC_API_BASE_URL ??
                        "http://localhost:4000"}
                    </code>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--font-size-sm)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Vendor Health
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background:
                            apiData?.vendor?.balanceStatus === "critical"
                              ? "var(--danger)"
                              : "var(--success)",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "var(--font-size-sm)",
                          fontWeight: 600,
                        }}
                      >
                        {apiData?.vendor?.balanceStatus === "critical"
                          ? "Low Balance Warning"
                          : "Online"}
                      </span>
                    </span>
                  </div>
                  {apiData?.vendor?.checkedAt && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--font-size-sm)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Last Checked
                      </span>
                      <span
                        style={{
                          fontSize: "var(--font-size-xs)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {new Date(apiData.vendor.checkedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Alerts & Config Editor */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          <OpsAlertPanel />
          <PaymentConfigEditor />
        </div>
      </div>
    </div>
  );
}
