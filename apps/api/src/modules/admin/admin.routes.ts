import type { FastifyBaseLogger, FastifyInstance } from "fastify";

import { createRequireAdmin } from "../../auth/adminAuth";
import { getActiveDataVendor } from "../../vendors/activeVendor";

type VendorBalanceStatus = "healthy" | "low" | "critical" | "unknown";

export async function registerAdminRoutes(server: FastifyInstance) {
  server.get(
    "/admin/overview",
    { preHandler: createRequireAdmin() },
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
        pendingAgentApplications: 0
      };
    }
  );
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
