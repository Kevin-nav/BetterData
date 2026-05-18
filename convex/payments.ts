import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { readNumberConfig } from "./platformConfig";

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

const paymentIntentRequest = v.union(
  v.object({
    purpose: v.literal("data_purchase"),
    userId: v.optional(v.id("users")),
    packageId: v.id("dataPackages"),
    network: networkCode,
    recipientPhone: v.string(),
    customerEmail: v.string(),
    confirmRecipientIsCorrect: v.literal(true),
    savedNumberId: v.optional(v.string()),
    guestContactPhone: v.optional(v.string())
  }),
  v.object({
    purpose: v.literal("wallet_top_up"),
    userId: v.id("users"),
    customerEmail: v.string(),
    amountGhs: v.number()
  }),
  v.object({
    purpose: v.literal("agent_application_fee"),
    userId: v.id("users"),
    customerEmail: v.string()
  })
);

export const prepareIntent = mutation({
  args: {
    request: paymentIntentRequest,
    providerReference: v.string()
  },
  handler: async (ctx, args) => {
    const prepared = await resolvePaymentIntent(ctx, args.request, args.providerReference);
    const existing = await findPaystackIntent(ctx, args.providerReference);

    if (existing === null) {
      const now = Date.now();
      await ctx.db.insert("paymentIntents", {
        provider: "paystack",
        purpose: prepared.purpose,
        status: "pending",
        ...(prepared.userId !== undefined ? { userId: prepared.userId } : {}),
        ...(prepared.guestContactPhone !== undefined
          ? { guestContactPhone: prepared.guestContactPhone }
          : {}),
        amountGhs: prepared.amountGhs,
        currency: "GHS",
        providerReference: args.providerReference,
        purposeMetadata: prepared.metadata,
        createdAt: now,
        updatedAt: now
      });
    } else if (
      existing.amountGhs !== prepared.amountGhs ||
      existing.currency !== "GHS" ||
      existing.purpose !== prepared.purpose
    ) {
      throw new Error("Existing payment intent does not match resolved payment details.");
    }

    return {
      provider: "paystack" as const,
      purpose: prepared.purpose,
      reference: args.providerReference,
      amountGhs: prepared.amountGhs,
      currency: "GHS" as const,
      metadata: prepared.metadata
    };
  }
});

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

export const getDataPurchaseOrderByPaymentReference = query({
  args: {
    providerReference: v.string()
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_paystack_reference", (q) =>
        q.eq("paystackReference", args.providerReference)
      )
      .first();

    if (order === null) {
      return null;
    }

    return {
      id: order._id,
      vendorOrderReference: order.vendorOrderReference,
      status: order.status
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

export const markDataPurchaseFulfilled = mutation({
  args: {
    providerReference: v.string(),
    vendorId: v.string(),
    vendorOrderReference: v.string(),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("refunded")
    ),
    vendorRaw: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_paystack_reference", (q) =>
        q.eq("paystackReference", args.providerReference)
      )
      .first();

    if (order === null) {
      throw new Error("Paid data purchase order not found.");
    }

    if (order.vendorOrderReference !== undefined) {
      return order._id;
    }

    await ctx.db.patch(order._id, {
      vendorId: args.vendorId,
      vendorOrderReference: args.vendorOrderReference,
      status: args.status,
      ...(args.vendorRaw !== undefined ? { vendorRaw: args.vendorRaw } : {})
    });

    return order._id;
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

  if (intent.userId !== undefined) {
    const user = await ctx.db.get(intent.userId);

    if (user !== null && !user.firstPurchaseDiscountUsed) {
      await ctx.db.patch(intent.userId, {
        firstPurchaseDiscountUsed: true
      });
    }
  }
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

async function resolvePaymentIntent(
  ctx: MutationCtx,
  request:
    | {
        purpose: "data_purchase";
        userId?: Id<"users">;
        packageId: Id<"dataPackages">;
        network: "mtn" | "telecel" | "airteltigo";
        recipientPhone: string;
        customerEmail: string;
        confirmRecipientIsCorrect: true;
        savedNumberId?: string;
        guestContactPhone?: string;
      }
    | {
        purpose: "wallet_top_up";
        userId: Id<"users">;
        customerEmail: string;
        amountGhs: number;
      }
    | {
        purpose: "agent_application_fee";
        userId: Id<"users">;
        customerEmail: string;
      },
  providerReference: string
) {
  if (request.purpose === "wallet_top_up") {
    const minimumWalletTopUpGhs = await requirePositiveConfig(
      ctx,
      "minimumWalletTopUpGhs"
    );

    if (request.amountGhs < minimumWalletTopUpGhs) {
      throw new Error(`Minimum wallet top-up is GHS ${minimumWalletTopUpGhs}.`);
    }

    return {
      purpose: request.purpose,
      userId: request.userId,
      amountGhs: request.amountGhs,
      metadata: {
        requestedAmountGhs: request.amountGhs,
        minimumWalletTopUpGhs,
        customerEmail: request.customerEmail
      }
    };
  }

  if (request.purpose === "agent_application_fee") {
    const agentOnboardingFeeGhs = await requirePositiveConfig(
      ctx,
      "agentOnboardingFeeGhs"
    );

    return {
      purpose: request.purpose,
      userId: request.userId,
      amountGhs: agentOnboardingFeeGhs,
      metadata: {
        agentOnboardingFeeGhs,
        customerEmail: request.customerEmail
      }
    };
  }

  if (!request.confirmRecipientIsCorrect) {
    throw new Error("Recipient number confirmation is required.");
  }

  const dataPackage = await ctx.db.get(request.packageId);

  if (dataPackage === null || !dataPackage.isAvailable) {
    throw new Error("Selected data package is not available.");
  }

  if (dataPackage.network !== request.network) {
    throw new Error("Selected package does not match the requested network.");
  }

  const user =
    "userId" in request && request.userId !== undefined
      ? await ctx.db.get(request.userId)
      : null;
  const amountGhs = await resolveDataPurchaseAmount(ctx, dataPackage, user);

  if (amountGhs <= 0) {
    throw new Error("Resolved purchase amount must be greater than zero.");
  }

  return {
    purpose: request.purpose,
    amountGhs,
    ...(user !== null ? { userId: user._id } : {}),
    ...(request.guestContactPhone !== undefined
      ? { guestContactPhone: request.guestContactPhone }
      : {}),
    metadata: {
      packageId: dataPackage._id,
      vendorId: dataPackage.vendorId,
      vendorPackageId: dataPackage.vendorPackageId,
      network: request.network,
      recipientPhone: request.recipientPhone,
      customerEmail: request.customerEmail,
      providerReference,
      baseCustomerPriceGhs: dataPackage.customerPriceGhs
    }
  };
}

async function resolveDataPurchaseAmount(
  ctx: MutationCtx,
  dataPackage: Doc<"dataPackages">,
  user: Doc<"users"> | null
) {
  const packageRule = await ctx.db
    .query("pricingRules")
    .withIndex("by_package", (q) => q.eq("packageId", dataPackage._id))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();
  const globalRule =
    packageRule === null
      ? await ctx.db
          .query("pricingRules")
          .filter((q) =>
            q.and(q.eq(q.field("isGlobal"), true), q.eq(q.field("isActive"), true))
          )
          .first()
      : null;
  const pricingRule = packageRule ?? globalRule;
  const basePrice =
    pricingRule === null
      ? dataPackage.customerPriceGhs
      : pricingRule.mode === "percentage"
        ? dataPackage.providerCostGhs * (1 + pricingRule.value / 100)
        : dataPackage.providerCostGhs + pricingRule.value;
  const agentDiscountPercentage =
    user?.role === "agent" ? ((await readNumberConfig(ctx, "agentDiscountPercentage")) ?? 0) : 0;
  const firstPurchaseDiscountGhs =
    user !== null && !user.firstPurchaseDiscountUsed
      ? ((await readNumberConfig(ctx, "firstPurchaseDiscountGhs")) ?? 0)
      : 0;
  const discounted = basePrice * (1 - agentDiscountPercentage / 100);

  return roundGhs(Math.max(discounted - firstPurchaseDiscountGhs, 0));
}

async function requirePositiveConfig(ctx: MutationCtx, key: string) {
  const value = await readNumberConfig(ctx, key);

  if (value === null || value <= 0) {
    throw new Error(`Missing required payment config: ${key}.`);
  }

  return value;
}

function roundGhs(value: number) {
  return Math.round(value * 100) / 100;
}
