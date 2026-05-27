import { randomUUID } from "node:crypto";

import type { PurchaseRequest } from "@betterdata/contracts";
import type { FastifyInstance } from "fastify";
import type { FastifyRequest } from "fastify";

import { resolveRateLimitConfig } from "../../config/rateLimits";
import { createOrderStore } from "../../orders/orderStore";
import { verifyPurchasePaymentSafety } from "../../payments/paymentSafety";
import { createQueueProvider, QUEUE_NAMES, type PurchaseJob } from "../../queue";
import { getActiveDataVendor } from "../../vendors/activeVendor";
import { mapVendorErrorToHttp } from "../../vendors/errors";
import { verifyDataVendorWebhook } from "../../vendors/webhookVerification";
import { validatePurchaseRequest } from "./orderValidation";
import { requireRequestUser } from "../auth/requestUser";
import { orderFunctions } from "@betterdata/app-api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { createConvexHttpClient } from "../../convexClient";
import { getRequiredEnv } from "@betterdata/config";
import {
  getPricingContextForApi,
  resolveVendorPackageCustomerPriceGhs
} from "../packages/packages.routes";

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
    const convex = createConvexHttpClient();
    const user = await getOptionalUserForOrder(request, convex);

    if (body.paymentMethod === "wallet") {
      if (user === null) {
        return reply.code(401).send({
          message: "Please log in to buy data with your wallet."
        });
      }

      try {
        const order = await createVerifiedWalletOrder({
          body,
          vendor,
          user,
          log: request.log
        });

        try {
          await queue.enqueue(QUEUE_NAMES.purchaseRequested, toPurchaseJob(order));
        } catch (error) {
          request.log.error(
            { error, orderReference: order.reference, vendorId: vendor.id },
            "Wallet purchase job enqueue failed"
          );

          await orderStore.recordOrderFailure(order.reference, {
            status: "failed",
            vendorRaw: {
              enqueueError: serializeError(error),
              vendorId: vendor.id
            }
          });
          await orderStore.refundToWallet(order.reference, {
            notes: "Automatic wallet refund because fulfillment could not be queued"
          });

          return reply.code(503).send({
            message:
              "Your wallet was refunded because fulfillment could not start. Please try again shortly."
          });
        }

        return reply.code(202).send({
          reference: order.reference,
          vendorId: vendor.id,
          status: order.status,
          estimatedDeliverySeconds: 30 * 60
        });
      } catch (error) {
        request.log.warn(
          { error, vendorId: vendor.id, userId: user.id },
          "Wallet data purchase failed validation"
        );
        const message = readWalletPurchaseError(error);
        const statusCode = message.includes("too low") ? 402 : 400;

        return reply.code(statusCode).send({
          message
        });
      }
    }

    const paymentSafety = verifyPurchasePaymentSafety(body);

    if (!paymentSafety.ok) {
      return reply.code(paymentSafety.statusCode).send({
        message: paymentSafety.message
      });
    }

    const idempotencyKey = randomUUID();
    const order = await orderStore.createIntent({
      body,
      vendor,
      idempotencyKey,
      ...(user !== null ? { userId: user.id } : {}),
      paymentStatus: paymentSafety.paymentStatus
    });

    try {
      await queue.enqueue(QUEUE_NAMES.purchaseRequested, toPurchaseJob(order));
    } catch (error) {
      request.log.error(
        { error, orderReference: order.reference, vendorId: vendor.id },
        "Purchase job enqueue failed"
      );

      const mapped = mapVendorErrorToHttp(error);

      try {
        await orderStore.recordOrderFailure(order.reference, {
          status: "failed",
          vendorRaw: {
            enqueueError: serializeError(error),
            vendorId: vendor.id
          }
        });
      } catch (compensationError) {
        request.log.error(
          {
            error: compensationError,
            orderReference: order.reference,
            vendorId: vendor.id
          },
          "Purchase intent failure compensation failed"
        );
      }

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

  server.post("/internal/orders/status-refresh/run", async (request) => {
    requireInternalServiceRequest(request.headers);

    const processingOrders = await orderStore.listOrders({ status: "processing" });
    const results = [];

    for (const order of processingOrders) {
      if (!order.vendorOrderReference) {
        results.push({
          reference: order.reference,
          status: "skipped",
          reason: "missing vendor order reference"
        });
        continue;
      }

      await queue.enqueue(QUEUE_NAMES.statusRefresh, {
        kind: "status-refresh",
        orderReference: order.reference,
        vendorId: order.vendorId,
        vendorOrderReference: order.vendorOrderReference,
        attempt: 0,
        createdAt: new Date().toISOString()
      });

      results.push({
        reference: order.reference,
        status: "queued"
      });
    }

    return {
      processed: results.length,
      results
    };
  });

  server.post(
    "/webhooks/data-vendor",
    {
      config: {
        rateLimit: rateLimits.webhook,
        rawBody: true
      }
    },
    async (request, reply) => {
    const vendor = getActiveDataVendor();
    const headers = normalizeWebhookHeaders(request.headers);
    const verification = verifyDataVendorWebhook(
      headers,
      readRawBody(request)
    );

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

  /**
   * GET /orders
   *
   * Fetches order history for the authenticated user.
   */
  server.get("/orders", async (request, reply) => {
    const convex = createConvexHttpClient();

    let user;
    try {
      user = await requireRequestUser(request, convex);
    } catch (error) {
      return reply.code(401).send({ message: "Authentication is required." });
    }

    try {
      const orders = await convex.query(orderFunctions.listForUserForApi, {
        apiSecret: getRequiredEnv("CONVEX_API_SECRET"),
        userId: user.id as Id<"users">
      });

      return {
        orders: orders.map((order) => ({
          id: order._id,
          reference: order.reference,
          packageId: order.packageId,
          vendorId: order.vendorId,
          ...(order.vendorOrderReference !== undefined
            ? { vendorOrderReference: order.vendorOrderReference }
            : {}),
          network: order.network,
          recipientPhone: order.recipientPhone,
          amountGhs: order.amountGhs,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          status: order.status,
          createdAt: new Date(order.recipientConfirmedAt || order._creationTime).toISOString(),
          updatedAt: new Date(order.recipientConfirmedAt || order._creationTime).toISOString()
        }))
      };
    } catch (error) {
      request.log.error({ error, userId: user.id }, "Failed to list orders for user");
      return reply.code(500).send({ message: "Unable to retrieve order history." });
    }
  });
}

async function createVerifiedWalletOrder(input: {
  body: PurchaseRequest;
  vendor: ReturnType<typeof getActiveDataVendor>;
  user: { id: string; role?: string };
  log: { warn: (obj: Record<string, unknown>, msg: string) => void };
}) {
  const selected = await resolveWalletPurchasePackage(input);
  const reference = createOrderReference();
  const idempotencyKey = randomUUID();
  const createWalletPurchaseForApi = orderFunctions.createWalletPurchaseForApi;
  const convex = createConvexHttpClient();

  const order = await convex.mutation(createWalletPurchaseForApi, {
    apiSecret: getRequiredEnv("CONVEX_API_SECRET"),
    reference,
    userId: input.user.id as Id<"users">,
    packageId: selected.packageId,
    vendorId: input.vendor.id,
    vendorPackageId: selected.vendorPackageId,
    network: selected.network,
    recipientPhone: input.body.recipientPhone,
    amountGhs: selected.amountGhs,
    idempotencyKey,
    confirmRecipientIsCorrect: true
  });

  return {
    reference: order.reference,
    packageId: selected.vendorPackageId,
    network: order.network,
    recipientPhone: order.recipientPhone,
    paymentMethod: order.paymentMethod,
    vendorId: order.vendorId,
    idempotencyKey: order.idempotencyKey,
    status: order.status
  };
}

async function resolveWalletPurchasePackage(input: {
  body: PurchaseRequest;
  vendor: ReturnType<typeof getActiveDataVendor>;
  user: { role?: string };
  log: { warn: (obj: Record<string, unknown>, msg: string) => void };
}) {
  const vendorPackageId = input.body.packageId.includes(":")
    ? input.body.packageId.split(":").at(-1)
    : input.body.packageId;
  const packages = await input.vendor.listPackages();
  const selected = packages.find(
    (item) => item.vendorPackageId === vendorPackageId && item.network === input.body.network
  );

  if (!selected || !selected.isAvailable) {
    throw new Error("Selected data package is not available. Please choose another package.");
  }

  if (!Number.isFinite(selected.costGhs) || selected.costGhs <= 0) {
    throw new Error("Selected data package price is temporarily unavailable.");
  }

  await ensureVendorBalanceCanCoverPurchase(input.vendor, selected.costGhs);

  const pricingContext = await getPricingContextForApi(input.log);

  if (pricingContext === null) {
    throw new Error("Pricing is temporarily unavailable. Please try again shortly.");
  }

  const amountGhs = resolveVendorPackageCustomerPriceGhs(
    input.vendor.id,
    selected,
    pricingContext,
    { applyAgentDiscount: input.user.role === "agent" }
  );

  return {
    packageId: `${input.vendor.id}:${selected.vendorPackageId}`,
    vendorPackageId: selected.vendorPackageId,
    network: selected.network,
    amountGhs
  };
}

async function ensureVendorBalanceCanCoverPurchase(
  vendor: ReturnType<typeof getActiveDataVendor>,
  purchaseCostGhs: number
) {
  try {
    const balance = await vendor.getBalance();

    if (!Number.isFinite(balance.balanceGhs) || balance.balanceGhs < purchaseCostGhs) {
      throw new Error("low_balance");
    }
  } catch {
    throw new Error(
      "Data purchases are temporarily unavailable because vendor balance is low. Please try again shortly."
    );
  }
}

function readWalletPurchaseError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    if (error.message.includes("Verified wallet debit")) {
      return "We could not verify your wallet payment. Please refresh your wallet and try again.";
    }

    return error.message;
  }

  return "Wallet purchase failed. Please try again.";
}

async function getOptionalUserForOrder(
  request: FastifyRequest,
  convex: ReturnType<typeof createConvexHttpClient>
) {
  try {
    return await requireRequestUser(request, convex);
  } catch {
    return null;
  }
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

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}

function readRawBody(request: FastifyRequest) {
  const rawBody = (request as FastifyRequest & { rawBody?: Buffer | string }).rawBody;

  if (rawBody !== undefined) {
    return rawBody;
  }

  throw new Error("rawBody missing: cannot verify webhook signature");
}

function createOrderReference() {
  return `BD-${randomUUID().toUpperCase()}`;
}

function requireInternalServiceRequest(
  headers: Record<string, string | string[] | undefined>
) {
  const provided = headers["x-betterdata-service-secret"];

  if (Array.isArray(provided) || provided !== getRequiredEnv("BETTERDATA_SERVICE_SECRET")) {
    throw new Error("Service authorization failed.");
  }
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
