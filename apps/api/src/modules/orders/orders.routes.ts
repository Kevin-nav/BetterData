import type { PurchaseRequest } from "@betterdata/contracts";
import type { FastifyInstance } from "fastify";

export async function registerOrderRoutes(server: FastifyInstance) {
  server.post<{ Body: PurchaseRequest }>("/orders", async (request, reply) => {
    if (!request.body.confirmRecipientIsCorrect) {
      return reply.code(400).send({
        message: "Recipient number confirmation is required."
      });
    }

    return reply.code(202).send({
      reference: "pending-provider-integration",
      status: "pending"
    });
  });

  server.post("/webhooks/datamart", async () => ({
    received: true
  }));
}
