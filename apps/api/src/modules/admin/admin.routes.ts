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
