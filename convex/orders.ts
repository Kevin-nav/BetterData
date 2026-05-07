import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createIntent = mutation({
  args: {
    userId: v.optional(v.id("users")),
    guestContactPhone: v.optional(v.string()),
    packageId: v.id("dataPackages"),
    network: v.union(v.literal("YELLO"), v.literal("TELECEL"), v.literal("AT_PREMIUM")),
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
      userId: args.userId,
      guestContactPhone: args.guestContactPhone,
      packageId: args.packageId,
      network: args.network,
      recipientPhone: args.recipientPhone,
      amountGhs: args.amountGhs,
      paymentMethod: args.paymentMethod,
      status: "pending",
      idempotencyKey: args.idempotencyKey,
      recipientConfirmedAt: Date.now()
    });
  }
});

export const listForUser = query({
  args: {
    userId: v.id("users")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  }
});
