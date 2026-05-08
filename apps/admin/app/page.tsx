const dashboardCards = [
  { label: "Daily revenue", value: "GHS 0" },
  { label: "Vendor balance", value: "GHS 0" },
  { label: "Pending agents", value: "0" },
  { label: "Open orders", value: "0" }
];

export default function AdminDashboardPage() {
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
      </section>
    </main>
  );
}
