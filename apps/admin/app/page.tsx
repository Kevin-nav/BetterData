import { createBetterDataApiClient } from "@betterdata/api-client";

type DashboardCard = {
  label: string;
  value: string;
  tone?: "neutral" | "healthy" | "low" | "critical" | "unknown";
  detail?: string;
};

const apiBaseUrl =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const overview = await loadAdminOverview();
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

    return await client.getAdminOverview();
  } catch {
    return {
      revenue: { dailyGhs: 0, weeklyGhs: 0, monthlyGhs: 0 },
      vendorBalanceGhs: null,
      vendor: {
        id: "unknown",
        displayName: "Data vendor",
        balanceGhs: null,
        balanceStatus: "unknown" as const,
        checkedAt: new Date().toISOString()
      },
      pendingAgentApplications: 0
    };
  }
}

function adminApiHeaders() {
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
