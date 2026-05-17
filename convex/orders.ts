import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";

export const createIntent = mutation({
  args: {
    userId: v.optional(v.id("users")),
    guestContactPhone: v.optional(v.string()),
    packageId: v.id("dataPackages"),
    vendorId: v.string(),
    vendorPackageId: v.optional(v.string()),
    vendorOrderReference: v.optional(v.string()),
    vendorRaw: v.optional(v.any()),
    network: v.union(v.literal("mtn"), v.literal("telecel"), v.literal("airteltigo")),
    recipientPhone: v.string(),
    amountGhs: v.number(),
    paymentMethod: v.union(v.literal("paystack_momo"), v.literal("wallet")),
    idempotencyKey: v.string(),
    confirmRecipientIsCorrect: v.boolean()
  },
  handler: async (ctx, args) => {
    if (!args.confirmRecipientIsCorrect) {
      throw new Error("Recipient number confirmation is required.");
    }

    return await ctx.db.insert("orders", {
      packageId: args.packageId,
      vendorId: args.vendorId,
      network: args.network,
      recipientPhone: args.recipientPhone,
      amountGhs: args.amountGhs,
      paymentMethod: args.paymentMethod,
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

function canReadUserOrders(caller: Doc<"users">, userId: Id<"users">) {
  return caller.role === "admin" || caller._id === userId;
}

function canReadOrder(caller: Doc<"users">, order: Doc<"orders">) {
  return caller.role === "admin" || order.userId === caller._id;
}
