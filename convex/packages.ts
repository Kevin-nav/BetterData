import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    network: v.optional(v.union(v.literal("mtn"), v.literal("telecel"), v.literal("airteltigo")))
  },
  handler: async (ctx, args) => {
    const network = args.network;

    if (network !== undefined) {
      return await ctx.db
        .query("dataPackages")
        .withIndex("by_network", (q) => q.eq("network", network))
        .collect();
    }

    return await ctx.db.query("dataPackages").collect();
  }
});

export const listAvailable = query({
  args: {
    network: v.optional(v.union(v.literal("mtn"), v.literal("telecel"), v.literal("airteltigo")))
  },
  handler: async (ctx, args) => {
    const network = args.network;
    const packages =
      network !== undefined
        ? await ctx.db
            .query("dataPackages")
            .withIndex("by_network", (q) => q.eq("network", network))
            .collect()
        : await ctx.db.query("dataPackages").collect();

    return packages.filter((item) => item.isAvailable);
  }
});
