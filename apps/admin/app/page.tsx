import { createBetterDataApiClient } from "@betterdata/api-client";

import {
  acknowledgeOpsAlert,
  resolveOpsAlert,
  updatePaymentConfig
} from "./actions";

type DashboardCard = {
  label: string;
  value: string;
  tone?: "neutral" | "healthy" | "low" | "critical" | "unknown";
  detail?: string;
};

type PaymentOpsSummary = {
  config: Record<string, number | null>;
  alerts: Array<{
    _id: string;
    severity: "info" | "warning" | "critical";
    category: string;
    message: string;
    reference?: string;
    retryable: boolean;
    retryStatus?: string;
  }>;
};

const apiBaseUrl =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [overviewState, paymentOps] = await Promise.all([
    loadAdminOverview(),
    loadPaymentOpsSummary()
  ]);
  const overview = overviewState.overview;
  const cards: DashboardCard[] = [
    { label: "Daily revenue", value: formatGhs(overview.revenue.dailyGhs) },
    {
      label: "Vendor balance",
      value: formatNullableGhs(overview.vendor.balanceGhs),
      tone: overview.vendor.balanceStatus,
      detail: vendorBalanceDetail(overview.vendor)
    },
    {
      label: "Pending agents",
      value: String(overview.pendingAgentApplications)
    },
    {
      label: "Purchase queue",
      value: String(overview.queue?.purchaseDepth ?? 0),
      detail: `${overview.queue?.deadLetterDepth ?? 0} dead-lettered`
    }
  ];

  return (
    <main className="admin-shell">
      <aside>
        <strong>Better Data</strong>
        <nav aria-label="Admin navigation">
          <a href="/">Overview</a>
          <a href="/orders">Orders</a>
          <a href="/agents">Agents</a>
          <a href="/pricing">Pricing</a>
        </nav>
      </aside>
      <section>
        <header>
          <p>Admin</p>
          <h1>Operations dashboard</h1>
        </header>
        {overviewState.error ? (
          <div className="alert-banner">{overviewState.error}</div>
        ) : null}
        <div className="metric-grid">
          {cards.map((card) => (
            <article
              className={card.tone ? `metric-card tone-${card.tone}` : "metric-card"}
              key={card.label}
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              {card.detail ? <small>{card.detail}</small> : null}
            </article>
          ))}
        </div>

        <div className="ops-layout">
          <article className="ops-panel">
            <div className="panel-head">
              <span>Payments</span>
              <strong>Configuration</strong>
            </div>
            <div className="config-list">
              {Object.entries(paymentOps.config).map(([key, value]) => (
                <form key={key} action={updatePaymentConfig} className="config-row">
                  <input type="hidden" name="key" value={key} />
                  <label>
                    <span>{formatConfigKey(key)}</span>
                    <input
                      name="value"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={value ?? ""}
                      placeholder="Not set"
                    />
                  </label>
                  <button type="submit">Save</button>
                </form>
              ))}
            </div>
          </article>

          <article className="ops-panel">
            <div className="panel-head">
              <span>Operations</span>
              <strong>Open alerts</strong>
            </div>
            {paymentOps.alerts.length > 0 ? (
              <ul className="alert-list">
                {paymentOps.alerts.slice(0, 6).map((alert) => (
                  <li key={alert._id} data-severity={alert.severity}>
                    <div>
                      <strong>{alert.message}</strong>
                      <span>
                        {alert.category}
                        {alert.reference ? ` / ${alert.reference}` : ""}
                      </span>
                    </div>
                    <div className="alert-actions">
                      <em>{alert.retryable ? alert.retryStatus ?? "retryable" : alert.severity}</em>
                      <form action={acknowledgeOpsAlert}>
                        <input type="hidden" name="alertId" value={alert._id} />
                        <button type="submit">Acknowledge</button>
                      </form>
                      <form action={resolveOpsAlert}>
                        <input type="hidden" name="alertId" value={alert._id} />
                        <button type="submit">Resolve</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No open payment alerts.</p>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}

async function loadAdminOverview() {
  try {
    const client = createBetterDataApiClient({
      baseUrl: apiBaseUrl,
      fetch,
      ...adminApiHeaders()
    });

    return { overview: await client.getAdminOverview() };
  } catch {
    return {
      error: "Admin API is unavailable or authentication failed.",
      overview: {
        revenue: { dailyGhs: 0, weeklyGhs: 0, monthlyGhs: 0 },
        vendorBalanceGhs: null,
        vendor: {
          id: "unknown",
          displayName: "Data vendor",
          balanceGhs: null,
          balanceStatus: "unknown" as const,
          checkedAt: new Date().toISOString()
        },
        queue: {
          purchaseDepth: 0,
          deadLetterDepth: 0
        },
        pendingAgentApplications: 0
      }
    };
  }
}

async function loadPaymentOpsSummary(): Promise<PaymentOpsSummary> {
  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/admin/payment-ops`, {
      ...adminApiHeaders(),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Payment ops request failed with ${response.status}.`);
    }

    return (await response.json()) as PaymentOpsSummary;
  } catch {
    return {
      config: {
        minimumWalletTopUpGhs: 10,
        maximumWalletTopUpGhs: 500,
        paymentIntentExpirySeconds: 1800,
        agentOnboardingFeeGhs: null
      },
      alerts: []
    };
  }
}

function adminApiHeaders(): { headers?: Record<string, string> } {
  return process.env.ADMIN_API_KEY
    ? { headers: { "X-Admin-Api-Key": process.env.ADMIN_API_KEY } }
    : {};
}

function formatGhs(value: number) {
  return `GHS ${value.toLocaleString("en-GH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`;
}

function formatNullableGhs(value: number | null) {
  return value === null ? "Unavailable" : formatGhs(value);
}

function vendorBalanceDetail(vendor: {
  displayName: string;
  balanceStatus: DashboardCard["tone"];
}) {
  switch (vendor.balanceStatus) {
    case "critical":
      return `${vendor.displayName} top-up needed now`;
    case "low":
      return `${vendor.displayName} balance is running low`;
    case "healthy":
      return `${vendor.displayName} balance is healthy`;
    default:
      return `${vendor.displayName} balance check failed`;
  }
}

function formatConfigKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}
