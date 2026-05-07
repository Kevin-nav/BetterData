import { NETWORK_CODES } from "@betterdata/contracts";
import type { FastifyInstance } from "fastify";

export async function registerPackageRoutes(server: FastifyInstance) {
  server.get("/data-packages", async () => ({
    networks: NETWORK_CODES,
    packages: []
  }));
}
