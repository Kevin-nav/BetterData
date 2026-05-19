import { createBetterDataApiClient } from "@betterdata/api-client";

const apiBaseUrl =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orderState = await loadOrders();
  const orders = orderState.orders;

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
          <h1>Orders</h1>
        </header>
        {orderState.error ? (
          <div className="alert-banner">{orderState.error}</div>
        ) : null}
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Status</th>
                <th>Network</th>
                <th>Recipient</th>
                <th>Payment</th>
                <th>Vendor ref</th>
              </tr>
            </thead>
            <tbody>
              {orders.length > 0 ? (
                orders.map((order) => (
                  <tr key={order.reference}>
                    <td>{order.reference}</td>
                    <td>
                      <span className={`status-pill status-${order.status}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{order.network}</td>
                    <td>{order.recipientPhone}</td>
                    <td>{order.paymentStatus}</td>
                    <td>{order.vendorOrderReference ?? "Pending"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>No orders available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

async function loadOrders() {
  try {
    const client = createBetterDataApiClient({
      baseUrl: apiBaseUrl,
      fetch,
      ...(process.env.ADMIN_API_KEY
        ? { headers: { "X-Admin-Api-Key": process.env.ADMIN_API_KEY } }
        : {})
    });
    const response = await client.listAdminOrders();

    return { orders: response.orders };
  } catch {
    return {
      orders: [],
      error: "Admin orders API is unavailable or authentication failed."
    };
  }
}
