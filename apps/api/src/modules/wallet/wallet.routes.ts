import type { FastifyInstance } from "fastify";

export async function registerWalletRoutes(server: FastifyInstance) {
  server.get("/wallet", async () => ({
    balanceGhs: 0,
    transactions: []
  }));
}
