import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

export const PAYMENT_CONFIG_KEYS = [
  "minimumWalletTopUpGhs",
  "agentOnboardingFeeGhs",
  "firstPurchaseDiscountGhs",
  "agentDiscountPercentage"
] as const;

const paymentConfigKey = v.union(
  v.literal("minimumWalletTopUpGhs"),
  v.literal("agentOnboardingFeeGhs"),
  v.literal("firstPurchaseDiscountGhs"),
  v.literal("agentDiscountPercentage")
);

export const getNumberConfig = query({
  args: {
    key: paymentConfigKey
  },
  handler: async (ctx, args) => {
    return await readNumberConfig(ctx, args.key);
  }
});

export const listPaymentConfig = query({
  args: {},
  handler: async (ctx) => {
    const entries = await Promise.all(
      PAYMENT_CONFIG_KEYS.map(async (key) => [key, await readNumberConfig(ctx, key)] as const)
    );

    return Object.fromEntries(entries);
  }
});

export const setNumberConfig = mutation({
  args: {
    key: paymentConfigKey,
    value: v.number()
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (!Number.isFinite(args.value) || args.value < 0) {
      throw new Error("Config value must be a non-negative number.");
    }

    const existing = await ctx.db
      .query("platformConfig")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing === null) {
      return await ctx.db.insert("platformConfig", {
        key: args.key,
        value: args.value
      });
    }

    await ctx.db.patch(existing._id, {
      value: args.value
    });

    return existing._id;
  }
});

export async function readNumberConfig(ctx: QueryCtx | MutationCtx, key: string) {
  const config = await ctx.db
    .query("platformConfig")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (typeof config?.value !== "number") {
    return null;
  }

  return config.value;
}

async function requireAdmin(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    throw new Error("Unauthorized.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
    .first();

  if (user?.role !== "admin") {
    throw new Error("Admin access is required.");
  }
}
