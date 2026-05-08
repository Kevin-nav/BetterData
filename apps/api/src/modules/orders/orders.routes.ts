import type { PurchaseRequest } from "@betterdata/contracts";
import type { FastifyInstance } from "fastify";

import { getActiveDataVendor } from "../../vendors/activeVendor";

export async function registerOrderRoutes(server: FastifyInstance) {
  server.post<{ Body: PurchaseRequest }>("/orders", async (request, reply) => {
    if (!request.body.confirmRecipientIsCorrect) {
      return reply.code(400).send({
        message: "Recipient number confirmation is required."
      });
    }

    const vendor = getActiveDataVendor();

    return reply.code(202).send({
      reference: "pending-provider-integration",
      vendorId: vendor.id,
      status: "pending"
    });
  });

  server.post("/webhooks/data-vendor", async (request) => {
    const vendor = getActiveDataVendor();

    if (!vendor.normalizeWebhook) {
      return {
        received: true,
        vendorId: vendor.id,
        normalized: false
      };
    }

    const event = await vendor.normalizeWebhook(
      request.body,
      request.headers as Record<string, string>
    );

    return {
      received: true,
      vendorId: vendor.id,
      event
    };
  });
}
