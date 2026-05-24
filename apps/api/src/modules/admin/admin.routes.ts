import { adminFunctions, opsAlertFunctions, platformConfigFunctions } from "@betterdata/app-api";
import { getRequiredEnv } from "@betterdata/config";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { Id } from "../../../../../convex/_generated/dataModel";

import { createRequireAdmin } from "../../auth/adminAuth";
import { resolveRateLimitConfig } from "../../config/rateLimits";
import { createConvexHttpClient } from "../../convexClient";
import { sendBroadcastEmail } from "../../integrations/resend/client";
import { snapshotMetrics } from "../../observability/metrics";
import { createOrderStore } from "../../orders/orderStore";
import { createQueueProvider, QUEUE_NAMES } from "../../queue";
import { getActiveDataVendor } from "../../vendors/activeVendor";
import {
  listRecentVendorBalanceSnapshots,
  recordVendorBalanceSnapshotSafely
} from "../../vendors/vendorBalance";

type VendorBalanceStatus = "healthy" | "low" | "critical" | "unknown";
type PaymentConfigKey =
  | "minimumWalletTopUpGhs"
  | "maximumWalletTopUpGhs"
  | "agentOnboardingFeeGhs"
  | "firstPurchaseDiscountGhs"
  | "agentDiscountPercentage"
  | "paymentIntentExpirySeconds";

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
      const balanceHistory = await readVendorBalanceHistory(vendor.id, request.log);

      return {
        revenue: { dailyGhs: 0, weeklyGhs: 0, monthlyGhs: 0 },
        vendorBalanceGhs: balance.balanceGhs,
        vendor: {
          id: vendor.id,
          displayName: vendor.displayName,
          balanceGhs: balance.balanceGhs,
          balanceStatus: status,
          checkedAt: new Date().toISOString(),
          balanceHistory
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
    const convex = createConvexHttpClient();
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

    const convex = createConvexHttpClient();
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
      const convex = createConvexHttpClient();
      await convex.mutation(opsAlertFunctions.acknowledge, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        alertId: request.params.alertId as Id<"opsAlerts">
      });

      return { updated: true };
    }
  );

  server.post<{ Params: { alertId: string } }>(
    "/admin/ops-alerts/:alertId/resolve",
    adminRouteOptions,
    async (request) => {
      const convex = createConvexHttpClient();
      await convex.mutation(opsAlertFunctions.resolve, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        alertId: request.params.alertId as Id<"opsAlerts">
      });

      return { updated: true };
    }
  );

  server.post<{ Params: { id: string } }>(
    "/admin/announcements/:id/broadcast",
    adminRouteOptions,
    async (request, reply) => {
      const { id } = request.params;
      const convex = createConvexHttpClient();

      const announcement = await convex.query(adminFunctions.getAnnouncementByService, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        announcementId: id as Id<"announcements">
      });

      if (!announcement) {
        return reply.code(404).send({ message: "Announcement not found." });
      }

      const emails = await convex.query(adminFunctions.getAudienceEmailsByService, {
        serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
        audience: announcement.audience
      });

      if (emails.length === 0) {
        return { successCount: 0, failureCount: 0, audienceSize: 0 };
      }

      const { successCount, failureCount } = await sendBroadcastEmail(
        emails,
        announcement.title,
        announcement.body
      );

      return {
        successCount,
        failureCount,
        audienceSize: emails.length
      };
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

function isPaymentConfigKey(value: unknown): value is PaymentConfigKey {
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
    await recordVendorBalanceSnapshotSafely({
      vendorId: vendor.id,
      balanceGhs: balance.balanceGhs,
      source: "admin_refresh"
    });

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

async function readVendorBalanceHistory(vendorId: string, log: FastifyBaseLogger) {
  try {
    const snapshots = await listRecentVendorBalanceSnapshots({
      vendorId,
      limit: 120
    });

    if (!Array.isArray(snapshots)) {
      return [];
    }

    return snapshots
      .map((snapshot) => {
        const record = snapshot as {
          balanceGhs?: unknown;
          source?: unknown;
          createdAt?: unknown;
        };

        if (
          typeof record.balanceGhs !== "number" ||
          typeof record.createdAt !== "number" ||
          typeof record.source !== "string"
        ) {
          return null;
        }

        return {
          balanceGhs: record.balanceGhs,
          source: record.source,
          createdAt: record.createdAt
        };
      })
      .filter((snapshot): snapshot is {
        balanceGhs: number;
        source: string;
        createdAt: number;
      } => snapshot !== null)
      .reverse();
  } catch (error) {
    log.warn({ error, vendorId }, "Vendor balance history query failed");
    return [];
  }
}

function readNonNegativeNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
