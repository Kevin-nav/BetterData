import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAdminScopeForRole, isBootstrapSuperadmin } from "./adminConfig";
import { requireServiceSecret } from "./serviceAuth";

/* ── Admin Auth Helpers ── */

type AdminIdentity = {
  userId: string;
  scope: "superadmin" | "admin";
};

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<AdminIdentity> {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    throw new Error("Unauthorized.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", identity.subject))
    .first();

  if (!user) {
    throw new Error("User not found.");
  }

  if (isBootstrapSuperadmin(user.email)) {
    return { userId: user._id, scope: "superadmin" };
  }

  const scope = getAdminScopeForRole(user.role);

  if (scope) {
    return { userId: user._id, scope };
  }

  throw new Error("Admin access is required.");
}

export async function requireSuperadmin(
  ctx: QueryCtx | MutationCtx
): Promise<AdminIdentity> {
  const admin = await requireAdmin(ctx);

  if (admin.scope !== "superadmin") {
    throw new Error("Superadmin access is required.");
  }

  return admin;
}

/* ── Dashboard Queries ── */

type FinancialSummary = {
  revenue: number;
  profit: number;
  orderCount: number;
  marginPct: number;
};

type FinancialTotals = {
  revenue: number;
  profit: number;
  orderCount: number;
};

type FinancialOrder = {
  order: Doc<"orders">;
  revenue: number;
  profit: number;
  missingSnapshot: boolean;
  missingPackageCost: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

async function calculateRevenue(ctx: QueryCtx | MutationCtx) {
  const now = Date.now();
  const oneDayAgo = now - DAY_MS;
  const oneWeekAgo = now - 7 * DAY_MS;
  const twoWeeksAgo = now - 14 * DAY_MS;
  const oneMonthAgo = now - 30 * DAY_MS;
  const twoMonthsAgo = now - 60 * DAY_MS;
  const ninetyDaysAgo = now - 90 * DAY_MS;

  const paidOrders = await ctx.db
    .query("orders")
    .withIndex("by_payment_status", (q) => q.eq("paymentStatus", "verified"))
    .filter((q) => q.gt(q.field("_creationTime"), ninetyDaysAgo))
    .collect();

  const packageCostCache = new Map<string, number | null>();
  const financialOrders: FinancialOrder[] = [];

  for (const order of paidOrders) {
    const snapshot = await resolveOrderFinancials(ctx, order, packageCostCache);
    financialOrders.push(snapshot);
  }

  const daily = summarizeWindow(financialOrders, oneDayAgo, now);
  const weekly = summarizeWindow(financialOrders, oneWeekAgo, now);
  const previousWeek = summarizeWindow(financialOrders, twoWeeksAgo, oneWeekAgo);
  const monthly = summarizeWindow(financialOrders, oneMonthAgo, now);
  const previousMonth = summarizeWindow(financialOrders, twoMonthsAgo, oneMonthAgo);
  const dailyTrend = buildDailyTrend(financialOrders, ninetyDaysAgo, now);

  const missingSnapshotCount = financialOrders.filter((item) => item.missingSnapshot).length;
  const missingPackageCostCount = financialOrders.filter((item) => item.missingPackageCost).length;

  return {
    daily,
    weekly,
    monthly,
    deltas: {
      revenueWoW: percentDelta(weekly.revenue, previousWeek.revenue),
      profitWoW: percentDelta(weekly.profit, previousWeek.profit),
      revenueMoM: percentDelta(monthly.revenue, previousMonth.revenue),
      profitMoM: percentDelta(monthly.profit, previousMonth.profit),
    },
    dailyTrend,
    audit: {
      missingSnapshotCount,
      missingPackageCostCount,
    }
  };
}

async function resolveOrderFinancials(
  ctx: QueryCtx | MutationCtx,
  order: Doc<"orders">,
  packageCostCache: Map<string, number | null>
): Promise<FinancialOrder> {
  const revenue = roundGhs(order.amountGhs);
  const hasCostSnapshot = order.costGhsAtPurchase !== undefined;
  const hasMarkupSnapshot = order.markupGhsAtPurchase !== undefined;

  if (hasCostSnapshot || hasMarkupSnapshot) {
    const cost =
      order.costGhsAtPurchase ??
      Math.max(revenue - (order.markupGhsAtPurchase ?? 0), 0);
    const profit = order.markupGhsAtPurchase ?? revenue - cost;

    return {
      order,
      revenue,
      profit: roundGhs(profit),
      missingSnapshot: !hasCostSnapshot || !hasMarkupSnapshot,
      missingPackageCost: false,
    };
  }

  const packageCost = await getPackageCost(ctx, order, packageCostCache);

  if (packageCost === null) {
    return {
      order,
      revenue,
      profit: 0,
      missingSnapshot: true,
      missingPackageCost: true,
    };
  }

  return {
    order,
    revenue,
    profit: roundGhs(revenue - packageCost),
    missingSnapshot: true,
    missingPackageCost: false,
  };
}

async function getPackageCost(
  ctx: QueryCtx | MutationCtx,
  order: Doc<"orders">,
  packageCostCache: Map<string, number | null>
) {
  const cacheKey = packageCostCacheKey(order);

  if (packageCostCache.has(cacheKey)) {
    return packageCostCache.get(cacheKey) ?? null;
  }

  const vendorPackageId =
    order.vendorPackageId ?? vendorPackageIdFromScopedPackageId(order.packageId);

  if (vendorPackageId !== undefined) {
    const dataPackage = await ctx.db
      .query("dataPackages")
      .withIndex("by_vendor_package_id", (q) =>
        q.eq("vendorId", order.vendorId).eq("vendorPackageId", vendorPackageId)
      )
      .first();
    const cost = dataPackage?.providerCostGhs ?? null;

    if (cost !== null) {
      packageCostCache.set(cacheKey, cost);
      return cost;
    }
  }

  try {
    const dataPackage = await ctx.db.get(order.packageId as Id<"dataPackages">);
    const cost = dataPackage?.providerCostGhs ?? null;
    packageCostCache.set(cacheKey, cost);
    return cost;
  } catch {
    packageCostCache.set(cacheKey, null);
    return null;
  }
}

function packageCostCacheKey(order: Doc<"orders">) {
  return `${order.vendorId}:${order.vendorPackageId ?? order.packageId}`;
}

function vendorPackageIdFromScopedPackageId(packageId: string) {
  if (!packageId.includes(":")) {
    return undefined;
  }

  return packageId.split(":").at(-1);
}

function summarizeWindow(
  orders: FinancialOrder[],
  start: number,
  end: number
): FinancialSummary {
  const totals = orders.reduce<FinancialTotals>(
    (acc, item) => {
      if (item.order._creationTime >= start && item.order._creationTime < end) {
        acc.revenue += item.revenue;
        acc.profit += item.profit;
        acc.orderCount += 1;
      }

      return acc;
    },
    { revenue: 0, profit: 0, orderCount: 0 }
  );

  return toSummary(totals);
}

function buildDailyTrend(orders: FinancialOrder[], start: number, end: number) {
  const buckets = new Map<string, FinancialTotals & { timestamp: number }>();
  const startDate = startOfUtcDay(start);
  const endDate = startOfUtcDay(end);

  for (let timestamp = startDate; timestamp <= endDate; timestamp += DAY_MS) {
    buckets.set(dateKey(timestamp), {
      timestamp,
      revenue: 0,
      profit: 0,
      orderCount: 0,
    });
  }

  for (const item of orders) {
    const timestamp = startOfUtcDay(item.order._creationTime);
    const key = dateKey(timestamp);
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.revenue += item.revenue;
      bucket.profit += item.profit;
      bucket.orderCount += 1;
    }
  }

  return Array.from(buckets.entries()).map(([date, bucket]) => ({
    date,
    timestamp: bucket.timestamp,
    revenue: roundGhs(bucket.revenue),
    profit: roundGhs(bucket.profit),
    orderCount: bucket.orderCount,
    marginPct: marginPct(bucket.revenue, bucket.profit),
  }));
}

function toSummary(totals: FinancialTotals): FinancialSummary {
  return {
    revenue: roundGhs(totals.revenue),
    profit: roundGhs(totals.profit),
    orderCount: totals.orderCount,
    marginPct: marginPct(totals.revenue, totals.profit),
  };
}

function percentDelta(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function marginPct(revenue: number, profit: number) {
  if (revenue <= 0) {
    return 0;
  }

  return Math.round((profit / revenue) * 1000) / 10;
}

function startOfUtcDay(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dateKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function roundGhs(value: number) {
  return Math.round(value * 100) / 100;
}

export const backfillOrdersFinancials = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").collect();
    const packageCostCache = new Map<string, number | null>();
    let backfilledCount = 0;
    let missingPackageCostCount = 0;

    for (const order of orders) {
      if (
        order.costGhsAtPurchase !== undefined &&
        order.markupGhsAtPurchase !== undefined
      ) {
        continue;
      }

      const packageCost = await getPackageCost(ctx, order, packageCostCache);

      if (packageCost === null) {
        missingPackageCostCount += 1;
        await ctx.db.patch(order._id, {
          costGhsAtPurchase: order.amountGhs,
          markupGhsAtPurchase: 0,
        });
      } else {
        await ctx.db.patch(order._id, {
          costGhsAtPurchase: packageCost,
          markupGhsAtPurchase: roundGhs(order.amountGhs - packageCost),
        });
      }

      backfilledCount += 1;
    }

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "backfill_orders_financials",
      target: "orders",
      metadata: {
        backfilledCount,
        missingPackageCostCount,
      },
    });

    return {
      backfilledCount,
      missingPackageCostCount,
    };
  },
});

export const revenueOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await calculateRevenue(ctx);
  }
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const pendingAgents = await ctx.db
      .query("agentApplications")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const revenue = await calculateRevenue(ctx);

    return {
      revenue,
      vendorBalanceGhs: 0,
      pendingAgentApplications: pendingAgents.length
    };
  }
});

export const dashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const allUsers = await ctx.db.query("users").collect();
    const agents = allUsers.filter((u) => u.role === "agent");
    const admins = allUsers.filter((u) => u.role === "admin" || u.role === "superadmin");

    const pendingApplications = await ctx.db
      .query("agentApplications")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const recentOrders = await ctx.db
      .query("orders")
      .order("desc")
      .take(5);

    return {
      totalUsers: allUsers.length,
      totalAgents: agents.length,
      totalAdmins: admins.length,
      pendingAgentApplications: pendingApplications.length,
      recentOrders: recentOrders.map((order) => ({
        _id: order._id,
        reference: order.reference,
        network: order.network,
        status: order.status,
        amountGhs: order.amountGhs,
        _creationTime: order._creationTime,
      })),
    };
  }
});

export const listOpenAlerts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("opsAlerts")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(100);
  }
});

export const acknowledgeAlert = mutation({
  args: { alertId: v.id("opsAlerts") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Ops alert not found.");

    await ctx.db.patch(args.alertId, {
      status: "acknowledged",
      updatedAt: Date.now()
    });

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "acknowledge_ops_alert",
      target: args.alertId,
      metadata: { message: alert.message, reference: alert.reference },
    });
  }
});

export const resolveAlert = mutation({
  args: { alertId: v.id("opsAlerts") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Ops alert not found.");

    await ctx.db.patch(args.alertId, {
      status: "resolved",
      resolvedAt: Date.now(),
      updatedAt: Date.now()
    });

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "resolve_ops_alert",
      target: args.alertId,
      metadata: { message: alert.message, reference: alert.reference },
    });
  }
});

/* ── Admin Management (Superadmin Only) ── */

export const listAdmins = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);

    const users = await ctx.db.query("users").collect();
    return users
      .filter((user) => user.role === "admin" || user.role === "superadmin")
      .sort((a, b) => b._creationTime - a._creationTime);
  }
});

export const promoteToAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireSuperadmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");
    if (user.role === "admin" || user.role === "superadmin") {
      throw new Error("User already has admin access.");
    }

    await ctx.db.patch(args.userId, { role: "admin" });

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "promote_to_admin",
      target: args.userId,
      metadata: { previousRole: user.role },
    });
  }
});

export const demoteFromAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireSuperadmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");
    if (user.role === "superadmin" || isBootstrapSuperadmin(user.email)) {
      throw new Error("Cannot demote a superadmin.");
    }

    if (user.role !== "admin") throw new Error("User is not an admin.");

    await ctx.db.patch(args.userId, { role: "user" });

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "demote_from_admin",
      target: args.userId,
      metadata: { previousRole: "admin" },
    });
  }
});

/* ── Order Management Queries & Mutations ── */

export const listOrders = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
    network: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let q = ctx.db.query("orders");

    if (args.status) {
      q = q.filter((f) => f.eq(f.field("status"), args.status));
    }
    if (args.network) {
      q = q.filter((f) => f.eq(f.field("network"), args.network));
    }
    if (args.paymentMethod) {
      q = q.filter((f) => f.eq(f.field("paymentMethod"), args.paymentMethod));
    }
    if (args.search) {
      const searchStr = args.search;
      q = q.filter((f) =>
        f.or(
          f.eq(f.field("reference"), searchStr),
          f.eq(f.field("recipientPhone"), searchStr)
        )
      );
    }

    return await q.order("desc").paginate(args.paginationOpts);
  },
});

export const getOrderByReference = query({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .first();

    if (!order) return null;

    let user = null;
    if (order.userId) {
      user = await ctx.db.get(order.userId);
    }

    return {
      ...order,
      user: user
        ? {
            _id: user._id,
            displayName: user.displayName,
            email: user.email,
            phone: user.phone,
            role: user.role,
          }
        : null,
    };
  },
});

export const refundOrder = mutation({
  args: { orderId: v.id("orders"), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");

    if (order.status === "refunded") {
      throw new Error("Order is already refunded.");
    }

    // Update order status to refunded
    await ctx.db.patch(args.orderId, {
      status: "refunded",
      paymentStatus: "refunded",
    });

    // If order has user, credit the wallet
    if (order.userId) {
      const user = await ctx.db.get(order.userId);
      if (user) {
        const refundAmount = order.amountGhs;
        await ctx.db.patch(order.userId, {
          walletBalanceGhs: user.walletBalanceGhs + refundAmount,
        });

        await ctx.db.insert("walletTransactions", {
          userId: order.userId,
          type: "refund",
          amountGhs: refundAmount,
          reference: order.reference,
          notes: args.notes ?? `Admin refund for order ${order.reference}`,
        });
      }
    }

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "refund_order",
      target: args.orderId,
      metadata: {
        reference: order.reference,
        amountGhs: order.amountGhs,
        paymentMethod: order.paymentMethod,
        notes: args.notes,
      },
    });
  },
});

/* ── User Management Queries & Mutations ── */

export const listUsers = query({
  args: {
    paginationOpts: paginationOptsValidator,
    role: v.optional(
      v.union(
        v.literal("user"),
        v.literal("agent"),
        v.literal("admin"),
        v.literal("superadmin")
      )
    ),
    isSuspended: v.optional(v.boolean()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let q = ctx.db.query("users");

    if (args.role) {
      q = q.filter((f) => f.eq(f.field("role"), args.role));
    }
    if (args.isSuspended !== undefined) {
      q = q.filter((f) => f.eq(f.field("isSuspended"), args.isSuspended));
    }
    if (args.search) {
      const searchStr = args.search;
      q = q.filter((f) =>
        f.or(
          f.eq(f.field("email"), searchStr),
          f.eq(f.field("displayName"), searchStr),
          f.eq(f.field("phone"), searchStr)
        )
      );
    }

    return await q.order("desc").paginate(args.paginationOpts);
  },
});

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.userId);
  },
});

export const suspendUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    await ctx.db.patch(args.userId, { isSuspended: true });

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "suspend_user",
      target: args.userId,
      metadata: { email: user.email },
    });
  },
});

export const unsuspendUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    await ctx.db.patch(args.userId, { isSuspended: false });

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "unsuspend_user",
      target: args.userId,
      metadata: { email: user.email },
    });
  },
});

export const creditWallet = mutation({
  args: {
    userId: v.id("users"),
    amountGhs: v.number(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    if (args.amountGhs <= 0) {
      throw new Error("Amount must be greater than zero.");
    }

    const newBalance = user.walletBalanceGhs + args.amountGhs;
    await ctx.db.patch(args.userId, { walletBalanceGhs: newBalance });

    const ref = `admin-credit-${Date.now()}`;
    await ctx.db.insert("walletTransactions", {
      userId: args.userId,
      type: "admin_credit",
      amountGhs: args.amountGhs,
      reference: ref,
      notes: args.notes,
    });

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "credit_wallet",
      target: args.userId,
      metadata: {
        amountGhs: args.amountGhs,
        notes: args.notes,
        reference: ref,
      },
    });
  },
});

export const debitWallet = mutation({
  args: {
    userId: v.id("users"),
    amountGhs: v.number(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    if (args.amountGhs <= 0) {
      throw new Error("Amount must be greater than zero.");
    }

    if (user.walletBalanceGhs < args.amountGhs) {
      throw new Error("Insufficient wallet balance.");
    }

    const newBalance = user.walletBalanceGhs - args.amountGhs;
    await ctx.db.patch(args.userId, { walletBalanceGhs: newBalance });

    const ref = `admin-debit-${Date.now()}`;
    await ctx.db.insert("walletTransactions", {
      userId: args.userId,
      type: "admin_debit",
      amountGhs: args.amountGhs,
      reference: ref,
      notes: args.notes,
    });

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "debit_wallet",
      target: args.userId,
      metadata: {
        amountGhs: args.amountGhs,
        notes: args.notes,
        reference: ref,
      },
    });
  },
});

export const listWalletTransactions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("walletTransactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getUserOrders = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getUserSavedNumbers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("savedNumbers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/* ── Agent Management Queries & Mutations ── */

export const listAgentApplications = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let q = ctx.db.query("agentApplications");
    if (args.status) {
      q = q.filter((f) => f.eq(f.field("status"), args.status));
    }

    const applications = await q.order("desc").collect();

    const results = [];
    for (const app of applications) {
      const user = await ctx.db.get(app.userId);
      results.push({
        ...app,
        user: user
          ? {
              displayName: user.displayName,
              email: user.email,
              phone: user.phone,
              isSuspended: user.isSuspended,
            }
          : null,
      });
    }
    return results;
  },
});

export const approveAgentApplication = mutation({
  args: { applicationId: v.id("agentApplications") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Agent application not found.");
    if (app.status === "approved") throw new Error("Application is already approved.");

    await ctx.db.patch(args.applicationId, {
      status: "approved",
      reviewedBy: admin.userId as any,
      reviewedAt: Date.now(),
    });

    await ctx.db.patch(app.userId, {
      role: "agent",
    });

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "approve_agent_application",
      target: args.applicationId,
      metadata: { userId: app.userId },
    });
  },
});

export const rejectAgentApplication = mutation({
  args: { applicationId: v.id("agentApplications"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Agent application not found.");
    if (app.status === "rejected") throw new Error("Application is already rejected.");

    await ctx.db.patch(args.applicationId, {
      status: "rejected",
      reviewedBy: admin.userId as any,
      reviewedAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "reject_agent_application",
      target: args.applicationId,
      metadata: { userId: app.userId, reason: args.reason },
    });
  },
});

export const listAgents = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const agents = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "agent"))
      .collect();

    const results = [];
    for (const agent of agents) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_user", (q) => q.eq("userId", agent._id))
        .collect();

      const completedOrders = orders.filter((o) => o.status === "completed");
      const totalSpendGhs = completedOrders.reduce((sum, o) => sum + o.amountGhs, 0);

      results.push({
        ...agent,
        totalOrders: completedOrders.length,
        totalSpendGhs,
      });
    }
    return results;
  },
});

export const getAgentStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const agent = await ctx.db.get(args.userId);
    if (!agent) throw new Error("Agent not found.");

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const completedOrders = orders.filter((o) => o.status === "completed");
    const totalSpendGhs = completedOrders.reduce((sum, o) => sum + o.amountGhs, 0);

    return {
      totalOrders: completedOrders.length,
      totalSpendGhs,
      ordersCount: orders.length,
    };
  },
});

export const getAgentApplication = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const app = await ctx.db
      .query("agentApplications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!app) return null;

    let reviewer = null;
    if (app.reviewedBy) {
      reviewer = await ctx.db.get(app.reviewedBy);
    }

    return {
      ...app,
      reviewer: reviewer
        ? {
            displayName: reviewer.displayName,
            email: reviewer.email,
          }
        : null,
    };
  },
});

/* ── Pricing Queries & Mutations ── */

export const listPricingRules = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("pricingRules").collect();
  },
});

export const upsertPricingRule = mutation({
  args: {
    packageId: v.optional(v.string()),
    mode: v.union(v.literal("percentage"), v.literal("fixed")),
    value: v.number(),
    isGlobal: v.boolean(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    let existingRule = null;
    if (args.isGlobal) {
      existingRule = await ctx.db
        .query("pricingRules")
        .filter((q) => q.eq(q.field("isGlobal"), true))
        .first();
    } else if (args.packageId) {
      existingRule = await ctx.db
        .query("pricingRules")
        .withIndex("by_package", (q) => q.eq("packageId", args.packageId))
        .first();
    }

    if (existingRule) {
      await ctx.db.patch(existingRule._id, {
        mode: args.mode,
        value: args.value,
        isActive: args.isActive,
      });
      await ctx.db.insert("auditLogs", {
        actorId: admin.userId as any,
        action: "update_pricing_rule",
        target: existingRule._id,
        metadata: { ...args },
      });
    } else {
      const insertData: any = {
        mode: args.mode,
        value: args.value,
        isGlobal: args.isGlobal,
        isActive: args.isActive,
      };
      if (args.packageId !== undefined) {
        insertData.packageId = args.packageId;
      }
      const newId = await ctx.db.insert("pricingRules", insertData);
      await ctx.db.insert("auditLogs", {
        actorId: admin.userId as any,
        action: "create_pricing_rule",
        target: newId,
        metadata: { ...args },
      });
    }
  },
});

export const deletePricingRule = mutation({
  args: { ruleId: v.id("pricingRules") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Pricing rule not found.");

    await ctx.db.delete(args.ruleId);

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "delete_pricing_rule",
      target: args.ruleId,
      metadata: { rule },
    });
  },
});

export const listDataPackagesWithPricing = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const packages = await ctx.db.query("dataPackages").collect();
    const rules = await ctx.db.query("pricingRules").collect();

    const globalRule = rules.find((r) => r.isGlobal && r.isActive);

    return packages.map((pkg) => {
      const rule = rules.find((r) => r.packageId === pkg._id && r.isActive) ?? globalRule;

      let computedPriceGhs = pkg.customerPriceGhs;
      if (rule) {
        computedPriceGhs =
          rule.mode === "percentage"
            ? pkg.providerCostGhs * (1 + rule.value / 100)
            : pkg.providerCostGhs + rule.value;
      }

      return {
        ...pkg,
        computedPriceGhs,
        activeRule: rule
          ? {
              _id: rule._id,
              mode: rule.mode,
              value: rule.value,
              isGlobal: rule.isGlobal,
            }
          : null,
      };
    });
  },
});

/* ── Announcement Queries & Mutations ── */

export const createAnnouncement = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    audience: v.union(v.literal("all"), v.literal("users"), v.literal("agents")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const announcementId = await ctx.db.insert("announcements", {
      title: args.title,
      body: args.body,
      audience: args.audience,
      sentAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "create_announcement",
      target: announcementId,
      metadata: { title: args.title, audience: args.audience },
    });

    return announcementId;
  },
});

export const listAnnouncements = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("announcements").order("desc").collect();
  },
});

export const getAnnouncement = query({
  args: { announcementId: v.id("announcements") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.announcementId);
  },
});

export const deleteAnnouncement = mutation({
  args: { announcementId: v.id("announcements") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const announcement = await ctx.db.get(args.announcementId);
    if (!announcement) throw new Error("Announcement not found.");

    await ctx.db.delete(args.announcementId);

    await ctx.db.insert("auditLogs", {
      actorId: admin.userId as any,
      action: "delete_announcement",
      target: args.announcementId,
      metadata: { title: announcement.title },
    });
  },
});

export const getAudienceEmails = query({
  args: { audience: v.union(v.literal("all"), v.literal("users"), v.literal("agents")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let usersQuery = ctx.db.query("users");
    if (args.audience === "agents") {
      usersQuery = usersQuery.filter((q) => q.eq(q.field("role"), "agent"));
    } else if (args.audience === "users") {
      usersQuery = usersQuery.filter((q) => q.eq(q.field("role"), "user"));
    }

    const users = await usersQuery.collect();
    return users
      .map((u) => u.email)
      .filter((email): email is string => !!email);
  },
});

export const getAnnouncementByService = query({
  args: {
    announcementId: v.id("announcements"),
    serviceSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
    return await ctx.db.get(args.announcementId);
  },
});

export const getAudienceEmailsByService = query({
  args: {
    audience: v.union(v.literal("all"), v.literal("users"), v.literal("agents")),
    serviceSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);

    let usersQuery = ctx.db.query("users");
    if (args.audience === "agents") {
      usersQuery = usersQuery.filter((q) => q.eq(q.field("role"), "agent"));
    } else if (args.audience === "users") {
      usersQuery = usersQuery.filter((q) => q.eq(q.field("role"), "user"));
    }

    const users = await usersQuery.collect();
    return users
      .map((u) => u.email)
      .filter((email): email is string => !!email);
  },
});

export const listAuditLogs = query({
  args: {
    actorId: v.optional(v.id("users")),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let query: any = ctx.db.query("auditLogs");

    if (args.actorId) {
      query = query.withIndex("by_actor", (q: any) => q.eq("actorId", args.actorId));
    }

    const logs = await query.order("desc").collect();

    return await Promise.all(
      logs.map(async (log: any) => {
        if (!log.actorId) {
          return { ...log, actor: null };
        }
        const user: any = await ctx.db.get(log.actorId);
        return {
          ...log,
          actor: user
            ? {
                displayName: user.displayName,
                email: user.email,
                role: user.role,
              }
            : null,
        };
      })
    );
  },
});
