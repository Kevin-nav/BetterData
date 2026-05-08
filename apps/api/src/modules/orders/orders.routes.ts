import { randomUUID } from "node:crypto";

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
    const idempotencyKey = randomUUID();
    const result = await vendor.purchase({
      packageId: request.body.packageId,
      network: request.body.network,
      recipientPhone: request.body.recipientPhone,
      idempotencyKey
    });

    return reply.code(202).send({
      reference: result.vendorOrderReference,
      vendorId: vendor.id,
      status: result.status,
      estimatedDeliverySeconds: result.estimatedDeliverySeconds
    });
  });

  server.get<{ Params: { reference: string } }>(
    "/orders/:reference/status",
    async (request) => {
      const vendor = getActiveDataVendor();
      const status = await vendor.getOrderStatus(request.params.reference);

      return {
        reference: request.params.reference,
        vendorId: vendor.id,
        status
      };
    }
  );

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
