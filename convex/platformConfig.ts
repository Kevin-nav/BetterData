import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireServiceSecret } from "./serviceAuth";
import { requireAdmin } from "./admin";

export const PAYMENT_CONFIG_KEYS = [
  "minimumWalletTopUpGhs",
  "maximumWalletTopUpGhs",
  "agentOnboardingFeeGhs",
  "firstPurchaseDiscountGhs",
  "agentDiscountPercentage",
  "paymentIntentExpirySeconds"
] as const;

export const PAYMENT_CONFIG_DEFAULTS = {
  minimumWalletTopUpGhs: 10,
  maximumWalletTopUpGhs: 500,
  firstPurchaseDiscountGhs: 0,
  agentDiscountPercentage: 0,
  paymentIntentExpirySeconds: 1800
} as const;

const paymentConfigKey = v.union(
  v.literal("minimumWalletTopUpGhs"),
  v.literal("maximumWalletTopUpGhs"),
  v.literal("agentOnboardingFeeGhs"),
  v.literal("firstPurchaseDiscountGhs"),
  v.literal("agentDiscountPercentage"),
  v.literal("paymentIntentExpirySeconds")
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

    await validatePaymentConfigValue(ctx, args.key, args.value);

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

export const setNumberConfigByService = mutation({
  args: {
    serviceSecret: v.string(),
    key: paymentConfigKey,
    value: v.number()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    await validatePaymentConfigValue(ctx, args.key, args.value);

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
    return key in PAYMENT_CONFIG_DEFAULTS
      ? PAYMENT_CONFIG_DEFAULTS[key as keyof typeof PAYMENT_CONFIG_DEFAULTS]
      : null;
  }

  return config.value;
}

async function validatePaymentConfigValue(
  ctx: QueryCtx | MutationCtx,
  key: (typeof PAYMENT_CONFIG_KEYS)[number],
  value: number
) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Config value must be a non-negative number.");
  }

  switch (key) {
    case "agentDiscountPercentage":
      if (value > 100) {
        throw new Error("Agent discount percentage must be between 0 and 100.");
      }
      return;
    case "paymentIntentExpirySeconds":
      if (value <= 0) {
        throw new Error("Payment intent expiry must be greater than zero seconds.");
      }
      return;
    case "agentOnboardingFeeGhs":
      if (value <= 0) {
        throw new Error("Agent onboarding fee must be greater than zero.");
      }
      return;
    case "minimumWalletTopUpGhs": {
      const maximumWalletTopUpGhs = await readNumberConfig(ctx, "maximumWalletTopUpGhs");
      if (maximumWalletTopUpGhs !== null && value > maximumWalletTopUpGhs) {
        throw new Error("Minimum wallet top-up cannot exceed maximum wallet top-up.");
      }
      return;
    }
    case "maximumWalletTopUpGhs": {
      const minimumWalletTopUpGhs = await readNumberConfig(ctx, "minimumWalletTopUpGhs");
      if (minimumWalletTopUpGhs !== null && value < minimumWalletTopUpGhs) {
        throw new Error("Maximum wallet top-up cannot be less than minimum wallet top-up.");
      }
      return;
    }
    case "firstPurchaseDiscountGhs":
      return;
  }
}


