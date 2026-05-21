import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const networkValidator = v.union(
  v.literal("mtn"),
  v.literal("telecel"),
  v.literal("airteltigo")
);

export const listForUserForApi = query({
  args: {
    apiSecret: v.string(),
    userId: v.id("users")
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    return await ctx.db
      .query("savedNumbers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  }
});

export const saveForUserForApi = mutation({
  args: {
    apiSecret: v.string(),
    userId: v.id("users"),
    label: v.string(),
    phone: v.string(),
    network: v.optional(networkValidator)
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    const existing = await ctx.db
      .query("savedNumbers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("phone"), args.phone))
      .first();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        label: args.label,
        ...(args.network !== undefined ? { network: args.network } : {})
      });
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("savedNumbers", {
      userId: args.userId,
      label: args.label,
      phone: args.phone,
      ...(args.network !== undefined ? { network: args.network } : {})
    });

    return await ctx.db.get(id);
  }
});

export const deleteForUserForApi = mutation({
  args: {
    apiSecret: v.string(),
    userId: v.id("users"),
    savedNumberId: v.id("savedNumbers")
  },
  handler: async (ctx, args) => {
    requireApiSecret(args.apiSecret);

    const savedNumber = await ctx.db.get(args.savedNumberId);

    if (savedNumber === null) {
      return { deleted: false };
    }

    if (savedNumber.userId !== args.userId) {
      throw new Error("Unauthorized.");
    }

    await ctx.db.delete(args.savedNumberId);
    return { deleted: true };
  }
});

function requireApiSecret(apiSecret: string) {
  const expected = process.env.CONVEX_API_SECRET;

  if (!expected || apiSecret !== expected) {
    throw new Error("Unauthorized.");
  }
}
