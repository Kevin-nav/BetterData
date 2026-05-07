import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    network: v.optional(v.union(v.literal("YELLO"), v.literal("TELECEL"), v.literal("AT_PREMIUM")))
  },
  handler: async (ctx, args) => {
    if (args.network) {
      return await ctx.db
        .query("dataPackages")
        .withIndex("by_network", (q) => q.eq("network", args.network))
        .collect();
    }

    return await ctx.db.query("dataPackages").collect();
  }
});
