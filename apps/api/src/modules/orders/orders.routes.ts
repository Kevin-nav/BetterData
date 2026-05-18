import { randomUUID } from "node:crypto";

import type { PurchaseRequest } from "@betterdata/contracts";
import type { FastifyInstance } from "fastify";

import { resolveRateLimitConfig } from "../../config/rateLimits";
import { createOrderStore } from "../../orders/orderStore";
import { createQueueProvider, QUEUE_NAMES, type PurchaseJob } from "../../queue";
import { getActiveDataVendor } from "../../vendors/activeVendor";
import { mapVendorErrorToHttp } from "../../vendors/errors";
import { verifyDataVendorWebhook } from "../../vendors/webhookVerification";
import { validatePurchaseRequest } from "./orderValidation";

export async function registerOrderRoutes(server: FastifyInstance) {
  const rateLimits = resolveRateLimitConfig();
  const orderStore = createOrderStore();
  const queue = await createQueueProvider();

  server.post<{ Body: PurchaseRequest }>(
    "/orders",
    {
      config: {
        rateLimit: rateLimits.ordersCreate
      }
    },
    async (request, reply) => {
    const validation = validatePurchaseRequest(request.body);

    if (!validation.ok) {
      return reply.code(400).send({
        message: validation.message
      });
    }

    const body = validation.value;
    const vendor = getActiveDataVendor();
    const idempotencyKey = randomUUID();
    const order = await orderStore.createIntent({
      body,
      vendor,
      idempotencyKey
    });
    try {
      await queue.enqueue(QUEUE_NAMES.purchaseRequested, toPurchaseJob(order));
    } catch (error) {
      request.log.error(
        { error, orderReference: order.reference, vendorId: vendor.id },
        "Purchase job enqueue failed"
      );

      const mapped = mapVendorErrorToHttp(error);

      if (mapped.retryAfterSeconds !== undefined) {
        reply.header("Retry-After", String(mapped.retryAfterSeconds));
      }

      return reply.code(mapped.statusCode).send({
        message: mapped.message,
        vendorId: vendor.id
      });
    }

      return reply.code(202).send({
        reference: order.reference,
        vendorId: vendor.id,
        status: order.status,
        estimatedDeliverySeconds: 30 * 60
      });
    }
  );

  server.get<{ Params: { reference: string } }>(
    "/orders/:reference/status",
    {
      config: {
        rateLimit: rateLimits.orderStatus
      }
    },
    async (request, reply) => {
      const vendor = getActiveDataVendor();
      const order = await orderStore.getByReference(request.params.reference);

      if (order && !order.vendorOrderReference) {
        return {
          reference: request.params.reference,
          vendorId: vendor.id,
          status: order.status
        };
      }

      let status;

      try {
        status = await vendor.getOrderStatus(
          order?.vendorOrderReference ?? request.params.reference
        );

        if (order?.vendorOrderReference) {
          await orderStore.recordVendorResult(order.reference, {
            vendorOrderReference: order.vendorOrderReference,
            status
          });
        }
      } catch (error) {
        request.log.error({ error, vendorId: vendor.id }, "Vendor status lookup failed");

        const mapped = mapVendorErrorToHttp(error);

        if (mapped.retryAfterSeconds !== undefined) {
          reply.header("Retry-After", String(mapped.retryAfterSeconds));
        }

        return reply.code(mapped.statusCode).send({
          message: mapped.message,
          vendorId: vendor.id
        });
      }

      return {
        reference: request.params.reference,
        vendorId: vendor.id,
        status
      };
    }
  );

  server.post(
    "/webhooks/data-vendor",
    {
      config: {
        rateLimit: rateLimits.webhook
      }
    },
    async (request, reply) => {
    const vendor = getActiveDataVendor();
    const headers = normalizeWebhookHeaders(request.headers);
    const verification = verifyDataVendorWebhook(headers);

    if (!verification.ok) {
      request.log.warn({ vendorId: vendor.id }, "Invalid vendor webhook credentials");

      return reply.code(verification.statusCode).send({
        message: verification.message,
        vendorId: vendor.id,
        received: false
      });
    }

    if (!vendor.normalizeWebhook) {
      return reply.code(501).send({
        message: "Active data vendor does not support webhooks.",
        vendorId: vendor.id,
        received: false
      });
    }

    try {
      const event = await vendor.normalizeWebhook(
        request.body,
        headers
      );

      return {
        received: true,
        vendorId: vendor.id,
        event
      };
    } catch (error) {
      if (isWebhookValidationError(error)) {
        request.log.warn({ error, vendorId: vendor.id }, "Invalid vendor webhook");

        return reply.code(400).send({
          message: "Invalid vendor webhook payload.",
          vendorId: vendor.id,
          received: false
        });
      }

      request.log.error({ error, vendorId: vendor.id }, "Vendor webhook failed");

      return reply.code(500).send({
        message: "Vendor webhook processing failed.",
        vendorId: vendor.id,
        received: false
      });
    }
    }
  );
}

function toPurchaseJob(order: {
  reference: string;
  packageId: string;
  network: PurchaseJob["network"];
  recipientPhone: string;
  paymentMethod: PurchaseJob["paymentMethod"];
  vendorId: string;
  idempotencyKey: string;
}): PurchaseJob {
  return {
    kind: "purchase",
    orderReference: order.reference,
    packageId: order.packageId,
    network: order.network,
    recipientPhone: order.recipientPhone,
    paymentMethod: order.paymentMethod,
    vendorId: order.vendorId,
    idempotencyKey: order.idempotencyKey,
    attempt: 0,
    createdAt: new Date().toISOString()
  };
}

function isWebhookValidationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("webhook") ||
    message.includes("signature") ||
    message.includes("malformed") ||
    message.includes("invalid") ||
    message.includes("order reference")
  );
}

function normalizeWebhookHeaders(
  headers: Record<string, string | string[] | undefined>
) {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
      .map(([key, value]) => [
        key.toLowerCase(),
        Array.isArray(value) ? value.join(",") : value
      ])
  );
}
