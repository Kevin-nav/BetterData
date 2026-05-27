import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { createNotification } from "./notifications";

export const createIntent = mutation({
  args: {
    apiSecret: v.string(),
    reference: v.string(),
    userId: v.optional(v.id("users")),
    guestContactPhone: v.optional(v.string()),
    packageId: v.string(),
    vendorId: v.string(),
    vendorPackageId: v.optional(v.string()),
    vendorOrderReference: v.optional(v.string()),
    vendorRaw: v.optional(v.any()),
    network: v.union(v.literal("mtn"), v.literal("telecel"), v.literal("airteltigo")),
    recipientPhone: v.string(),
    amountGhs: v.number(),
    paymentMethod: v.union(v.literal("paystack_momo"), v.literal("wallet")),
    paymentStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("verified"),
        v.literal("failed"),
        v.literal("refunded")
      )
    ),
    idempotencyKey: v.string(),
    confirmRecipientIsCorrect: v.boolean()
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    if (!args.confirmRecipientIsCorrect) {
      throw new Error("Recipient number confirmation is required.");
    }

    const dataPackage = await findDataPackageForFinancialSnapshot(ctx, {
      packageId: args.packageId,
      vendorId: args.vendorId,
      ...(args.vendorPackageId !== undefined
        ? { vendorPackageId: args.vendorPackageId }
        : {})
    });
    const costGhsAtPurchase = dataPackage?.providerCostGhs;
    const markupGhsAtPurchase =
      costGhsAtPurchase !== undefined
        ? roundGhs(args.amountGhs - costGhsAtPurchase)
        : undefined;

    const orderId = await ctx.db.insert("orders", {
      reference: args.reference,
      packageId: args.packageId,
      vendorId: args.vendorId,
      network: args.network,
      recipientPhone: args.recipientPhone,
      amountGhs: args.amountGhs,
      ...(costGhsAtPurchase !== undefined ? { costGhsAtPurchase } : {}),
      ...(markupGhsAtPurchase !== undefined ? { markupGhsAtPurchase } : {}),
      paymentMethod: args.paymentMethod,
      paymentStatus: args.paymentStatus ?? "pending",
      status: "pending",
      idempotencyKey: args.idempotencyKey,
      recipientConfirmedAt: Date.now(),
      ...(args.userId !== undefined ? { userId: args.userId } : {}),
      ...(args.guestContactPhone !== undefined
        ? { guestContactPhone: args.guestContactPhone }
        : {}),
      ...(args.vendorPackageId !== undefined
        ? { vendorPackageId: args.vendorPackageId }
        : {}),
      ...(args.vendorOrderReference !== undefined
        ? { vendorOrderReference: args.vendorOrderReference }
        : {}),
      ...(args.vendorRaw !== undefined ? { vendorRaw: args.vendorRaw } : {})
    });

    if (args.userId !== undefined) {
      const packageName = dataPackage ? dataPackage.name : "Data bundle";
      const networkLabel = args.network.toUpperCase();
      await createNotification(ctx, {
        userId: args.userId,
        title: "Order Placed",
        body: `Your order for ${networkLabel} ${packageName} to ${args.recipientPhone} is processing. Ref: ${args.reference}`,
        type: "order_status",
        referenceId: args.reference,
        dedupeKey: `order:${args.reference}:placed`
      });
    }

    return orderId;
  }
});

export const createWalletPurchaseForApi = mutation({
  args: {
    apiSecret: v.string(),
    reference: v.string(),
    userId: v.id("users"),
    packageId: v.string(),
    vendorId: v.string(),
    vendorPackageId: v.optional(v.string()),
    network: v.union(v.literal("mtn"), v.literal("telecel"), v.literal("airteltigo")),
    recipientPhone: v.string(),
    amountGhs: v.number(),
    idempotencyKey: v.string(),
    confirmRecipientIsCorrect: v.boolean()
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    if (!args.confirmRecipientIsCorrect) {
      throw new Error("Recipient number confirmation is required.");
    }

    if (!Number.isFinite(args.amountGhs) || args.amountGhs <= 0) {
      throw new Error("Wallet purchase amount is invalid.");
    }

    const existingOrder = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .first();

    if (existingOrder !== null) {
      return existingOrder;
    }

    const user = await ctx.db.get(args.userId);

    if (user === null) {
      throw new Error("Wallet user not found.");
    }

    if (user.isSuspended) {
      throw new Error("Your account is suspended. Please contact support.");
    }

    if (roundGhs(user.walletBalanceGhs) < roundGhs(args.amountGhs)) {
      throw new Error(
        `Your wallet balance is too low for this purchase. Please top up your wallet or choose Mobile Money.`
      );
    }

    const existingDebit = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .filter((q) => q.eq(q.field("type"), "purchase"))
      .first();

    if (existingDebit === null) {
      await ctx.db.patch(args.userId, {
        walletBalanceGhs: roundGhs(user.walletBalanceGhs - args.amountGhs)
      });

      await ctx.db.insert("walletTransactions", {
        userId: args.userId,
        type: "purchase",
        amountGhs: roundGhs(args.amountGhs),
        reference: args.reference,
        notes: "Data bundle purchase"
      });
    }

    const dataPackage = await findDataPackageForFinancialSnapshot(ctx, {
      packageId: args.packageId,
      vendorId: args.vendorId,
      ...(args.vendorPackageId !== undefined
        ? { vendorPackageId: args.vendorPackageId }
        : {})
    });
    const costGhsAtPurchase = dataPackage?.providerCostGhs;
    const markupGhsAtPurchase =
      costGhsAtPurchase !== undefined
        ? roundGhs(args.amountGhs - costGhsAtPurchase)
        : undefined;
    const now = Date.now();

    const orderId = await ctx.db.insert("orders", {
      reference: args.reference,
      userId: args.userId,
      packageId: args.packageId,
      vendorId: args.vendorId,
      ...(args.vendorPackageId !== undefined
        ? { vendorPackageId: args.vendorPackageId }
        : {}),
      network: args.network,
      recipientPhone: args.recipientPhone,
      amountGhs: roundGhs(args.amountGhs),
      ...(costGhsAtPurchase !== undefined ? { costGhsAtPurchase } : {}),
      ...(markupGhsAtPurchase !== undefined ? { markupGhsAtPurchase } : {}),
      paymentMethod: "wallet",
      paymentStatus: "verified",
      status: "pending",
      idempotencyKey: args.idempotencyKey,
      recipientConfirmedAt: now
    });

    const order = await ctx.db.get(orderId);

    const packageName = dataPackage ? dataPackage.name : "Data bundle";
    const networkLabel = args.network.toUpperCase();
    await createNotification(ctx, {
      userId: args.userId,
      title: "Wallet Debited",
      body: `GHS ${roundGhs(args.amountGhs)} has been debited for your ${networkLabel} ${packageName} order to ${args.recipientPhone}.`,
      type: "wallet_update",
      referenceId: args.reference,
      dedupeKey: `wallet:${args.reference}:purchase`
    });
    await createNotification(ctx, {
      userId: args.userId,
      title: "Order Placed",
      body: `Your order for ${networkLabel} ${packageName} to ${args.recipientPhone} is processing. Ref: ${args.reference}`,
      type: "order_status",
      referenceId: args.reference,
      dedupeKey: `order:${args.reference}:placed`
    });

    if (order === null) {
      throw new Error("Wallet order creation failed.");
    }

    return order;
  }
});

async function findDataPackageForFinancialSnapshot(
  ctx: QueryCtx | MutationCtx,
  input: {
    packageId: string;
    vendorId: string;
    vendorPackageId?: string;
  }
) {
  const vendorPackageId =
    input.vendorPackageId ?? vendorPackageIdFromScopedPackageId(input.packageId);

  if (vendorPackageId !== undefined) {
    const vendorPackage = await ctx.db
      .query("dataPackages")
      .withIndex("by_vendor_package_id", (q) =>
        q.eq("vendorId", input.vendorId).eq("vendorPackageId", vendorPackageId)
      )
      .first();

    if (vendorPackage !== null) {
      return vendorPackage;
    }
  }

  try {
    return await ctx.db.get(input.packageId as Id<"dataPackages">);
  } catch {
    return null;
  }
}

function vendorPackageIdFromScopedPackageId(packageId: string) {
  if (!packageId.includes(":")) {
    return undefined;
  }

  return packageId.split(":").at(-1);
}

export const recordVendorResult = mutation({
  args: {
    apiSecret: v.string(),
    reference: v.string(),
    vendorOrderReference: v.string(),
    vendorRaw: v.optional(v.any()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("refunded")
    )
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .first();

    if (order === null) {
      throw new Error("Order not found.");
    }

    await ctx.db.patch(order._id, {
      vendorOrderReference: args.vendorOrderReference,
      status: args.status,
      ...(args.vendorRaw !== undefined ? { vendorRaw: args.vendorRaw } : {})
    });

    if (
      order.userId !== undefined &&
      order.status !== args.status &&
      (args.status === "completed" || args.status === "failed")
    ) {
      const dataPackage = await findDataPackageForFinancialSnapshot(ctx, {
        packageId: order.packageId,
        vendorId: order.vendorId,
        ...(order.vendorPackageId !== undefined
          ? { vendorPackageId: order.vendorPackageId }
          : {})
      });
      const packageName = dataPackage ? dataPackage.name : "Data bundle";
      const networkLabel = order.network.toUpperCase();
      if (args.status === "completed") {
        await createNotification(ctx, {
          userId: order.userId,
          title: "Order Successful",
          body: `Success! Your ${networkLabel} ${packageName} data bundle has been successfully sent to ${order.recipientPhone}.`,
          type: "order_status",
          referenceId: order.reference,
          dedupeKey: `order:${order.reference}:completed`
        });
      } else {
        await createNotification(ctx, {
          userId: order.userId,
          title: "Order Failed",
          body: `Your order for ${networkLabel} ${packageName} to ${order.recipientPhone} failed. GHS ${order.amountGhs} will be refunded.`,
          type: "order_status",
          referenceId: order.reference,
          dedupeKey: `order:${order.reference}:failed`
        });
      }
    }

    return order._id;
  }
});

export const recordFailureForApi = mutation({
  args: {
    apiSecret: v.string(),
    reference: v.string(),
    vendorRaw: v.optional(v.any()),
    status: v.literal("failed")
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .first();

    if (order === null) {
      throw new Error("Order not found.");
    }

    await ctx.db.patch(order._id, {
      status: args.status,
      ...(args.vendorRaw !== undefined ? { vendorRaw: args.vendorRaw } : {})
    });

    if (order.userId !== undefined && order.status !== args.status) {
      const dataPackage = await findDataPackageForFinancialSnapshot(ctx, {
        packageId: order.packageId,
        vendorId: order.vendorId,
        ...(order.vendorPackageId !== undefined
          ? { vendorPackageId: order.vendorPackageId }
          : {})
      });
      const packageName = dataPackage ? dataPackage.name : "Data bundle";
      const networkLabel = order.network.toUpperCase();
      await createNotification(ctx, {
        userId: order.userId,
        title: "Order Failed",
        body: `Your order for ${networkLabel} ${packageName} to ${order.recipientPhone} failed. GHS ${order.amountGhs} will be refunded.`,
        type: "order_status",
        referenceId: order.reference,
        dedupeKey: `order:${order.reference}:failed`
      });
    }

    return order._id;
  }
});

export const listForUser = query({
  args: {
    userId: v.id("users")
  },
  handler: async (ctx, args) => {
    const caller = await requireAuthenticatedUser(ctx);

    if (!canReadUserOrders(caller, args.userId)) {
      throw new Error("Unauthorized.");
    }

    return await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  }
});

export const markBalanceRetryForApi = mutation({
  args: {
    apiSecret: v.string(),
    reference: v.string(),
    deadlineAt: v.number(),
    vendorRaw: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    const order = await findOrderByReference(ctx, args.reference);

    if (order === null) {
      throw new Error("Order not found.");
    }

    const startedAt = order.balanceRetryStartedAt ?? Date.now();

    await ctx.db.patch(order._id, {
      status: "processing",
      balanceRetryStartedAt: startedAt,
      balanceRetryDeadlineAt: order.balanceRetryDeadlineAt ?? args.deadlineAt,
      ...(args.vendorRaw !== undefined ? { vendorRaw: args.vendorRaw } : {})
    });

    return order._id;
  }
});

export const refundToWalletForApi = mutation({
  args: {
    apiSecret: v.string(),
    reference: v.string(),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    const order = await findOrderByReference(ctx, args.reference);

    if (order === null) {
      throw new Error("Order not found.");
    }

    if (order.userId === undefined) {
      throw new Error("Guest orders require manual refund review.");
    }

    if (order.walletRefundedAt !== undefined || order.status === "refunded") {
      return { refunded: false, reason: "already_refunded" };
    }

    const existingRefund = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .filter((q) => q.eq(q.field("type"), "refund"))
      .first();

    if (existingRefund !== null) {
      await ctx.db.patch(order._id, {
        status: "refunded",
        paymentStatus: "refunded",
        walletRefundedAt: Date.now(),
        refundReference: args.reference
      });
      return { refunded: false, reason: "existing_refund_transaction" };
    }

    const user = await ctx.db.get(order.userId);

    if (user === null) {
      throw new Error("Refund user not found.");
    }

    await ctx.db.patch(order.userId, {
      walletBalanceGhs: roundGhs(user.walletBalanceGhs + order.amountGhs)
    });

    await ctx.db.insert("walletTransactions", {
      userId: order.userId,
      type: "refund",
      amountGhs: order.amountGhs,
      reference: args.reference,
      notes: args.notes ?? "Automatic refund for unfulfilled data purchase"
    });

    await ctx.db.patch(order._id, {
      status: "refunded",
      paymentStatus: "refunded",
      walletRefundedAt: Date.now(),
      refundReference: args.reference
    });

    await createNotification(ctx, {
      userId: order.userId,
      title: "Refund Issued",
      body: `GHS ${order.amountGhs} has been refunded to your wallet for order ${order.reference}.`,
      type: "wallet_update",
      referenceId: order.reference,
      dedupeKey: `wallet:${order.reference}:refund`
    });

    return { refunded: true };
  }
});

export const listForUserForApi = query({
  args: {
    apiSecret: v.string(),
    userId: v.id("users")
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    return await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  }
});

export const getById = query({
  args: {
    orderId: v.id("orders")
  },
  handler: async (ctx, args) => {
    const caller = await requireAuthenticatedUser(ctx);
    const order = await ctx.db.get(args.orderId);

    if (order === null) {
      return null;
    }

    if (!canReadOrder(caller, order)) {
      throw new Error("Unauthorized.");
    }

    return order;
  }
});

export const getByReferenceForApi = query({
  args: {
    apiSecret: v.string(),
    reference: v.string()
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .first();

    if (order === null) {
      return null;
    }

    return order;
  }
});

async function findOrderByReference(ctx: QueryCtx | MutationCtx, reference: string) {
  return await ctx.db
    .query("orders")
    .withIndex("by_reference", (q) => q.eq("reference", reference))
    .first();
}

export const listForApi = query({
  args: {
    apiSecret: v.string(),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("refunded")
      )
    )
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    if (args.status !== undefined) {
      const status = args.status;

      return await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(100);
    }

    return await ctx.db.query("orders").order("desc").take(100);
  }
});

export const getByVendorReference = query({
  args: {
    vendorId: v.string(),
    vendorOrderReference: v.string()
  },
  handler: async (ctx, args) => {
    const caller = await requireAuthenticatedUser(ctx);
    const order = await ctx.db
      .query("orders")
      .withIndex("by_vendor_order_reference", (q) =>
        q
          .eq("vendorId", args.vendorId)
          .eq("vendorOrderReference", args.vendorOrderReference)
      )
      .first();

    if (order === null) {
      return null;
    }

    if (!canReadOrder(caller, order)) {
      throw new Error("Unauthorized.");
    }

    return order;
  }
});

async function requireAuthenticatedUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    throw new Error("Unauthorized.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
    .first();

  if (user === null) {
    throw new Error("Unauthorized.");
  }

  return user;
}

function requireApiSecret(apiSecret: string) {
  const expected = process.env.CONVEX_API_SECRET;

  if (!expected || apiSecret !== expected) {
    throw new Error("Unauthorized.");
  }
}

function roundGhs(value: number) {
  return Math.round(value * 100) / 100;
}

function canReadUserOrders(caller: Doc<"users">, userId: Id<"users">) {
  return caller.role === "admin" || caller.role === "superadmin" || caller._id === userId;
}

function canReadOrder(caller: Doc<"users">, order: Doc<"orders">) {
  return caller.role === "admin" || caller.role === "superadmin" || order.userId === caller._id;
}
