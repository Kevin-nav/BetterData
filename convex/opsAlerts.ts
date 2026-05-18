import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const severity = v.union(v.literal("info"), v.literal("warning"), v.literal("critical"));
const status = v.union(v.literal("open"), v.literal("acknowledged"), v.literal("resolved"));
const category = v.union(
  v.literal("payment"),
  v.literal("webhook"),
  v.literal("fulfillment"),
  v.literal("config"),
  v.literal("security")
);
const retryAction = v.union(
  v.literal("verify_payment"),
  v.literal("fulfill_order"),
  v.literal("credit_wallet"),
  v.literal("complete_agent_application")
);
const retryStatus = v.union(
  v.literal("not_started"),
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed")
);

export const create = mutation({
  args: {
    severity,
    category,
    reference: v.optional(v.string()),
    message: v.string(),
    metadata: v.optional(v.any()),
    retryable: v.optional(v.boolean()),
    retryAction: v.optional(retryAction),
    retryStatus: v.optional(retryStatus),
    nextRetryAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("opsAlerts", {
      severity: args.severity,
      status: "open",
      category: args.category,
      ...(args.reference !== undefined ? { reference: args.reference } : {}),
      message: args.message,
      ...(args.metadata !== undefined ? { metadata: sanitizeMetadata(args.metadata) } : {}),
      retryable: args.retryable ?? false,
      ...(args.retryAction !== undefined ? { retryAction: args.retryAction } : {}),
      retryStatus: args.retryStatus ?? "not_started",
      retryCount: 0,
      ...(args.nextRetryAt !== undefined ? { nextRetryAt: args.nextRetryAt } : {}),
      createdAt: now,
      updatedAt: now
    });
  }
});

export const queueRetry = mutation({
  args: {
    alertId: v.id("opsAlerts"),
    nextRetryAt: v.number()
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);

    if (alert === null) {
      throw new Error("Ops alert not found.");
    }

    if (!alert.retryable) {
      throw new Error("Ops alert is not retryable.");
    }

    await ctx.db.patch(args.alertId, {
      retryStatus: "queued",
      nextRetryAt: args.nextRetryAt,
      updatedAt: Date.now()
    });
  }
});

export const markRetryRunning = mutation({
  args: {
    alertId: v.id("opsAlerts")
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);

    if (alert === null) {
      throw new Error("Ops alert not found.");
    }

    await ctx.db.patch(args.alertId, {
      retryStatus: "running",
      retryCount: alert.retryCount + 1,
      lastRetriedAt: Date.now(),
      updatedAt: Date.now()
    });
  }
});

export const markRetrySucceeded = mutation({
  args: {
    alertId: v.id("opsAlerts")
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.alertId, {
      status: "resolved",
      retryStatus: "succeeded",
      resolvedAt: now,
      updatedAt: now
    });
  }
});

export const markRetryFailed = mutation({
  args: {
    alertId: v.id("opsAlerts"),
    nextRetryAt: v.optional(v.number()),
    finalFailure: v.optional(v.boolean()),
    message: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const finalFailure = args.finalFailure ?? false;

    await ctx.db.patch(args.alertId, {
      severity: finalFailure ? "critical" : "warning",
      retryStatus: "failed",
      ...(args.nextRetryAt !== undefined ? { nextRetryAt: args.nextRetryAt } : {}),
      ...(args.message !== undefined ? { message: args.message } : {}),
      updatedAt: Date.now()
    });
  }
});

export const listDueRetries = query({
  args: {
    now: v.number()
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("opsAlerts")
      .withIndex("by_retry", (q) =>
        q.eq("retryStatus", "queued").lte("nextRetryAt", args.now)
      )
      .take(50);
  }
});

export const acknowledge = mutation({
  args: {
    alertId: v.id("opsAlerts")
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, {
      status: "acknowledged",
      updatedAt: Date.now()
    });
  }
});

export const resolve = mutation({
  args: {
    alertId: v.id("opsAlerts")
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.alertId, {
      status: "resolved",
      resolvedAt: now,
      updatedAt: now
    });
  }
});

export const escalate = mutation({
  args: {
    alertId: v.id("opsAlerts"),
    message: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);

    if (alert === null) {
      throw new Error("Ops alert not found.");
    }

    await ctx.db.patch(args.alertId, {
      severity: "critical",
      ...(args.message !== undefined ? { message: args.message } : {}),
      updatedAt: Date.now()
    });
  }
});

export const listOpen = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("opsAlerts")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(100);
  }
});

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
    normalized.includes("rawbody")
  );
}
