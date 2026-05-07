import { query } from "./_generated/server";
import { v } from "convex/values";

export const summary = query({
  args: {
    userId: v.id("users")
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    const transactions = await ctx.db
      .query("walletTransactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(20);

    return {
      balanceGhs: user?.walletBalanceGhs ?? 0,
      transactions
    };
  }
});
