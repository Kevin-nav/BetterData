import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServiceSecret } from "./serviceAuth";

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
    serviceSecret: v.string(),
    severity,
    category,
    reference: v.optional(v.string()),
    message: v.string(),
    metadata: v.optional(v.any()),
    retryable: v.optional(v.boolean()),
    retryAction: v.optional(retryAction),
    retryStatus: v.optional(retryStatus),
    retryCount: v.optional(v.number()),
    nextRetryAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
    const now = Date.now();
    const retryable = args.retryable ?? false;
    const retryStatusValue = args.retryStatus ?? "not_started";
    const retryCount = retryable ? args.retryCount ?? 0 : 0;

    validateRetryState({
      retryable,
      retryAction: args.retryAction,
      retryStatus: retryStatusValue,
      retryCount: args.retryCount ?? 0,
      nextRetryAt: args.nextRetryAt
    });

    return await ctx.db.insert("opsAlerts", {
      severity: args.severity,
      status: "open",
      category: args.category,
      ...(args.reference !== undefined ? { reference: args.reference } : {}),
      message: args.message,
      ...(args.metadata !== undefined ? { metadata: sanitizeMetadata(args.metadata) } : {}),
      retryable,
      ...(args.retryAction !== undefined ? { retryAction: args.retryAction } : {}),
      retryStatus: retryable ? retryStatusValue : "not_started",
      retryCount,
      ...(args.nextRetryAt !== undefined ? { nextRetryAt: args.nextRetryAt } : {}),
      createdAt: now,
      updatedAt: now
    });
  }
});

function validateRetryState(input: {
  retryable: boolean;
  retryAction: "verify_payment" | "fulfill_order" | "credit_wallet" | "complete_agent_application" | undefined;
  retryStatus: "not_started" | "queued" | "running" | "succeeded" | "failed";
  retryCount: number;
  nextRetryAt: number | undefined;
}) {
  if (!Number.isFinite(input.retryCount) || input.retryCount < 0) {
    throw new Error("Invalid retry alert state: retryCount must be greater than or equal to 0.");
  }

  if (!input.retryable) {
    if (
      input.retryAction !== undefined ||
      input.retryStatus !== "not_started" ||
      input.retryCount > 0 ||
      input.nextRetryAt !== undefined
    ) {
      throw new Error("Invalid retry alert state: non-retryable alerts cannot include retry metadata.");
    }

    return;
  }

  if (
    input.retryStatus === "queued" &&
    (input.nextRetryAt === undefined ||
      !Number.isFinite(input.nextRetryAt) ||
      input.nextRetryAt <= 0)
  ) {
    throw new Error("Invalid retry alert state: queued retries require a valid nextRetryAt timestamp.");
  }
}

export const queueRetry = mutation({
  args: {
    serviceSecret: v.string(),
    alertId: v.id("opsAlerts"),
    nextRetryAt: v.number()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
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
    serviceSecret: v.string(),
    alertId: v.id("opsAlerts")
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
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
    serviceSecret: v.string(),
    alertId: v.id("opsAlerts")
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
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
    serviceSecret: v.string(),
    alertId: v.id("opsAlerts"),
    nextRetryAt: v.optional(v.number()),
    finalFailure: v.optional(v.boolean()),
    message: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
    const finalFailure = args.finalFailure ?? false;

    await ctx.db.patch(args.alertId, {
      severity: finalFailure ? "critical" : "warning",
      retryStatus: finalFailure ? "failed" : "queued",
      ...(args.nextRetryAt !== undefined ? { nextRetryAt: args.nextRetryAt } : {}),
      ...(args.message !== undefined ? { message: args.message } : {}),
      updatedAt: Date.now()
    });
  }
});

export const listDueRetries = query({
  args: {
    serviceSecret: v.string(),
    now: v.number()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
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
    serviceSecret: v.string(),
    alertId: v.id("opsAlerts")
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
    await ctx.db.patch(args.alertId, {
      status: "acknowledged",
      updatedAt: Date.now()
    });
  }
});

export const resolve = mutation({
  args: {
    serviceSecret: v.string(),
    alertId: v.id("opsAlerts")
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
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
    serviceSecret: v.string(),
    alertId: v.id("opsAlerts"),
    message: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
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
  args: {
    serviceSecret: v.string()
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
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
