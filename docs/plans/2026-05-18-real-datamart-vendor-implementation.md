# Real DataMart Vendor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fake DataMart transport with real DataMart API calls, including smart switching between single purchase and bulk purchase under burst traffic or low rate-limit headroom.

**Architecture:** Keep the existing `DataVendor` interface stable. Add a real DataMart HTTP transport, then route `createDataMartVendor().purchase()` through a dispatcher that can call `/purchase` immediately or queue and flush `/bulk-purchase` batches. Sandbox vendors remain registered for explicit dev/test use, but `datamart` becomes the real live vendor.

**Tech Stack:** TypeScript, Fastify, Node `fetch`, `crypto.randomUUID`, existing `@betterdata/contracts` vendor types, focused `tsx` check files.

---

### Task 1: Add DataMart Runtime Config

**Files:**
- Create: `apps/api/src/vendors/datamart/config.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: Write the failing config check**

Create `apps/api/src/vendors/datamart/config.check.ts` with assertions for:

```ts
import assert from "node:assert/strict";
import { resolveDataMartConfig } from "./config";

const config = resolveDataMartConfig({
  DATAMART_API_KEY: "test-key"
});

assert.equal(config.baseUrl, "https://api.datamartgh.shop/api/developer");
assert.equal(config.apiKey, "test-key");
assert.equal(config.purchaseBatchWindowMs, 5000);
assert.equal(config.purchaseBurstWindowMs, 30000);
assert.equal(config.purchaseBurstThreshold, 20);
assert.equal(config.lowRateLimitRemainingThreshold, 20);
```

**Step 2: Run it to verify it fails**

Run: `pnpm --filter @betterdata/api exec tsx src/vendors/datamart/config.check.ts`

Expected: FAIL because `config.ts` does not exist.

**Step 3: Implement config**

Create `apps/api/src/vendors/datamart/config.ts`:

```ts
export type DataMartConfig = {
  baseUrl: string;
  apiKey: string;
  requestTimeoutMs: number;
  retryCount: number;
  purchaseBatchWindowMs: number;
  purchaseBurstWindowMs: number;
  purchaseBurstThreshold: number;
  lowRateLimitRemainingThreshold: number;
};

const DEFAULT_BASE_URL = "https://api.datamartgh.shop/api/developer";

export function resolveDataMartConfig(
  env: NodeJS.ProcessEnv = process.env
): DataMartConfig {
  const apiKey = env.DATAMART_API_KEY;

  if (!apiKey) {
    throw new Error("DATAMART_API_KEY is required when datamart is active.");
  }

  return {
    baseUrl: trimTrailingSlash(env.DATAMART_BASE_URL ?? DEFAULT_BASE_URL),
    apiKey,
    requestTimeoutMs: readPositiveInt(env.DATAMART_REQUEST_TIMEOUT_MS, 15000),
    retryCount: readPositiveInt(env.DATAMART_RETRY_COUNT, 1),
    purchaseBatchWindowMs: readPositiveInt(
      env.DATAMART_PURCHASE_BATCH_WINDOW_MS,
      5000
    ),
    purchaseBurstWindowMs: readPositiveInt(
      env.DATAMART_PURCHASE_BURST_WINDOW_MS,
      30000
    ),
    purchaseBurstThreshold: readPositiveInt(
      env.DATAMART_PURCHASE_BURST_THRESHOLD,
      20
    ),
    lowRateLimitRemainingThreshold: readPositiveInt(
      env.DATAMART_LOW_RATE_LIMIT_REMAINING_THRESHOLD,
      20
    )
  };
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
```

**Step 4: Update docs/env**

In `.env.example`, keep `BETTERDATA_ACTIVE_DATA_VENDOR=sandbox-fast` for local safety, but document live values:

```env
# Set to datamart in staging/production when DATAMART_API_KEY is configured.
BETTERDATA_ACTIVE_DATA_VENDOR=sandbox-fast
DATAMART_BASE_URL=https://api.datamartgh.shop/api/developer
DATAMART_API_KEY=
DATAMART_PURCHASE_BATCH_WINDOW_MS=5000
DATAMART_PURCHASE_BURST_WINDOW_MS=30000
DATAMART_PURCHASE_BURST_THRESHOLD=20
DATAMART_LOW_RATE_LIMIT_REMAINING_THRESHOLD=20
```

Update `README.md` to say `datamart` is the real DataMart API mode and sandbox vendors are explicit dev modes.

**Step 5: Run checks**

Run:

```bash
pnpm --filter @betterdata/api exec tsx src/vendors/datamart/config.check.ts
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add .env.example README.md apps/api/src/vendors/datamart/config.ts apps/api/src/vendors/datamart/config.check.ts
git commit -m "feat: add datamart runtime config"
```

### Task 2: Add DataMart HTTP Transport

**Files:**
- Create: `apps/api/src/vendors/datamart/transport.ts`
- Create: `apps/api/src/vendors/datamart/transport.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Write transport tests**

Test with an injected fake `fetch`:

- `GET /data-packages` sends `X-API-Key`.
- `POST /purchase` sends JSON body and `X-Idempotency-Key`.
- `POST /bulk-purchase` sends one batch idempotency key.
- Rate metadata is read from either body `rateLimit` or headers.
- Non-2xx JSON errors throw a typed DataMart error with status and body.

**Step 2: Run tests to verify failure**

Run: `pnpm --filter @betterdata/api exec tsx src/vendors/datamart/transport.check.ts`

Expected: FAIL because transport does not exist.

**Step 3: Implement transport**

Export:

```ts
export type DataMartRateLimit = {
  limit?: number;
  remaining?: number;
  resetInSeconds?: number;
};

export class DataMartHttpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly body: unknown,
    readonly rateLimit?: DataMartRateLimit
  ) {
    super(message);
  }
}

export type DataMartTransport = {
  listPackages(network?: string): Promise<DataMartResponse<unknown>>;
  purchase(input: DataMartPurchaseRequest, idempotencyKey: string): Promise<DataMartResponse<unknown>>;
  bulkPurchase(input: DataMartBulkPurchaseRequest, idempotencyKey: string): Promise<DataMartResponse<unknown>>;
  getOrderStatus(reference: string): Promise<DataMartResponse<unknown>>;
  getBalance(): Promise<DataMartResponse<unknown>>;
  getDeliveryTracker(): Promise<DataMartResponse<unknown>>;
};
```

Use `AbortController` for timeouts. Retry only timeout, network failure, and 5xx responses, and preserve the same idempotency key.

**Step 4: Add the test to API test script**

Change `apps/api/package.json` test script to include:

```json
"test": "tsx src/vendors/datamart/config.check.ts && tsx src/vendors/datamart/transport.check.ts && tsx src/vendors/datamart/mapper.check.ts && tsx src/vendors/simulation/simulation.check.ts"
```

**Step 5: Run checks**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/package.json apps/api/src/vendors/datamart/transport.ts apps/api/src/vendors/datamart/transport.check.ts
git commit -m "feat: add datamart http transport"
```

### Task 3: Extend DataMart Mapping For Bulk Results And Errors

**Files:**
- Modify: `apps/api/src/vendors/datamart/mapper.ts`
- Modify: `apps/api/src/vendors/datamart/mapper.check.ts`

**Step 1: Add failing mapper checks**

Add tests for:

- Bulk result with `ref` maps each order back to a `VendorPurchaseResult`.
- `queued`, `pending`, `waiting`, and `processing` map to `processing`.
- Bulk validation errors are preserved in `raw`.
- Missing order reference throws.

Example:

```ts
const bulk = mapDataMartBulkPurchaseResponse({
  status: "success",
  data: {
    results: [
      {
        ref: "idem-1",
        orderReference: "MY-001",
        status: "queued"
      }
    ],
    validationErrors: []
  }
});

assert.equal(bulk.get("idem-1")?.vendorOrderReference, "MY-001");
assert.equal(bulk.get("idem-1")?.status, "processing");
```

**Step 2: Run mapper checks**

Run: `pnpm --filter @betterdata/api exec tsx src/vendors/datamart/mapper.check.ts`

Expected: FAIL because `mapDataMartBulkPurchaseResponse` does not exist.

**Step 3: Implement mapper changes**

Add:

```ts
export function mapDataMartBulkPurchaseResponse(response: {
  data?: {
    results?: Array<{
      ref?: string;
      orderReference?: string;
      status?: string;
    }>;
    validationErrors?: unknown[];
  };
}) {
  const results = new Map<string, VendorPurchaseResult>();

  for (const item of response.data?.results ?? []) {
    if (!item.ref || !item.orderReference) {
      continue;
    }

    results.set(item.ref, {
      vendorOrderReference: item.orderReference,
      status: mapDataMartStatus(item.status ?? "processing"),
      raw: item
    });
  }

  return results;
}
```

Import `VendorPurchaseResult` from `@betterdata/contracts`.

**Step 4: Run checks**

Run:

```bash
pnpm --filter @betterdata/api exec tsx src/vendors/datamart/mapper.check.ts
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/src/vendors/datamart/mapper.ts apps/api/src/vendors/datamart/mapper.check.ts
git commit -m "feat: map datamart bulk purchase responses"
```

### Task 4: Add Smart Purchase Dispatcher

**Files:**
- Create: `apps/api/src/vendors/datamart/purchaseDispatcher.ts`
- Create: `apps/api/src/vendors/datamart/purchaseDispatcher.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Write dispatcher tests**

Test these behaviors:

- A single low-traffic purchase calls transport `purchase()` immediately.
- A burst above threshold queues and flushes through `bulkPurchase()`.
- A batch flushes immediately at 50 orders.
- Low `rateLimit.remaining` forces queued bulk mode.
- Timeout or 5xx retry reuses the same idempotency key.
- Each queued caller receives the matching result by `ref`.

Use a fake clock abstraction rather than real timers:

```ts
type Scheduler = {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
};
```

**Step 2: Run dispatcher tests**

Run: `pnpm --filter @betterdata/api exec tsx src/vendors/datamart/purchaseDispatcher.check.ts`

Expected: FAIL because dispatcher does not exist.

**Step 3: Implement dispatcher**

Export:

```ts
export function createDataMartPurchaseDispatcher(options: {
  transport: DataMartTransport;
  config: DataMartConfig;
  scheduler?: Scheduler;
}) {
  return {
    purchase(input: VendorPurchaseInput): Promise<VendorPurchaseResult>
  };
}
```

Decision logic:

- Track purchase timestamps inside `purchaseBurstWindowMs`.
- Use immediate `/purchase` when traffic is below threshold and remaining headroom is healthy.
- Otherwise enqueue.
- Flush when queue length reaches 50 or the batch window expires.
- Bulk body order shape:

```ts
{
  phoneNumber: input.recipientPhone,
  network: toDataMartProviderCode(input.network),
  capacity: packageCapacity(input.packageId),
  ref: input.idempotencyKey
}
```

**Step 4: Handle bulk partial failures**

If a bulk response lacks a result for a queued `ref`, reject that caller with a typed error that includes the raw bulk response. Do not silently mark it successful.

**Step 5: Add dispatcher check to test script**

Add `tsx src/vendors/datamart/purchaseDispatcher.check.ts` to `apps/api/package.json`.

**Step 6: Run checks**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add apps/api/package.json apps/api/src/vendors/datamart/purchaseDispatcher.ts apps/api/src/vendors/datamart/purchaseDispatcher.check.ts
git commit -m "feat: add datamart smart purchase dispatcher"
```

### Task 5: Wire Real DataMart Vendor

**Files:**
- Modify: `apps/api/src/vendors/datamart/client.ts`
- Keep: `apps/api/src/vendors/datamart/fakeTransport.ts`

**Step 1: Update client wiring**

Change `createDataMartVendor()` so it:

- Resolves config with `resolveDataMartConfig()`.
- Creates the HTTP transport.
- Creates the purchase dispatcher.
- Uses transport for packages, status, balance, and delivery tracker.
- Uses dispatcher for purchases.

`fakeTransport.ts` can stay for mapper tests or future fixtures, but `datamart` runtime must not import it.

**Step 2: Add missing delivery tracker support**

If `DataVendor.getDeliveryTracker` is currently unused, still wire it through transport and map the documented response to `VendorDeliveryTracker`.

**Step 3: Run checks**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
rg "fakeDataMart" apps/api/src/vendors/datamart/client.ts
```

Expected: tests and typecheck PASS; `rg` returns no fake transport references in `client.ts`.

**Step 4: Commit**

```bash
git add apps/api/src/vendors/datamart/client.ts
git commit -m "feat: wire datamart vendor to real transport"
```

### Task 6: Route-Level Error Handling

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Modify: `apps/api/src/modules/packages/packages.routes.ts`
- Optionally create: `apps/api/src/vendors/errors.ts`

**Step 1: Add route checks or focused helper checks**

If route tests are not practical yet, create a helper check for mapping vendor errors to HTTP status:

- Insufficient vendor balance -> 502 or 409, depending on product decision.
- Invalid package/recipient -> 400.
- Rate limited -> 503 with `Retry-After`.
- Vendor unavailable -> 502.

**Step 2: Implement stable error responses**

Avoid leaking raw DataMart bodies to clients. Log raw error details server-side with `request.log`.

**Step 3: Run checks**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
git add apps/api/src/modules/orders/orders.routes.ts apps/api/src/modules/packages/packages.routes.ts apps/api/src/vendors
git commit -m "fix: map vendor errors to stable api responses"
```

### Task 7: Live Rollout Guardrails

**Files:**
- Modify: `README.md`
- Modify: `docs/datamart_api_docs.md` only if the local docs need corrections from implementation.
- Optionally create: `docs/operations/datamart-rollout.md`

**Step 1: Document rollout**

Add an operations note:

- Local default remains sandbox.
- Staging can set `BETTERDATA_ACTIVE_DATA_VENDOR=datamart`.
- Production must set `DATAMART_API_KEY`.
- Start with conservative batching thresholds.
- Monitor DataMart `rateLimit.remaining` and API 5xx/429 responses.
- Do not retry purchases with a new idempotency key after timeout.

**Step 2: Add manual smoke test commands**

Document:

```bash
pnpm --filter @betterdata/api dev
curl http://localhost:4000/data-packages
curl -X POST http://localhost:4000/orders \
  -H "Content-Type: application/json" \
  -d '{"packageId":"yello-1gb","network":"mtn","recipientPhone":"0551234567","confirmRecipientIsCorrect":true,"paymentMethod":"wallet"}'
```

**Step 3: Run final checks**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
git status --short
```

Expected: tests and typecheck PASS. Only intended docs changes are unstaged before commit.

**Step 4: Commit**

```bash
git add README.md docs
git commit -m "docs: document datamart live rollout"
```

### Task 8: Final Verification

**Files:**
- No new files unless fixes are needed.

**Step 1: Confirm no fake runtime path**

Run:

```bash
rg "fakeDataMart" apps/api/src/vendors/datamart
```

Expected: fake references may exist in `fakeTransport.ts` or tests, but not in `client.ts`.

**Step 2: Confirm sandbox vendors still work**

Run:

```bash
pnpm --filter @betterdata/api exec tsx src/vendors/simulation/simulation.check.ts
```

Expected: PASS.

**Step 3: Confirm full API package checks**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

**Step 4: Final commit if fixes were needed**

```bash
git add .
git commit -m "fix: complete datamart live vendor verification"
```

Skip this commit if no files changed.
