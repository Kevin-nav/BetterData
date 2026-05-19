import { opsAlertFunctions, platformConfigFunctions } from "@betterdata/app-api";
import { getRequiredEnv } from "@betterdata/config";
import { ConvexHttpClient } from "convex/browser";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";

import { createRequireAdmin } from "../../auth/adminAuth";
import { resolveRateLimitConfig } from "../../config/rateLimits";
import { snapshotMetrics } from "../../observability/metrics";
import { createOrderStore } from "../../orders/orderStore";
import { createQueueProvider, QUEUE_NAMES } from "../../queue";
import { getActiveDataVendor } from "../../vendors/activeVendor";

type VendorBalanceStatus = "healthy" | "low" | "critical" | "unknown";

export async function registerAdminRoutes(server: FastifyInstance) {
  const rateLimits = resolveRateLimitConfig();
  const orderStore = createOrderStore();
  const queue = await createQueueProvider();
  const adminRouteOptions = {
    preHandler: createRequireAdmin(),
    config: {
      rateLimit: rateLimits.admin
    }
  };

  server.get(
    "/admin/overview",
    adminRouteOptions,
    async (request) => {
      const vendor = getActiveDataVendor();
      const balance = await readVendorBalance(vendor, request.log);
      const status = classifyVendorBalance(balance.balanceGhs, process.env);

      return {
        revenue: { dailyGhs: 0, weeklyGhs: 0, monthlyGhs: 0 },
        vendorBalanceGhs: balance.balanceGhs,
        vendor: {
          id: vendor.id,
          displayName: vendor.displayName,
          balanceGhs: balance.balanceGhs,
          balanceStatus: status,
          checkedAt: new Date().toISOString()
        },
        queue: {
          purchaseDepth: await queue.getDepth(QUEUE_NAMES.purchaseRequested),
          deadLetterDepth: await queue.getDepth(QUEUE_NAMES.purchaseDead)
        },
        metrics: await snapshotMetrics(),
        pendingAgentApplications: 0
      };
    }
  );

  server.get("/admin/orders", adminRouteOptions, async () => {
    const orders = await orderStore.listOrders();

    return {
      orders: orders.map((order) => ({
        reference: order.reference,
        vendorId: order.vendorId,
        ...(order.vendorOrderReference
          ? { vendorOrderReference: order.vendorOrderReference }
          : {}),
        network: order.network,
        recipientPhone: maskPhone(order.recipientPhone),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status
      }))
    };
  });

  server.get("/admin/payment-ops", adminRouteOptions, async () => {
    const convex = new ConvexHttpClient(getRequiredEnv("CONVEX_URL"));
    const [config, alerts] = await Promise.all([
      convex.query(platformConfigFunctions.listPaymentConfig, {}),
      convex.query(opsAlertFunctions.listOpen, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET")
      })
    ]);

    return {
      config,
      alerts
    };
  });

  server.patch<{
    Body: { key: string; value: number };
  }>("/admin/payment-config", adminRouteOptions, async (request, reply) => {
    const body = request.body;

    if (
      typeof body !== "object" ||
      body === null ||
      !("key" in body) ||
      !("value" in body)
    ) {
      return reply.code(400).send({ message: "Invalid payment config." });
    }

    if (!isPaymentConfigKey(body.key) || !Number.isFinite(body.value)) {
      return reply.code(400).send({ message: "Invalid payment config." });
    }

    const convex = new ConvexHttpClient(getRequiredEnv("CONVEX_URL"));
    await convex.mutation(platformConfigFunctions.setNumberConfigByService, {
      serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
      key: body.key,
      value: body.value
    });

    return { updated: true };
  });

  server.post<{ Params: { alertId: string } }>(
    "/admin/ops-alerts/:alertId/acknowledge",
    adminRouteOptions,
    async (request) => {
      const convex = new ConvexHttpClient(getRequiredEnv("CONVEX_URL"));
      await convex.mutation(opsAlertFunctions.acknowledge, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        alertId: request.params.alertId
      });

      return { updated: true };
    }
  );

  server.post<{ Params: { alertId: string } }>(
    "/admin/ops-alerts/:alertId/resolve",
    adminRouteOptions,
    async (request) => {
      const convex = new ConvexHttpClient(getRequiredEnv("CONVEX_URL"));
      await convex.mutation(opsAlertFunctions.resolve, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        alertId: request.params.alertId
      });

      return { updated: true };
    }
  );
}

export function maskPhone(phone: string) {
  const trimmed = phone.trim();
  const prefix = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 0) {
    return "";
  }

  if (digits.length <= 2) {
    return `${prefix}${"*".repeat(digits.length)}`;
  }

  if (digits.length <= 5) {
    return `${prefix}${"*".repeat(digits.length - 2)}${digits.slice(-2)}`;
  }

  return `${prefix}${digits.slice(0, 3)}${"*".repeat(digits.length - 5)}${digits.slice(-2)}`;
}

export function classifyVendorBalance(
  balanceGhs: number | null,
  env: NodeJS.ProcessEnv = process.env
): VendorBalanceStatus {
  if (balanceGhs === null) {
    return "unknown";
  }

  const criticalGhs = readNonNegativeNumber(env.VENDOR_BALANCE_CRITICAL_GHS, 50);
  const lowGhs = readNonNegativeNumber(env.VENDOR_BALANCE_LOW_GHS, 200);

  if (balanceGhs <= criticalGhs) {
    return "critical";
  }

  if (balanceGhs <= lowGhs) {
    return "low";
  }

  return "healthy";
}

function isPaymentConfigKey(value: unknown): value is string {
  return (
    value === "minimumWalletTopUpGhs" ||
    value === "maximumWalletTopUpGhs" ||
    value === "agentOnboardingFeeGhs" ||
    value === "firstPurchaseDiscountGhs" ||
    value === "agentDiscountPercentage" ||
    value === "paymentIntentExpirySeconds"
  );
}

async function readVendorBalance(
  vendor: ReturnType<typeof getActiveDataVendor>,
  log: FastifyBaseLogger
) {
  try {
    const balance = await vendor.getBalance();

    return {
      balanceGhs: balance.balanceGhs,
      raw: balance.raw
    };
  } catch (error) {
    log.error({ error, vendorId: vendor.id }, "Vendor balance check failed");

    return {
      balanceGhs: null,
      raw: undefined
    };
  }
}

function readNonNegativeNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
