import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    firebaseUid: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    displayName: v.optional(v.string()),
    role: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("admin"),
      v.literal("superadmin")
    ),
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
    costGhsAtPurchase: v.optional(v.number()),
    markupGhsAtPurchase: v.optional(v.number()),
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
    recipientConfirmedAt: v.number(),
    balanceRetryStartedAt: v.optional(v.number()),
    balanceRetryDeadlineAt: v.optional(v.number()),
    walletRefundedAt: v.optional(v.number()),
    refundReference: v.optional(v.string())
  })
    .index("by_reference", ["reference"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_user", ["userId"])
    .index("by_paystack_reference", ["paystackReference"])
    .index("by_vendor_order_reference", ["vendorId", "vendorOrderReference"])
    .index("by_payment_status", ["paymentStatus"])
    .index("by_status", ["status"]),

  paymentIntents: defineTable({
    provider: v.literal("paystack"),
    purpose: v.union(
      v.literal("data_purchase"),
      v.literal("wallet_top_up"),
      v.literal("agent_application_fee")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("initialized"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("abandoned")
    ),
    userId: v.optional(v.id("users")),
    guestContactPhone: v.optional(v.string()),
    amountGhs: v.number(),
    baseAmountPesewas: v.optional(v.number()),
    providerAmountPesewas: v.optional(v.number()),
    currency: v.literal("GHS"),
    providerReference: v.string(),
    providerAccessCode: v.optional(v.string()),
    providerAuthorizationUrl: v.optional(v.string()),
    paystackPayerPhone: v.optional(v.string()),
    purposeMetadata: v.any(),
    failureReason: v.optional(v.string()),
    initializedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_provider_reference", ["provider", "providerReference"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  paymentEvents: defineTable({
    provider: v.literal("paystack"),
    providerReference: v.string(),
    eventType: v.string(),
    payload: v.any(),
    receivedAt: v.number()
  })
    .index("by_provider_reference", ["provider", "providerReference"])
    .index("by_event_type", ["eventType"]),

  opsAlerts: defineTable({
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
    status: v.union(v.literal("open"), v.literal("acknowledged"), v.literal("resolved")),
    category: v.union(
      v.literal("payment"),
      v.literal("webhook"),
      v.literal("fulfillment"),
      v.literal("config"),
      v.literal("security")
    ),
    reference: v.optional(v.string()),
    message: v.string(),
    metadata: v.optional(v.any()),
    retryable: v.boolean(),
    retryAction: v.optional(
      v.union(
        v.literal("verify_payment"),
        v.literal("fulfill_order"),
        v.literal("credit_wallet"),
        v.literal("complete_agent_application")
      )
    ),
    retryStatus: v.optional(
      v.union(
        v.literal("not_started"),
        v.literal("queued"),
        v.literal("running"),
        v.literal("succeeded"),
        v.literal("failed")
      )
    ),
    retryCount: v.number(),
    lastRetriedAt: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number())
  })
    .index("by_status", ["status"])
    .index("by_reference", ["reference"])
    .index("by_retry", ["retryStatus", "nextRetryAt"]),

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
  })
    .index("by_user", ["userId"])
    .index("by_reference", ["reference"]),

  vendorBalanceSnapshots: defineTable({
    vendorId: v.string(),
    balanceGhs: v.number(),
    source: v.union(
      v.literal("admin_refresh"),
      v.literal("balance_endpoint"),
      v.literal("purchase_response"),
      v.literal("retry_check"),
      v.literal("manual"),
      v.literal("unknown")
    ),
    metadata: v.optional(v.any()),
    createdAt: v.number()
  })
    .index("by_vendor_time", ["vendorId", "createdAt"])
    .index("by_source_time", ["source", "createdAt"]),

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
  }).index("by_actor", ["actorId"]),

  notifications: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    type: v.union(
      v.literal("order_status"),
      v.literal("wallet_update"),
      v.literal("announcement"),
      v.literal("agent_update"),
      v.literal("account_alert")
    ),
    referenceId: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
    readAt: v.optional(v.number()),
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "readAt"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_dedupe", ["userId", "dedupeKey"]),

  announcementNotificationStates: defineTable({
    userId: v.id("users"),
    announcementId: v.id("announcements"),
    readAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_announcement", ["userId", "announcementId"])
});
