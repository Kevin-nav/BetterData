import { randomUUID } from "node:crypto";

import type { PurchaseRequest } from "@betterdata/contracts";
import type { FastifyInstance } from "fastify";

import { resolveRateLimitConfig } from "../../config/rateLimits";
import { createOrderStore } from "../../orders/orderStore";
import { getActiveDataVendor } from "../../vendors/activeVendor";
import { mapVendorErrorToHttp } from "../../vendors/errors";
import { validatePurchaseRequest } from "./orderValidation";

export async function registerOrderRoutes(server: FastifyInstance) {
  const rateLimits = resolveRateLimitConfig();
  const orderStore = createOrderStore();

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
    let result;

    try {
      result = await vendor.purchase({
        packageId: body.packageId,
        network: body.network,
        recipientPhone: body.recipientPhone,
        idempotencyKey
      });
      await orderStore.recordVendorResult(order.reference, {
        vendorOrderReference: result.vendorOrderReference,
        vendorRaw: result.raw,
        status: result.status
      });
    } catch (error) {
      request.log.error(
        { error, orderReference: order.reference, vendorId: vendor.id },
        "Vendor purchase failed"
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
        status: result.status,
        vendorOrderReference: result.vendorOrderReference,
        estimatedDeliverySeconds: result.estimatedDeliverySeconds
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
        normalizeWebhookHeaders(request.headers)
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
