# Production Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden Better Data for real DataMart production purchases behind `api.betterdatagh.com`, with strict security, persisted order state, LavinMQ-backed purchase jobs, admin operations, payment safety, and observability.

**Architecture:** Keep Fastify as the integration API and Convex as the app state boundary. Public routes validate and persist intent, then durable LavinMQ workers perform vendor side effects. Admin tools read from the same state and expose only authenticated operational actions.

**Tech Stack:** Fastify, Next.js, Convex, Firebase auth, CloudAMQP LavinMQ over AMQP 0-9-1, TypeScript, existing `@betterdata/api-client` and `@betterdata/contracts`.

---

### Task 1: Lock Down CORS And Dev Routes

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/modules/dev/vendor-simulation.routes.ts`
- Create: `apps/api/src/config/origins.ts`
- Create: `apps/api/src/config/origins.check.ts`
- Modify: `apps/api/package.json`
- Modify: `.env.example`

**Steps:**

1. Add `PUBLIC_APP_URL`, `PUBLIC_ADMIN_URL`, and optional `LOCAL_ALLOWED_ORIGINS` parsing in `origins.ts`.
2. In production, allow only `https://betterdatagh.com` and `https://admin.betterdatagh.com`.
3. Outside production, allow configured localhost origins.
4. Replace `cors({ origin: true })` with the explicit origin function.
5. Disable `registerVendorSimulationRoutes` in production unless `ENABLE_DEV_VENDOR_ROUTES=true`.
6. Add checks for production and local origin behavior.
7. Run `pnpm --filter @betterdata/api test` and `pnpm --filter @betterdata/api typecheck`.
8. Commit: `fix: restrict api cors and dev routes`.

### Task 2: Add Runtime Request Validation

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Create: `apps/api/src/modules/orders/orderValidation.ts`
- Create: `apps/api/src/modules/orders/orderValidation.check.ts`
- Modify: `apps/api/package.json`

**Steps:**

1. Add runtime validation for `packageId`, `network`, `recipientPhone`, `confirmRecipientIsCorrect`, and `paymentMethod`.
2. Normalize Ghana phone numbers consistently before vendor dispatch.
3. Reject malformed requests with stable `400` responses.
4. Add checks for valid MTN/Telecel/AirtelTigo numbers, bad networks, missing confirmation, bad payment method, and malformed package IDs.
5. Run API tests and typecheck.
6. Commit: `fix: validate order creation requests`.

### Task 3: Add API Auth Boundary

**Files:**
- Create: `apps/api/src/auth/firebase.ts`
- Create: `apps/api/src/auth/adminAuth.ts`
- Modify: `apps/api/src/modules/admin/admin.routes.ts`
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Modify: `.env.example`

**Steps:**

1. Add Firebase Admin verification for bearer tokens.
2. Add `requireAdmin` middleware/helper.
3. Protect `/admin/*`.
4. Decide whether order creation remains guest-capable; if yes, keep `/orders` public but still rate-limited and payment-gated later.
5. Protect sensitive status/admin actions by role where applicable.
6. Add tests/checks for missing token, invalid token, non-admin user, and admin user.
7. Run API tests and typecheck.
8. Commit: `feat: protect admin api routes`.

### Task 4: Add Inbound Rate Limiting

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/src/config/rateLimits.ts`

**Steps:**

1. Add `@fastify/rate-limit`.
2. Configure stricter limits for `POST /orders`.
3. Configure status polling limits for `GET /orders/:reference/status`.
4. Configure admin and webhook limits.
5. Ensure rate-limit responses do not leak internals.
6. Run API tests and typecheck.
7. Commit: `fix: add inbound api rate limits`.

### Task 5: Persist Internal Orders Before Vendor Work

**Files:**
- Modify: `convex/orders.ts`
- Modify: `convex/schema.ts`
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Create: `apps/api/src/orders/orderStore.ts`
- Create: `apps/api/src/orders/orderStore.check.ts`

**Steps:**

1. Ensure order schema has internal reference, payment state, vendor fields, idempotency key, and status.
2. Add indexes for internal reference, idempotency key, and vendor reference.
3. Add API order store boundary for create/update/read operations.
4. Change `POST /orders` to create an internal order before vendor dispatch.
5. Return internal order reference to the client.
6. Keep vendor fields empty until worker execution.
7. Run Convex/codegen if needed, API tests, and typecheck.
8. Commit: `feat: persist orders before vendor dispatch`.

### Task 6: Add Queue Contracts And Local Provider

**Files:**
- Create: `apps/api/src/queue/types.ts`
- Create: `apps/api/src/queue/localQueue.ts`
- Create: `apps/api/src/queue/index.ts`
- Create: `apps/api/src/queue/queue.check.ts`
- Modify: `apps/api/package.json`

**Steps:**

1. Define `PurchaseJob`, `StatusRefreshJob`, queue names, retry metadata, and dead-letter metadata.
2. Add an in-memory local provider for development and tests.
3. Add enqueue and consume APIs that are independent of LavinMQ.
4. Add checks for enqueue, consume, ack, retry, and dead-letter behavior.
5. Run API tests and typecheck.
6. Commit: `feat: add queue abstraction`.

### Task 7: Add LavinMQ Provider

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/queue/amqpQueue.ts`
- Create: `apps/api/src/queue/amqpConfig.ts`
- Modify: `.env.example`
- Modify: `docs/operations/datamart-rollout.md`

**Steps:**

1. Add an AMQP client dependency.
2. Read `CLOUDAMQP_URL`.
3. Declare durable queues:
   - `orders.purchase.requested`
   - `orders.purchase.retry`
   - `orders.purchase.dead`
   - `orders.status.refresh`
4. Configure dead-letter routing and delayed retry strategy supported by LavinMQ/AMQP.
5. Keep the queue provider selected by env, with local fallback in development.
6. Add connection failure logging and startup health behavior.
7. Run API tests and typecheck.
8. Commit: `feat: add lavinmq queue provider`.

### Task 8: Move DataMart Purchases Into Worker

**Files:**
- Create: `apps/api/src/workers/purchaseWorker.ts`
- Create: `apps/api/src/workers/statusWorker.ts`
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Modify: `apps/api/src/index.ts` or create a separate worker entrypoint `apps/api/src/worker.ts`
- Modify: `apps/api/package.json`

**Steps:**

1. Change `POST /orders` to enqueue a purchase job after creating an internal order.
2. Add purchase worker that consumes jobs and calls the existing DataMart dispatcher.
3. Worker updates order status, vendor reference, and raw vendor response.
4. On retryable vendor errors, publish retry with same idempotency key.
5. On exhausted retries, publish dead-letter and mark order for admin review or failed.
6. Add a status worker for processing orders that need reconciliation.
7. Run tests and typecheck.
8. Commit: `feat: process vendor purchases with queue worker`.

### Task 9: Verify Vendor Webhooks

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Create: `apps/api/src/vendors/webhookVerification.ts`
- Create: `apps/api/src/vendors/webhookVerification.check.ts`
- Modify: `.env.example`

**Steps:**

1. If DataMart supports signature verification, implement that scheme.
2. If not, require `X-BetterData-Webhook-Secret` or a secret query/path token.
3. Reject missing/invalid webhook credentials with `401`.
4. Store webhook events and update matching orders by vendor reference.
5. Add replay protection if DataMart sends timestamps or event IDs.
6. Run API tests and typecheck.
7. Commit: `fix: verify data vendor webhooks`.

### Task 10: Add Admin Operations Views

**Files:**
- Modify: `packages/api-client/src/index.ts`
- Modify: `apps/admin/app/page.tsx`
- Create: `apps/admin/app/orders/page.tsx`
- Create: `apps/admin/app/orders/actions.ts`
- Modify: `apps/admin/app/globals.css`
- Add API routes under `apps/api/src/modules/admin`

**Steps:**

1. Add admin endpoints for order list, order detail, manual status refresh, and failed/dead-letter counts.
2. Add API client methods for those endpoints.
3. Build admin order list with filters for status.
4. Add stuck processing and failed order sections.
5. Add manual reconcile action with audit logging.
6. Keep pages server-rendered and protected by admin auth.
7. Run admin build, admin typecheck, API tests, and API typecheck.
8. Commit: `feat: add admin order operations`.

### Task 11: Complete Payment Safety

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Modify: `apps/api/src/integrations/paystack/client.ts`
- Add payment verification modules and checks.
- Modify Convex payment/order schema as needed.

**Steps:**

1. Require verified Paystack payment before queueing guest vendor purchase.
2. Reserve or debit wallet before queueing wallet purchase.
3. Enforce one vendor purchase per paid order.
4. Add refund/manual review path for paid orders with vendor failure.
5. Store payment references and verification raw responses.
6. Run tests and typecheck.
7. Commit: `feat: enforce payment safety before vendor purchase`.

### Task 12: Add Observability And Alerts

**Files:**
- Create: `apps/api/src/observability/logFields.ts`
- Create: `apps/api/src/observability/metrics.ts`
- Modify worker, order, webhook, and admin modules.
- Modify: `docs/operations/datamart-rollout.md`

**Steps:**

1. Standardize log fields for order/vendor/queue events.
2. Add queue depth and dead-letter counters to admin overview.
3. Add DataMart balance and rate-limit fields to logs.
4. Add low/critical balance alert cooldown.
5. Add webhook failure and reconciliation lag counters.
6. Run tests and typecheck.
7. Commit: `feat: add order pipeline observability`.

### Task 13: Production Smoke Test Checklist

**Files:**
- Create: `docs/operations/production-smoke-tests.md`

**Steps:**

1. Document environment variables for the three production domains.
2. Document CORS verification.
3. Document admin auth verification.
4. Document DataMart package/balance checks.
5. Document single purchase staging test.
6. Document bulk purchase staging test.
7. Document webhook test.
8. Document queue retry/dead-letter test.
9. Commit: `docs: add production smoke test checklist`.
