import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServiceSecret } from "./serviceAuth";

const source = v.union(
  v.literal("admin_refresh"),
  v.literal("balance_endpoint"),
  v.literal("purchase_response"),
  v.literal("retry_check"),
  v.literal("manual"),
  v.literal("unknown")
);

export const recordForApi = mutation({
  args: {
    serviceSecret: v.string(),
    vendorId: v.string(),
    balanceGhs: v.number(),
    source,
    metadata: v.optional(v.any()),
    createdAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    if (!Number.isFinite(args.balanceGhs) || args.balanceGhs < 0) {
      throw new Error("Vendor balance must be a non-negative number.");
    }

    return await ctx.db.insert("vendorBalanceSnapshots", {
      vendorId: args.vendorId,
      balanceGhs: roundGhs(args.balanceGhs),
      source: args.source,
      ...(args.metadata !== undefined ? { metadata: sanitizeMetadata(args.metadata) } : {}),
      createdAt: args.createdAt ?? Date.now()
    });
  }
});

export const listRecentForApi = query({
  args: {
    serviceSecret: v.string(),
    vendorId: v.string(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
    const take = Math.max(1, Math.min(args.limit ?? 100, 500));

    return await ctx.db
      .query("vendorBalanceSnapshots")
      .withIndex("by_vendor_time", (q) => q.eq("vendorId", args.vendorId))
      .order("desc")
      .take(take);
  }
});

function roundGhs(value: number) {
  return Math.round(value * 100) / 100;
}

function sanitizeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadata);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isSensitiveKey(key))
      .map(([key, nested]) => [key, sanitizeMetadata(nested)])
  );
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("authorization") ||
    normalized.includes("password") ||
    normalized.includes("rawbody") ||
    normalized.includes("api_key") ||
    normalized.includes("apikey")
  );
}
