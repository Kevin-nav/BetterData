# Platform Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make payment, data purchase, Redis cache, queue worker, Firebase auth, Infisical secrets, and KEDA deployment work as one production path.

**Architecture:** Convex owns durable app state, Fastify owns private integrations, AMQP owns durable work, Redis owns cache/metrics/short-lived coordination, and KEDA scales workers from zero. Paystack webhooks complete payment state and enqueue fulfillment; workers are the only code path that calls DataMart for purchase fulfillment.

**Tech Stack:** TypeScript, Fastify, Convex, AMQP/LavinMQ/CloudAMQP, Upstash Redis, Firebase Admin/Auth, Kubernetes k3s, KEDA, Infisical, pnpm/Turborepo.

---

### Task 1: Add Queue Injection For Payment Routes

**Files:**
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Test: `apps/api/src/modules/payments/payments.routes.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Write the failing test**

Create `apps/api/src/modules/payments/payments.routes.check.ts` with a focused unit around the helper that will enqueue paid data fulfillment. Keep the test at helper level so it does not need real Paystack or Convex.

```ts
import assert from "node:assert/strict";

import { buildPaidDataPurchaseJob } from "./payments.routes";

const job = buildPaidDataPurchaseJob({
  providerReference: "BDP_data_purchase_123",
  packageId: "pkg_123",
  vendorPackageId: "dm_123",
  network: "mtn",
  recipientPhone: "0551234567",
  vendorId: "datamart"
});

assert.equal(job.kind, "purchase");
assert.equal(job.orderReference, "BDP_data_purchase_123");
assert.equal(job.idempotencyKey, "BDP_data_purchase_123");
assert.equal(job.packageId, "dm_123");
assert.equal(job.paymentMethod, "paystack_momo");
assert.equal(job.attempt, 0);
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @betterdata/api exec tsx src/modules/payments/payments.routes.check.ts
```

Expected: fail because `buildPaidDataPurchaseJob` is not exported.

**Step 3: Write minimal implementation**

In `apps/api/src/modules/payments/payments.routes.ts`, import queue types:

```ts
import { createQueueProvider, QUEUE_NAMES, type PurchaseJob, type QueueProvider } from "../../queue";
```

Change route registration to accept injected dependencies:

```ts
export async function registerPaymentRoutes(
  server: FastifyInstance,
  options: { queue?: QueueProvider } = {}
) {
  const queue = options.queue ?? await createQueueProvider();
```

Export helper:

```ts
export function buildPaidDataPurchaseJob(input: {
  providerReference: string;
  packageId: string;
  vendorPackageId?: string;
  network: PurchaseJob["network"];
  recipientPhone: string;
  vendorId: string;
}): PurchaseJob {
  return {
    kind: "purchase",
    orderReference: input.providerReference,
    packageId: input.vendorPackageId ?? input.packageId,
    network: input.network,
    recipientPhone: input.recipientPhone,
    paymentMethod: "paystack_momo",
    vendorId: input.vendorId,
    idempotencyKey: input.providerReference,
    attempt: 0,
    createdAt: new Date().toISOString()
  };
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @betterdata/api exec tsx src/modules/payments/payments.routes.check.ts
```

Expected: pass.

**Step 5: Add test to package script**

Modify `apps/api/package.json` and append:

```json
"&& tsx src/modules/payments/payments.routes.check.ts"
```

to the `test` command.

**Step 6: Run API tests**

Run:

```bash
pnpm --filter @betterdata/api test
```

Expected: pass.

**Step 7: Commit**

```bash
git add apps/api/src/modules/payments/payments.routes.ts apps/api/src/modules/payments/payments.routes.check.ts apps/api/package.json
git commit -m "test: cover paid purchase queue job builder"
```

### Task 2: Enqueue Paid Fulfillment Instead Of Calling DataMart In Webhook

**Files:**
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Test: `apps/api/src/modules/payments/payments.routes.check.ts`

**Step 1: Write the failing test**

Extend `payments.routes.check.ts` with a test for metadata extraction:

```ts
import { buildPaidDataPurchaseJobFromIntent } from "./payments.routes";

const jobFromIntent = buildPaidDataPurchaseJobFromIntent("BDP_ref", {
  purpose: "data_purchase",
  providerReference: "BDP_ref",
  purposeMetadata: {
    packageId: "pkg_123",
    vendorPackageId: "dm_123",
    network: "mtn",
    recipientPhone: "0551234567",
    vendorId: "datamart"
  }
});

assert.equal(jobFromIntent.vendorId, "datamart");
assert.equal(jobFromIntent.packageId, "dm_123");
```

Expected failure: helper missing.

**Step 2: Implement helper**

Export:

```ts
export function buildPaidDataPurchaseJobFromIntent(
  providerReference: string,
  intent: PaymentIntentRecord
) {
  if (intent.purpose !== "data_purchase") {
    return null;
  }

  const metadata = asRecord(intent.purposeMetadata);
  const packageId = metadata.packageId;
  const vendorPackageId = metadata.vendorPackageId;
  const vendorId = metadata.vendorId;
  const network = metadata.network;
  const recipientPhone = metadata.recipientPhone;

  if (
    typeof packageId !== "string" ||
    typeof vendorId !== "string" ||
    !isNetworkCode(network) ||
    typeof recipientPhone !== "string"
  ) {
    throw new Error("Paid data purchase metadata is invalid for queued fulfillment.");
  }

  return buildPaidDataPurchaseJob({
    providerReference,
    packageId,
    ...(typeof vendorPackageId === "string" ? { vendorPackageId } : {}),
    vendorId,
    network,
    recipientPhone
  });
}
```

**Step 3: Replace direct fulfillment call**

In the Paystack success branch, replace:

```ts
await fulfillPaidDataPurchase(convex, reference);
```

with:

```ts
await enqueuePaidDataPurchaseFulfillment(convex, queue, reference);
```

Add:

```ts
async function enqueuePaidDataPurchaseFulfillment(
  convex: ConvexHttpClient,
  queue: QueueProvider,
  providerReference: string
) {
  const intent = (await convex.query(paymentFunctions.getByProviderReference, {
    ...serviceArgs(),
    providerReference
  })) as PaymentIntentRecord | null;

  if (intent === null) {
    throw new Error("Payment intent not found for queued fulfillment.");
  }

  const job = buildPaidDataPurchaseJobFromIntent(providerReference, intent);

  if (job === null) {
    return;
  }

  await queue.enqueue(QUEUE_NAMES.purchaseRequested, job);
}
```

Keep `fulfillPaidDataPurchase` only for retry actions until Task 3 replaces that path.

**Step 4: Run tests**

```bash
pnpm --filter @betterdata/api test
```

Expected: pass.

**Step 5: Commit**

```bash
git add apps/api/src/modules/payments/payments.routes.ts apps/api/src/modules/payments/payments.routes.check.ts
git commit -m "feat: queue paid data fulfillment from paystack webhook"
```

### Task 3: Move Payment Retry Fulfillment To Queue

**Files:**
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Test: `apps/api/src/modules/payments/payments.routes.check.ts`

**Step 1: Write failing test**

Add a test that `buildPaidDataPurchaseJobFromIntent` returns `null` for wallet top-up:

```ts
assert.equal(
  buildPaidDataPurchaseJobFromIntent("BDP_wallet", {
    purpose: "wallet_top_up",
    providerReference: "BDP_wallet",
    purposeMetadata: {}
  }),
  null
);
```

Expected: pass after Task 2, but it locks behavior before retry changes.

**Step 2: Route retry fulfillment through queue**

Change retry processing so `verify_payment` calls `verifyAndCompletePayment(convex, queue, reference)`.

Update function signature:

```ts
async function verifyAndCompletePayment(
  convex: ConvexHttpClient,
  queue: QueueProvider,
  reference: string
) {
```

Replace its direct `await fulfillPaidDataPurchase(convex, reference);` with:

```ts
await enqueuePaidDataPurchaseFulfillment(convex, queue, reference);
```

Update `creditWalletHandler` and `completeAgentApplicationHandler` to accept and pass `queue` even though they will no-op for non-data purchase intents.

**Step 3: Remove direct vendor fulfillment from payments route**

Delete `fulfillPaidDataPurchase` from `payments.routes.ts` once no code calls it. Remove unused `getActiveDataVendor` import.

**Step 4: Run tests**

```bash
pnpm --filter @betterdata/api test
```

Expected: pass.

**Step 5: Commit**

```bash
git add apps/api/src/modules/payments/payments.routes.ts apps/api/src/modules/payments/payments.routes.check.ts
git commit -m "refactor: route payment retries through purchase queue"
```

### Task 4: Make Purchase Worker Idempotent For Paystack References

**Files:**
- Modify: `apps/api/src/workers/purchaseWorker.ts`
- Test: `apps/api/src/workers/purchaseWorker.check.ts`
- Modify: `apps/api/src/orders/orderStore.ts`
- Modify: `convex/orders.ts`

**Step 1: Write failing test**

In `purchaseWorker.check.ts`, add a case where the order already has `vendorOrderReference`. The worker should `ack` and skip vendor purchase.

```ts
// Use the existing fake OrderStore pattern in this file.
// Existing order has vendorOrderReference: "DM-123".
// Assert vendor.purchase call count stays 0 and message.ack was called.
```

Expected: fail because worker always calls vendor.

**Step 2: Extend OrderStore contract**

`OrderStore` already has `getByReference`. Use it in `processPurchaseMessage` before vendor call:

```ts
const existing = await options.orderStore.getByReference(job.orderReference);

if (existing?.vendorOrderReference !== undefined) {
  await message.ack();
  return;
}
```

**Step 3: Ensure Convex reads by payment reference work**

For Paystack orders, order `reference` is the Paystack reference after `completeDataPurchase`, so the existing `getByReferenceForApi` path is enough.

If implementation discovers a mismatch, modify `convex/orders.ts` to also query `by_paystack_reference` when `by_reference` misses.

**Step 4: Run worker checks**

```bash
pnpm --filter @betterdata/api exec tsx src/workers/purchaseWorker.check.ts
```

Expected: pass.

**Step 5: Run API tests**

```bash
pnpm --filter @betterdata/api test
```

Expected: pass.

**Step 6: Commit**

```bash
git add apps/api/src/workers/purchaseWorker.ts apps/api/src/workers/purchaseWorker.check.ts apps/api/src/orders/orderStore.ts convex/orders.ts
git commit -m "fix: make purchase worker idempotent"
```

### Task 5: Add Redis Single-Flight Cache Helpers

**Files:**
- Modify: `apps/api/src/redis/upstash.ts`
- Test: `apps/api/src/redis/upstash.check.ts`

**Step 1: Write failing tests**

Add tests for lock commands using the fake fetch style already in `upstash.check.ts`:

```ts
// acquireLock("datamart:packages:refresh", "owner", 30) sends SET key owner NX EX 30.
// releaseLock("datamart:packages:refresh", "owner") deletes only when value matches owner.
```

Expected: fail because methods do not exist.

**Step 2: Extend interface**

Add to `UpstashRedisClient`:

```ts
acquireLock(key: string, owner: string, ttlSeconds: number): Promise<boolean>;
releaseLock(key: string, owner: string): Promise<void>;
```

**Step 3: Implement lock methods**

```ts
async acquireLock(name, owner, ttlSeconds) {
  const result = await command<string | null>([
    "SET",
    key(name),
    owner,
    "NX",
    "EX",
    String(ttlSeconds)
  ]);

  return result === "OK";
},

async releaseLock(name, owner) {
  const current = await command<string | null>(["GET", key(name)]);

  if (current === owner) {
    await command(["DEL", key(name)]);
  }
}
```

**Step 4: Run Redis checks**

```bash
pnpm --filter @betterdata/api exec tsx src/redis/upstash.check.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add apps/api/src/redis/upstash.ts apps/api/src/redis/upstash.check.ts
git commit -m "feat: add redis single flight locks"
```

### Task 6: Prevent Public Package Browsing From Stampeding DataMart

**Files:**
- Modify: `apps/api/src/vendors/datamart/cache.ts`
- Test: `apps/api/src/vendors/datamart/cache.check.ts`
- Modify: `apps/api/src/modules/packages/packages.routes.ts`

**Step 1: Write failing cache test**

In `cache.check.ts`, add a test for a `getOrRefreshPackages` helper:

```ts
// When packages are cached, refresh callback is not called.
// When cache is missing and lock is acquired, callback is called once and value is cached.
// When cache is missing and lock is not acquired, helper returns null or stale fallback.
```

Expected: fail because helper does not exist.

**Step 2: Add cache helper**

In `datamart/cache.ts`, add:

```ts
getOrRefreshPackages(refresh: () => Promise<VendorPackage[]>): Promise<VendorPackage[] | null>;
```

Implement it with:

- Read `getPackages`.
- If hit, return hit.
- Acquire Redis lock `datamart:packages:refresh`.
- If lock fails, return current cache/fallback as `null`.
- If lock succeeds, call refresh, set packages, release lock.

For the noop cache, `getOrRefreshPackages` should call refresh in non-production only or return `null` in production depending on existing behavior. Prefer keeping route-level fallback simple.

**Step 3: Update package route behavior**

In `packages.routes.ts`, keep public reads cheap:

```ts
const packages = await vendor.listPackages();
```

should use the vendor's DataMart cache path if already wrapped. If active vendor does not expose cache control, do not add a direct DataMart refresh on every request. Instead, ensure DataMart client cache is used by its existing `listPackages`.

If a fallback to Convex curated packages is not available yet, document it as Task 7 rather than hand-rolling partial storage here.

**Step 4: Run tests**

```bash
pnpm --filter @betterdata/api exec tsx src/vendors/datamart/cache.check.ts
pnpm --filter @betterdata/api test
```

Expected: pass.

**Step 5: Commit**

```bash
git add apps/api/src/vendors/datamart/cache.ts apps/api/src/vendors/datamart/cache.check.ts apps/api/src/modules/packages/packages.routes.ts
git commit -m "feat: protect datamart package cache refreshes"
```

### Task 7: Add Convex Package Fallback Read Path

**Files:**
- Modify: `convex/packages.ts`
- Modify: `packages/app-api/src/index.ts`
- Modify: `apps/api/src/modules/packages/packages.routes.ts`
- Test: `apps/api/src/modules/packages/packages.routes.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Write failing API test**

Create `packages.routes.check.ts` around a pure mapper/fallback helper:

```ts
// Given vendor fetch failure and Convex fallback packages,
// public route response uses fallback and marks source: "fallback".
```

Expected: fail because helper does not exist.

**Step 2: Add Convex service query if missing**

In `convex/packages.ts`, add a service query:

```ts
export const listAvailableForApi = query({
  args: { serviceSecret: v.string() },
  handler: async (ctx, args) => {
    requireServiceSecret(args.serviceSecret);
    return await ctx.db
      .query("dataPackages")
      .filter((q) => q.eq(q.field("isAvailable"), true))
      .collect();
  }
});
```

**Step 3: Export app API reference**

Update `packages/app-api/src/index.ts` to export `packageFunctions.listAvailableForApi`.

**Step 4: Use fallback in route**

In `packages.routes.ts`, on vendor package failure:

- Query Convex fallback using `CONVEX_URL` and `BETTERDATA_SERVICE_SECRET`.
- Return fallback packages with `source: "fallback"` if available.
- Only return vendor error if fallback is unavailable.

**Step 5: Run tests and codegen if possible**

```bash
pnpm convex:codegen
pnpm --filter @betterdata/api test
```

Expected: pass. If codegen cannot run because `CONVEX_DEPLOYMENT` is not configured locally, document that in the commit message body.

**Step 6: Commit**

```bash
git add convex/packages.ts packages/app-api/src/index.ts apps/api/src/modules/packages/packages.routes.ts apps/api/src/modules/packages/packages.routes.check.ts apps/api/package.json convex/_generated
git commit -m "feat: serve package fallback from convex"
```

### Task 8: Add Firebase Client Login Skeleton

**Files:**
- Create: `apps/web/lib/firebase.ts`
- Create: `apps/web/lib/auth.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/package.json`
- Modify: `.env.example`

**Step 1: Add dependency**

Run:

```bash
pnpm --filter @betterdata/web add firebase
```

Expected: package and lockfile update.

**Step 2: Create Firebase client**

Create `apps/web/lib/firebase.ts`:

```ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const app = getApps()[0] ?? initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});

export const firebaseAuth = getAuth(app);
```

**Step 3: Create auth provider**

Create a client component `apps/web/lib/auth.tsx` exposing current user and `getIdToken`.

**Step 4: Wrap layout**

Modify `apps/web/app/layout.tsx` to include `AuthProvider`.

**Step 5: Verify**

```bash
pnpm --filter @betterdata/web typecheck
pnpm --filter @betterdata/web build
```

Expected: pass.

**Step 6: Commit**

```bash
git add apps/web/lib/firebase.ts apps/web/lib/auth.tsx apps/web/app/layout.tsx apps/web/package.json pnpm-lock.yaml .env.example
git commit -m "feat: add firebase web auth foundation"
```

### Task 9: Enforce API Auth Policy Consistently

**Files:**
- Modify: `apps/api/src/modules/wallet/wallet.routes.ts`
- Modify: `apps/api/src/modules/admin/admin.routes.ts`
- Modify: `apps/api/src/auth/adminAuth.ts`
- Test: `apps/api/src/auth/adminAuth.check.ts`
- Test: existing route checks where available

**Step 1: Review current auth checks**

Run:

```bash
rg -n "ADMIN_API_KEY|requireRequestUser|getOptionalRequestUser|authorization|X-Admin" apps/api/src
```

Expected: identify routes still using static browser-exposed admin API key or missing bearer-token checks.

**Step 2: Add tests**

Extend `adminAuth.check.ts` to assert:

- Missing auth rejects.
- Non-admin Firebase/Convex user rejects.
- Admin role accepts.
- Static admin API key is service-only and not used by browser flows.

**Step 3: Implement route policy**

Use `requireRequestUser` for user routes and Convex role/admin checks for admin routes. Keep `ADMIN_API_KEY` only for server-to-server fallback if still needed.

**Step 4: Run tests**

```bash
pnpm --filter @betterdata/api test
```

Expected: pass.

**Step 5: Commit**

```bash
git add apps/api/src/modules/wallet/wallet.routes.ts apps/api/src/modules/admin/admin.routes.ts apps/api/src/auth/adminAuth.ts apps/api/src/auth/adminAuth.check.ts
git commit -m "fix: enforce firebase api auth policy"
```

### Task 10: Add API And Worker Kubernetes Manifests

**Files:**
- Create: `deploy/k8s/base/api-deployment.yaml`
- Create: `deploy/k8s/base/api-service.yaml`
- Create: `deploy/k8s/base/worker-deployment.yaml`
- Modify: `deploy/k8s/base/kustomization.yaml`
- Modify: `Dockerfile.web` or create `Dockerfile.api` if API image does not exist

**Step 1: Add API image build strategy**

Prefer creating `Dockerfile.api` if current `Dockerfile.web` is web-specific.

**Step 2: Add manifests**

API deployment:

- `replicas: 1`
- command starts `pnpm --filter @betterdata/api start` or built `node apps/api/dist/index.js`
- env from `betterdata-api-env`
- readiness `/health`
- service on port `4000`

Worker deployment:

- `replicas: 0`
- command starts worker
- env from `betterdata-api-env`
- no public service

**Step 3: Validate manifests**

```bash
kubectl kustomize deploy/k8s/base
```

Expected: rendered YAML includes web, cloudflared, api, worker.

**Step 4: Commit**

```bash
git add deploy/k8s/base Dockerfile.api
git commit -m "feat: add api and worker k8s manifests"
```

### Task 11: Add KEDA Worker ScaleObject

**Files:**
- Create: `deploy/k8s/base/worker-scaledobject.yaml`
- Modify: `deploy/k8s/base/kustomization.yaml`
- Modify: `docs/operations/production-smoke-tests.md`

**Step 1: Add ScaledObject**

Use AMQP queue trigger for `orders.purchase.requested`:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: betterdata-worker
  namespace: betterdata
spec:
  scaleTargetRef:
    name: betterdata-worker
  minReplicaCount: 0
  maxReplicaCount: 5
  triggers:
    - type: rabbitmq
      metadata:
        queueName: orders.purchase.requested
        mode: QueueLength
        value: "1"
      authenticationRef:
        name: betterdata-worker-amqp-auth
```

Add matching TriggerAuthentication using `CLOUDAMQP_URL` from Kubernetes secret.

**Step 2: Validate manifests**

```bash
kubectl kustomize deploy/k8s/base
```

Expected: includes ScaledObject and TriggerAuthentication.

**Step 3: Update smoke docs**

Document:

```bash
kubectl -n betterdata get scaledobject
kubectl -n betterdata get hpa
```

**Step 4: Commit**

```bash
git add deploy/k8s/base/worker-scaledobject.yaml deploy/k8s/base/kustomization.yaml docs/operations/production-smoke-tests.md
git commit -m "feat: scale worker with keda"
```

### Task 12: Integrate Infisical Runtime Secret Sync

**Files:**
- Modify: `.github/workflows/deploy-web.yml`
- Create or modify: `.github/workflows/deploy-platform.yml`
- Modify: `docs/operations/production-smoke-tests.md`
- Modify: `.env.example`

**Step 1: Decide sync mechanism**

Use one of:

- Infisical CLI in deploy workflow to create Kubernetes secrets.
- Infisical Kubernetes operator.

Start with CLI if the VPS self-hosted runner already owns `kubectl`.

**Step 2: Add GitHub bootstrap secrets**

Document required GitHub secrets:

- `INFISICAL_CLIENT_ID`
- `INFISICAL_CLIENT_SECRET`
- `INFISICAL_PROJECT_ID`
- `INFISICAL_ENVIRONMENT`

**Step 3: Sync runtime secret**

Deploy workflow should create `betterdata-api-env` from Infisical values, including:

- `CONVEX_URL`
- `CONVEX_API_SECRET`
- `BETTERDATA_SERVICE_SECRET`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `DATAMART_API_KEY`
- `CLOUDAMQP_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`
- telemetry secrets

**Step 4: Verify deploy dry run**

Run workflow manually in staging environment first.

Expected: Kubernetes secret exists and API pod starts without missing env errors.

**Step 5: Commit**

```bash
git add .github/workflows docs/operations/production-smoke-tests.md .env.example
git commit -m "ci: sync runtime secrets from infisical"
```

### Task 13: Add Production Smoke Coverage For Unified Flow

**Files:**
- Modify: `docs/operations/production-smoke-tests.md`
- Modify: `docs/operations/datamart-rollout.md`

**Step 1: Update smoke tests**

Add sections for:

- Paystack webhook creates order then queue job.
- Worker scales from zero after queue depth appears.
- Worker drains queue and writes vendor reference.
- Public package visit uses cache/fallback and does not force DataMart refresh.
- Checkout path can do stricter freshness.
- Firebase protected endpoint rejects missing token.
- Admin endpoint rejects non-admin token.

**Step 2: Add expected operational dashboards**

Document queue names, KEDA status, Redis metrics, and Convex tables to check.

**Step 3: Commit**

```bash
git add docs/operations/production-smoke-tests.md docs/operations/datamart-rollout.md
git commit -m "docs: update production integration smoke tests"
```

### Task 14: Final Verification

**Files:**
- All touched files

**Step 1: Run full repo checks**

```bash
pnpm lint
pnpm typecheck
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/web build
kubectl kustomize deploy/k8s/base
```

Expected: all pass.

**Step 2: Inspect diffs**

```bash
git status --short
git log --oneline -n 12
```

Expected: clean working tree after commits, recent commits match task boundaries.

**Step 3: Document remaining deployment-only blockers**

If `pnpm convex:codegen`, Infisical CLI, or `kubectl` cannot run locally, add the exact blocker and command to the final handoff.
