import type { FastifyInstance } from "fastify";

import {
  listSimulatedOrders,
  setSimulatedOrderStatus
} from "../../vendors/simulation/store";

export async function registerVendorSimulationRoutes(server: FastifyInstance) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  server.get("/dev/vendor-simulation/orders", async () => ({
    orders: listSimulatedOrders()
  }));

  server.post<{
    Params: { reference: string };
    Body: { status: "processing" | "completed" | "failed" | "refunded" };
  }>("/dev/vendor-simulation/orders/:reference/status", async (request, reply) => {
    const order = setSimulatedOrderStatus(
      request.params.reference,
      request.body.status
    );

    if (!order) {
      return reply.code(404).send({ message: "Simulated order not found." });
    }

    return { order };
  });
}
