import { query } from "./_generated/server";

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const pendingAgents = await ctx.db
      .query("agentApplications")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return {
      revenue: {
        dailyGhs: 0,
        weeklyGhs: 0,
        monthlyGhs: 0
      },
      datamartBalanceGhs: 0,
      pendingAgentApplications: pendingAgents.length
    };
  }
});
