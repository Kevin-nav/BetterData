import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

const paymentPurpose = v.union(
  v.literal("data_purchase"),
  v.literal("wallet_top_up"),
  v.literal("agent_application_fee")
);

const paymentStatus = v.union(
  v.literal("pending"),
  v.literal("initialized"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("abandoned")
);

const networkCode = v.union(
  v.literal("mtn"),
  v.literal("telecel"),
  v.literal("airteltigo")
);

export const createPendingIntent = mutation({
  args: {
    provider: v.literal("paystack"),
    purpose: paymentPurpose,
    userId: v.optional(v.id("users")),
    guestContactPhone: v.optional(v.string()),
    amountGhs: v.number(),
    currency: v.literal("GHS"),
    providerReference: v.string(),
    purposeMetadata: v.any()
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("paymentIntents")
      .withIndex("by_provider_reference", (q) =>
        q.eq("provider", args.provider).eq("providerReference", args.providerReference)
      )
      .first();

    if (existing !== null) {
      return existing._id;
    }

    return await ctx.db.insert("paymentIntents", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const markInitialized = mutation({
  args: {
    providerReference: v.string(),
    providerAccessCode: v.string(),
    providerAuthorizationUrl: v.string()
  },
  handler: async (ctx, args) => {
    const intent = await findPaystackIntent(ctx, args.providerReference);

    if (intent === null) {
      throw new Error("Payment intent not found.");
    }

    if (intent.status !== "pending" && intent.status !== "initialized") {
      return intent._id;
    }

    await ctx.db.patch(intent._id, {
      status: "initialized",
      providerAccessCode: args.providerAccessCode,
      providerAuthorizationUrl: args.providerAuthorizationUrl,
      initializedAt: intent.initializedAt ?? Date.now(),
      updatedAt: Date.now()
    });

    return intent._id;
  }
});

export const getByProviderReference = query({
  args: {
    providerReference: v.string()
  },
  handler: async (ctx, args) => {
    return await findPaystackIntent(ctx, args.providerReference);
  }
});

export const getPublicStatus = query({
  args: {
    providerReference: v.string()
  },
  handler: async (ctx, args) => {
    const intent = await findPaystackIntent(ctx, args.providerReference);

    if (intent === null) {
      return null;
    }

    return {
      reference: intent.providerReference,
      purpose: intent.purpose,
      amountGhs: intent.amountGhs,
      currency: intent.currency,
      status: intent.status
    };
  }
});

export const recordProviderEvent = mutation({
  args: {
    providerReference: v.string(),
    eventType: v.string(),
    payload: v.any()
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("paymentEvents", {
      provider: "paystack",
      providerReference: args.providerReference,
      eventType: args.eventType,
      payload: args.payload,
      receivedAt: Date.now()
    });
  }
});

export const completeSucceededIntent = mutation({
  args: {
    providerReference: v.string(),
    amountGhs: v.number(),
    currency: v.literal("GHS"),
    providerPayload: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const intent = await findPaystackIntent(ctx, args.providerReference);

    if (intent === null) {
      throw new Error("Payment intent not found.");
    }

    if (intent.amountGhs !== args.amountGhs || intent.currency !== args.currency) {
      throw new Error("Verified transaction does not match payment intent.");
    }

    if (intent.status === "succeeded") {
      return intent._id;
    }

    if (intent.status !== "pending" && intent.status !== "initialized") {
      throw new Error(`Payment intent cannot be completed from ${intent.status}.`);
    }

    await completePurpose(ctx, intent);

    await ctx.db.patch(intent._id, {
      status: "succeeded",
      completedAt: Date.now(),
      updatedAt: Date.now(),
      ...(args.providerPayload !== undefined
        ? { purposeMetadata: { ...asRecord(intent.purposeMetadata), providerPayload: args.providerPayload } }
        : {})
    });

    return intent._id;
  }
});

export const markFailed = mutation({
  args: {
    providerReference: v.string(),
    status: paymentStatus,
    failureReason: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const intent = await findPaystackIntent(ctx, args.providerReference);

    if (intent === null) {
      throw new Error("Payment intent not found.");
    }

    if (intent.status === "succeeded") {
      return intent._id;
    }

    await ctx.db.patch(intent._id, {
      status: args.status,
      ...(args.failureReason !== undefined ? { failureReason: args.failureReason } : {}),
      updatedAt: Date.now()
    });

    return intent._id;
  }
});

async function findPaystackIntent(
  ctx: QueryCtx | MutationCtx,
  providerReference: string
) {
  return await ctx.db
    .query("paymentIntents")
    .withIndex("by_provider_reference", (q) =>
      q.eq("provider", "paystack").eq("providerReference", providerReference)
    )
    .first();
}

async function completePurpose(
  ctx: MutationCtx,
  intent: Doc<"paymentIntents">
) {
  if (intent.purpose === "wallet_top_up") {
    await completeWalletTopUp(ctx, intent);
    return;
  }

  if (intent.purpose === "agent_application_fee") {
    await completeAgentApplicationFee(ctx, intent);
    return;
  }

  await completeDataPurchase(ctx, intent);
}

async function completeWalletTopUp(
  ctx: MutationCtx,
  intent: Doc<"paymentIntents">
) {
  if (intent.userId === undefined) {
    throw new Error("Wallet top-up requires a user.");
  }

  const existing = await ctx.db
    .query("walletTransactions")
    .withIndex("by_user", (q) => q.eq("userId", intent.userId))
    .filter((q) => q.eq(q.field("reference"), intent.providerReference))
    .first();

  if (existing !== null) {
    return;
  }

  const user = await ctx.db.get(intent.userId);

  if (user === null) {
    throw new Error("Wallet top-up user not found.");
  }

  await ctx.db.patch(intent.userId, {
    walletBalanceGhs: user.walletBalanceGhs + intent.amountGhs
  });

  await ctx.db.insert("walletTransactions", {
    userId: intent.userId,
    type: "top_up",
    amountGhs: intent.amountGhs,
    reference: intent.providerReference,
    notes: "Paystack wallet top-up"
  });
}

async function completeAgentApplicationFee(
  ctx: MutationCtx,
  intent: Doc<"paymentIntents">
) {
  if (intent.userId === undefined) {
    throw new Error("Agent application payment requires a user.");
  }

  const existing = await ctx.db
    .query("agentApplications")
    .withIndex("by_user", (q) => q.eq("userId", intent.userId))
    .first();

  if (existing !== null) {
    await ctx.db.patch(existing._id, {
      paymentReference: intent.providerReference,
      status: "pending"
    });
    return;
  }

  await ctx.db.insert("agentApplications", {
    userId: intent.userId,
    paymentReference: intent.providerReference,
    status: "pending"
  });
}

async function completeDataPurchase(
  ctx: MutationCtx,
  intent: Doc<"paymentIntents">
) {
  const metadata = asRecord(intent.purposeMetadata);
  const existingOrder = await ctx.db
    .query("orders")
    .withIndex("by_paystack_reference", (q) =>
      q.eq("paystackReference", intent.providerReference)
    )
    .first();

  if (existingOrder !== null) {
    return;
  }

  const packageId = metadata.packageId;
  const vendorId = metadata.vendorId;
  const network = metadata.network;
  const recipientPhone = metadata.recipientPhone;

  if (
    typeof packageId !== "string" ||
    typeof vendorId !== "string" ||
    !isNetworkCode(network) ||
    typeof recipientPhone !== "string"
  ) {
    throw new Error("Data purchase payment metadata is invalid.");
  }

  await ctx.db.insert("orders", {
    ...(intent.userId !== undefined ? { userId: intent.userId } : {}),
    ...(intent.guestContactPhone !== undefined
      ? { guestContactPhone: intent.guestContactPhone }
      : {}),
    packageId: packageId as Id<"dataPackages">,
    vendorId,
    ...(typeof metadata.vendorPackageId === "string"
      ? { vendorPackageId: metadata.vendorPackageId }
      : {}),
    network,
    recipientPhone,
    amountGhs: intent.amountGhs,
    paymentMethod: "paystack_momo",
    paystackReference: intent.providerReference,
    status: "pending",
    idempotencyKey: intent.providerReference,
    recipientConfirmedAt: Date.now()
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function isNetworkCode(value: unknown): value is "mtn" | "telecel" | "airteltigo" {
  return value === "mtn" || value === "telecel" || value === "airteltigo";
}
