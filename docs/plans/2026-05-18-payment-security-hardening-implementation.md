# Payment Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the Paystack payment foundation with authentication boundaries, safer provider verification, payment config defaults, production telemetry, ops alerts, and retry metadata.

**Architecture:** The Fastify API owns Firebase auth checks, Paystack secrets, Honeycomb/OpenTelemetry setup, and external side effects. Convex owns durable payment, config, alert, retry, wallet, order, and agent application state. Client apps never provide trusted payment ownership, final amounts, or completion status.

**Tech Stack:** TypeScript, Fastify, Convex, Firebase Admin integration, Paystack REST API, OpenTelemetry/Honeycomb, Node crypto HMAC helpers, pnpm workspaces.

---

### Task 1: Tighten Shared Payment Contracts

**Files:**
- Modify: `packages/contracts/src/payments.ts`
- Modify: `packages/contracts/src/pricing.ts`

**Steps:**
1. Remove client-required `customerEmail` from payment intent request contracts.
2. Remove or deprecate client-provided `userId` for wallet top-up and agent application request bodies.
3. Add optional authenticated-user request shape only where needed for TypeScript compatibility, but document that the API derives ownership from Firebase auth.
4. Add `maximumWalletTopUpGhs` and `paymentIntentExpirySeconds` to pricing/config contracts.
5. Run `pnpm --filter @betterdata/contracts typecheck`.
6. Commit with `feat: tighten payment contracts`.

---

### Task 2: Add API Auth and Email Resolution

**Files:**
- Modify: `apps/api/src/integrations/firebase/auth.ts`
- Create: `apps/api/src/modules/auth/requestUser.ts`
- Modify: `apps/api/src/modules/payments/payments.routes.ts`

**Steps:**
1. Add a helper to read `Authorization: Bearer <token>`.
2. Verify Firebase token through the existing Firebase Admin integration.
3. Resolve authenticated user email from Firebase token claims when present.
4. Generate placeholder Paystack emails for guests and auth users without email.
5. Require auth for wallet top-up and agent application payments.
6. Allow unauthenticated guest data purchase.
7. Do not trust client `userId` or `customerEmail`.
8. Run `pnpm --filter @betterdata/api typecheck`.
9. Commit with `feat: enforce payment auth boundaries`.

---

### Task 3: Use Paystack Secret for Webhook Signatures

**Files:**
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Steps:**
1. Change webhook verification to use `PAYSTACK_SECRET_KEY`.
2. Remove `PAYSTACK_WEBHOOK_SECRET` from `.env.example` or mark it deprecated if compatibility is needed.
3. Update docs to say Paystack webhooks are signed with the Paystack secret key.
4. Run `pnpm --filter @betterdata/api test`.
5. Commit with `fix: verify paystack webhooks with secret key`.

---

### Task 4: Store Integer Amounts and Optional Provider Payer Phone

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/payments.ts`
- Modify: `apps/api/src/integrations/paystack/client.ts`

**Steps:**
1. Add `baseAmountPesewas`, `providerAmountPesewas`, and optional `paystackPayerPhone` fields to payment intents.
2. Keep GHS fields temporarily for compatibility if needed, but compare integer pesewas for verification.
3. Parse optional payer phone from Paystack verification response only if returned.
4. Store sanitized provider fields only.
5. Run `pnpm typecheck`.
6. Commit with `feat: store payment amounts in pesewas`.

---

### Task 5: Add Config Defaults and Bounds

**Files:**
- Modify: `convex/platformConfig.ts`
- Modify: `convex/payments.ts`
- Modify: `packages/contracts/src/pricing.ts`

**Steps:**
1. Add config keys: `maximumWalletTopUpGhs`, `paymentIntentExpirySeconds`.
2. Make `minimumWalletTopUpGhs` default to `10` when missing.
3. Make `maximumWalletTopUpGhs` default to `500` when missing.
4. Make `paymentIntentExpirySeconds` default to `1800` when missing.
5. Keep `agentOnboardingFeeGhs` fail-closed when missing.
6. Keep discount configs as `0` when missing.
7. Enforce wallet top-up min and max in payment preparation.
8. Run `pnpm typecheck`.
9. Commit with `feat: add payment config defaults and bounds`.

---

### Task 6: Add Ops Alert Schema and Helpers

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/opsAlerts.ts`
- Modify: `packages/contracts/src/payments.ts`

**Steps:**
1. Add `opsAlerts` table with severity, status, category, reference, message, sanitized metadata, retry fields, and timestamps.
2. Add Convex mutations to create, acknowledge, resolve, and escalate alerts.
3. Add retry metadata types in contracts if useful for admin UI.
4. Run `pnpm typecheck`.
5. Commit with `feat: add ops alerts for payments`.

---

### Task 7: Create Alerts from Payment Failures

**Files:**
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: `convex/payments.ts`

**Steps:**
1. Create alerts for invalid signatures, unknown references, amount/currency mismatch, Paystack verification failure, and timeout mismatch diagnostics.
2. Create alerts when verified payment completion fails.
3. Create alerts when vendor fulfillment fails after successful payment.
4. Ensure alert metadata is sanitized and contains no raw provider payloads.
5. Run `pnpm --filter @betterdata/api test`.
6. Run `pnpm typecheck`.
7. Commit with `feat: create payment ops alerts`.

---

### Task 8: Add Retry Metadata and Scheduling Hooks

**Files:**
- Modify: `convex/opsAlerts.ts`
- Modify: `convex/payments.ts`
- Modify: `apps/api/src/modules/payments/payments.routes.ts`

**Steps:**
1. Add retry schedules for data fulfillment and internal completion failures.
2. Store `retryable`, `retryAction`, `retryStatus`, `retryCount`, `lastRetriedAt`, and `nextRetryAt`.
3. For this pass, create durable retry metadata and idempotent retry endpoints/hooks.
4. Keep actual background worker execution as a follow-up if Convex deployment codegen/runtime is unavailable locally.
5. Run `pnpm typecheck`.
6. Commit with `feat: add payment retry metadata`.

---

### Task 9: Add Telemetry Helpers

**Files:**
- Create: `apps/api/src/telemetry/hash.ts`
- Create: `apps/api/src/telemetry/paymentTelemetry.ts`
- Create: `apps/api/src/telemetry/setup.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/package.json`
- Modify: `.env.example`

**Steps:**
1. Add OpenTelemetry/Honeycomb dependencies.
2. Enable telemetry only when `NODE_ENV !== "development"` and `HONEYCOMB_API_KEY` is present.
3. Require `TELEMETRY_HASH_SECRET` when telemetry is enabled.
4. Add HMAC SHA-256 hash helper for user and phone correlation.
5. Add payment telemetry event helper that drops raw PII and secrets.
6. Initialize telemetry before Fastify starts.
7. Run `pnpm install`.
8. Run `pnpm --filter @betterdata/api typecheck`.
9. Commit with `feat: add payment telemetry`.

---

### Task 10: Wire Telemetry Events

**Files:**
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: `apps/api/src/integrations/paystack/client.ts`

**Steps:**
1. Emit telemetry for payment intent creation, webhook received, signature failure, verification success/failure, completion success/failure, and fulfillment success/failure.
2. Include only references, statuses, amounts, purpose, vendor IDs, and keyed hashes.
3. Run `pnpm --filter @betterdata/api test`.
4. Run `pnpm typecheck`.
5. Commit with `feat: emit payment telemetry`.

---

### Task 11: Update Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/plans/2026-05-18-payment-security-hardening-design.md`

**Steps:**
1. Document auth rules for guest vs authenticated payment flows.
2. Document Paystack secret-key webhook verification.
3. Document Honeycomb env vars and no raw PII policy.
4. Document Cloudflare R2 as a future encrypted raw payload archive option.
5. Document retry and ops alert behavior.
6. Run `pnpm typecheck`.
7. Commit with `docs: document payment hardening setup`.

---

### Task 12: Final Verification

**Files:**
- Review all changed files.

**Steps:**
1. Run `pnpm test`.
2. Run `pnpm typecheck`.
3. Run `pnpm build` with required public env if needed.
4. Run `pnpm convex:codegen` if `CONVEX_DEPLOYMENT` is available; otherwise document the blocker.
5. Confirm `git status --short` is clean.
