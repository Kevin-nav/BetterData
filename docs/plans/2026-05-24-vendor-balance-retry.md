# Vendor Balance Retry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add DataMart balance history, retry paid data purchases blocked by low vendor balance for up to one hour, and wallet-credit registered users when the retry window expires.

**Architecture:** Convex stores vendor balance snapshots and order retry/refund state. The API records balance snapshots from admin refreshes and DataMart purchase/list/balance responses. Existing payment retry alerts drive low-balance fulfillment retries so we do not add a new scheduler.

**Tech Stack:** Convex, Fastify API, RabbitMQ queue, existing payment retry cron, Next.js admin dashboard.

---

### Task 1: Add Convex Balance Snapshot Storage

**Files:**
- Modify: `convex/schema.ts`
- Create or modify: `convex/vendorBalances.ts`

**Steps:**
1. Add `vendorBalanceSnapshots` table with `vendorId`, `balanceGhs`, `source`, `createdAt`, optional `metadata`.
2. Add indexes by vendor/time.
3. Add service mutations/queries:
   - `recordForApi`
   - `listRecentForApi`
4. Run `pnpm exec convex dev --once`.

### Task 2: Record Balance Snapshots from API

**Files:**
- Create: `apps/api/src/vendors/vendorBalanceSnapshots.ts`
- Modify: `apps/api/src/modules/admin/admin.routes.ts`
- Modify: `apps/api/src/vendors/datamart/client.ts`
- Modify relevant DataMart mapper/transport only if raw balance exists in responses.

**Steps:**
1. Write a helper that records vendor balance snapshots through Convex with service auth.
2. Record snapshots when admin/vendor balance is refreshed.
3. If DataMart purchase/status/list responses include balance in raw payloads, extract and record it with source `purchase_response`.
4. Make failures non-blocking.
5. Add focused API tests if extraction logic is added.

### Task 3: Expose Balance History to Admin

**Files:**
- Modify: `convex/admin.ts`
- Modify: `apps/admin/app/(dashboard)/page.tsx`
- Create or modify chart component under `apps/admin/app/components/`.

**Steps:**
1. Extend admin revenue/overview query data with recent vendor balance snapshots.
2. Add a compact balance-over-time chart near the existing vendor balance card.
3. Keep the chart empty-state friendly when history is sparse.
4. Run admin typecheck/build if env allows.

### Task 4: Add Low-Balance Retry State and Refund Timeout

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/orders.ts`
- Modify: `convex/wallet.ts` or payment functions if wallet credit helper exists.
- Modify: `apps/api/src/workers/purchaseWorker.ts`
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: `apps/api/src/modules/payments/retryPolicy.ts`

**Steps:**
1. Add order fields for low-balance retry deadline and refund marker if needed.
2. Detect low vendor balance before/around purchase attempts.
3. Create queued retry alert with one-hour expiry when balance is insufficient.
4. On retry timeout:
   - registered user: credit wallet once and mark order `refunded`;
   - guest: mark failed and create ops alert.
5. Ensure retries use new vendor idempotency keys and never re-charge Paystack.

### Task 5: Tests and Production Recovery

**Files:**
- Modify: existing `*.check.ts` files for workers/payments/admin.

**Steps:**
1. Add tests for low-balance retry queueing.
2. Add tests for one-hour timeout and idempotent wallet credit.
3. Add tests for guest timeout ops alert path.
4. Run:
   - `pnpm --filter @betterdata/api typecheck`
   - `pnpm --filter @betterdata/api test`
   - `pnpm exec convex dev --once`
5. Deploy Convex and push to GitHub.
6. Queue/retry `bd-data-purchase-47a21761fcec47cd9dc8c765c7337297` through the new path if still unresolved.
