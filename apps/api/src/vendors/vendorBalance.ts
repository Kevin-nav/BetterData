import { getRequiredEnv } from "@betterdata/config";
import { makeFunctionReference } from "convex/server";

import { createConvexHttpClient } from "../convexClient";

export type VendorBalanceSnapshotSource =
  | "admin_refresh"
  | "balance_endpoint"
  | "purchase_response"
  | "retry_check"
  | "manual"
  | "unknown";

const recordForApi = makeFunctionReference<"mutation">("vendorBalances:recordForApi");
const listRecentForApi = makeFunctionReference<"query">("vendorBalances:listRecentForApi");

export async function recordVendorBalanceSnapshotSafely(input: {
  vendorId: string;
  balanceGhs: number | null | undefined;
  source: VendorBalanceSnapshotSource;
  metadata?: Record<string, unknown>;
}) {
  const balanceGhs = input.balanceGhs;

  if (typeof balanceGhs !== "number" || !Number.isFinite(balanceGhs) || balanceGhs < 0) {
    return false;
  }

  try {
    const convex = createConvexHttpClient();
    await convex.mutation(recordForApi, {
      serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
      vendorId: input.vendorId,
      balanceGhs,
      source: input.source,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
    });
    return true;
  } catch {
    return false;
  }
}

export async function listRecentVendorBalanceSnapshots(input: {
  vendorId: string;
  limit?: number;
}) {
  const convex = createConvexHttpClient();

  return await convex.query(listRecentForApi, {
    serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
    vendorId: input.vendorId,
    ...(input.limit !== undefined ? { limit: input.limit } : {})
  });
}

export function extractVendorBalanceGhs(payload: unknown): number | null {
  const candidates = findBalanceCandidates(payload, 0);

  for (const candidate of candidates) {
    const parsed = parseBalance(candidate);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function findBalanceCandidates(value: unknown, depth: number): unknown[] {
  if (depth > 4 || typeof value !== "object" || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directKeys = [
    "balanceGhs",
    "balance",
    "walletBalance",
    "wallet_balance",
    "vendorBalance",
    "vendor_balance",
    "availableBalance",
    "available_balance"
  ];
  const candidates = directKeys
    .filter((key) => Object.prototype.hasOwnProperty.call(record, key))
    .map((key) => record[key]);

  for (const nested of Object.values(record)) {
    candidates.push(...findBalanceCandidates(nested, depth + 1));
  }

  return candidates;
}

function parseBalance(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/GHS/gi, "").replace(/[,\s]/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
