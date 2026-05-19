import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    firebaseUid: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    displayName: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("agent"), v.literal("admin")),
    isSuspended: v.boolean(),
    walletBalanceGhs: v.number(),
    deviceFingerprint: v.optional(v.string()),
    firstPurchaseDiscountUsed: v.boolean()
  })
    .index("by_firebase_uid", ["firebaseUid"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  savedNumbers: defineTable({
    userId: v.id("users"),
    label: v.string(),
    phone: v.string(),
    network: v.optional(v.union(v.literal("mtn"), v.literal("telecel"), v.literal("airteltigo")))
  }).index("by_user", ["userId"]),

  dataPackages: defineTable({
    vendorId: v.string(),
    vendorPackageId: v.string(),
    network: v.union(v.literal("mtn"), v.literal("telecel"), v.literal("airteltigo")),
    name: v.string(),
    sizeMb: v.number(),
    providerCostGhs: v.number(),
    customerPriceGhs: v.number(),
    isAvailable: v.boolean(),
    providerUpdatedAt: v.number(),
    vendorRaw: v.optional(v.any())
  })
    .index("by_vendor_package_id", ["vendorId", "vendorPackageId"])
    .index("by_network", ["network"]),

  orders: defineTable({
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
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("verified"),
      v.literal("failed"),
      v.literal("refunded")
    ),
    paystackReference: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("refunded")
    ),
    idempotencyKey: v.string(),
    recipientConfirmedAt: v.number()
  })
    .index("by_reference", ["reference"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_user", ["userId"])
    .index("by_paystack_reference", ["paystackReference"])
    .index("by_vendor_order_reference", ["vendorId", "vendorOrderReference"])
    .index("by_status", ["status"]),

  walletTransactions: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("top_up"),
      v.literal("purchase"),
      v.literal("refund"),
      v.literal("admin_credit"),
      v.literal("admin_debit")
    ),
    amountGhs: v.number(),
    reference: v.string(),
    notes: v.optional(v.string())
  }).index("by_user", ["userId"]),

  pricingRules: defineTable({
    packageId: v.optional(v.string()),
    mode: v.union(v.literal("percentage"), v.literal("fixed")),
    value: v.number(),
    isGlobal: v.boolean(),
    isActive: v.boolean()
  }).index("by_package", ["packageId"]),

  platformConfig: defineTable({
    key: v.string(),
    value: v.union(v.string(), v.number(), v.boolean())
  }).index("by_key", ["key"]),

  agentApplications: defineTable({
    userId: v.id("users"),
    paymentReference: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number())
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  announcements: defineTable({
    title: v.string(),
    body: v.string(),
    audience: v.union(v.literal("all"), v.literal("users"), v.literal("agents")),
    sentAt: v.optional(v.number())
  }).index("by_audience", ["audience"]),

  auditLogs: defineTable({
    actorId: v.optional(v.id("users")),
    action: v.string(),
    target: v.string(),
    metadata: v.optional(v.any())
  }).index("by_actor", ["actorId"])
});
