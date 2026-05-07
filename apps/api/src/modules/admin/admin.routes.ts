import type { FastifyInstance } from "fastify";

export async function registerAdminRoutes(server: FastifyInstance) {
  server.get("/admin/overview", async () => ({
    revenue: { dailyGhs: 0, weeklyGhs: 0, monthlyGhs: 0 },
    datamartBalanceGhs: 0,
    pendingAgentApplications: 0
  }));
}
