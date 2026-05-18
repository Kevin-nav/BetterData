const dashboardCards = [
  { label: "Daily revenue", value: "GHS 0" },
  { label: "Vendor balance", value: "GHS 0" },
  { label: "Pending agents", value: "0" },
  { label: "Open orders", value: "0" }
];

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

export default async function AdminDashboardPage() {
  const paymentOps = await loadPaymentOpsSummary();

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
        <div className="metric-grid">
          {dashboardCards.map((card) => (
            <article key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
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
                        {alert.reference ? ` · ${alert.reference}` : ""}
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

async function loadPaymentOpsSummary(): Promise<PaymentOpsSummary> {
  const baseUrl = process.env.API_BASE_URL;
  const serviceSecret = process.env.BETTERDATA_SERVICE_SECRET;

  if (!baseUrl || !serviceSecret) {
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

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/admin/payment-ops`, {
      headers: {
        "x-betterdata-service-secret": serviceSecret
      },
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

function formatConfigKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}
import {
  acknowledgeOpsAlert,
  resolveOpsAlert,
  updatePaymentConfig
} from "./actions";
