# Honeycomb OpenTelemetry Upgrades Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add safer, end-to-end Honeycomb/OpenTelemetry tracing for payment, queue, worker, vendor, and notification flows without leaking PII, secrets, raw provider payloads, auth material, or weakening payment security.

**Architecture:** Keep the Fastify API as the only boundary that knows Paystack, Firebase Admin, Resend, DataMart, and Honeycomb secrets. Propagate only standard W3C trace context (`traceparent`, optional `tracestate`) through Convex payment intents and internal queue jobs, then restore that context before webhook completion and worker processing. Add auto-instrumentation only after a tested telemetry sanitizer is in place, and keep business/domain attributes explicit, low-risk, and PII-safe.

**Tech Stack:** TypeScript, Fastify, Convex, LavinMQ/RabbitMQ through `amqplib`, OpenTelemetry JS SDK, Honeycomb OTLP/HTTP exporter, Paystack, DataMart, Resend, pnpm workspaces.

---

## Non-Negotiable Security Rules

These rules apply to every task in this plan. If a later step conflicts with one of these rules, stop and fix the plan before coding.

1. Do not send raw PII to Honeycomb: no email addresses, phone numbers, names, auth UIDs, Firebase tokens, Paystack customer objects, full provider payloads, webhook raw bodies, or request/response bodies.
2. Do not send secrets to Honeycomb: no `authorization`, `x-paystack-signature`, `x-betterdata-service-secret`, `x-admin-api-key`, `x-api-key`, `PAYSTACK_SECRET_KEY`, `DATAMART_API_KEY`, `HONEYCOMB_API_KEY`, `TELEMETRY_HASH_SECRET`, access codes, tokens, cookies, or passwords.
3. Do not enable generic HTTP header capture. OpenTelemetry HTTP instrumentation supports header capture, but this app must leave it disabled unless a future change adds an explicit allowlist with tests.
4. Do not use OpenTelemetry baggage for customer, order, phone, email, payment, or vendor data. Baggage can propagate to third-party vendors.
5. Do not trust webhook-provided trace context. Paystack webhooks must still pass the existing signature verification and transaction verification before state changes. Restore trace context only from the internally stored payment intent.
6. Do not change payment idempotency behavior. Queue retries must keep the same logical order reference and DataMart idempotency key unless a retry flow already explicitly overrides it.
7. Do not store raw provider payloads in Honeycomb. Existing Convex sanitizers are the boundary for durable provider facts; Honeycomb gets only curated attributes.
8. Do not monkey-patch `exporter.export` by assigning a wrapper that calls `exporter.export(...)` again. That causes recursion. Use a wrapper exporter or span processor with tests.
9. Observability must never fail payment or fulfillment flows. Telemetry helpers must catch and swallow telemetry-only errors after tests prove security behavior.
10. Every new telemetry attribute must be classified as `safe`, `hashed`, or `blocked` in this plan or in code comments near the allowlist.

## Source Context

Important current files:

- `apps/api/src/telemetry/setup.ts` initializes the OpenTelemetry SDK and Honeycomb exporter.
- `apps/api/src/telemetry/appTelemetry.ts` emits manual app spans and hashes `userId` / `recipientPhone`.
- `apps/api/src/telemetry/paymentTelemetry.ts` emits manual payment spans and currently allows raw `errorMessage`.
- `apps/api/src/telemetry/hash.ts` uses `TELEMETRY_HASH_SECRET`.
- `apps/api/src/queue/types.ts` defines `PurchaseJob`, `StatusRefreshJob`, `QueueJob`, and `QueueMessage`.
- `apps/api/src/queue/amqpQueue.ts` publishes and consumes durable AMQP jobs.
- `apps/api/src/queue/localQueue.ts` is the in-memory queue used by tests and local workflows.
- `apps/api/src/modules/payments/payments.routes.ts` creates payment intents, handles Paystack webhooks, completes payments, and enqueues paid data purchases.
- `convex/schema.ts` defines `paymentIntents`, `orders`, and `vendorBalanceSnapshots`.
- `convex/payments.ts` creates and completes payment intents and sanitizes provider payloads.
- `apps/api/src/workers/purchaseWorker.ts` fulfills purchases, emits fulfillment telemetry, and records vendor balance snapshots.
- `apps/api/src/workers/statusWorker.ts` refreshes processing orders.
- `apps/api/src/vendors/vendorBalance.ts` records durable vendor balance snapshots in Convex.
- `scripts/ops/bootstrap-honeycomb-alerts.mjs` provisions Honeycomb triggers.

Official docs checked on 2026-05-30:

- Honeycomb's OpenTelemetry Node.js guide recommends OpenTelemetry SDK setup plus automatic instrumentation and supports OTLP/HTTP export: https://docs.honeycomb.io/send-data/javascript-nodejs/opentelemetry-sdk
- OpenTelemetry JS docs describe individual instrumentation libraries and the `auto-instrumentations-node` bundle; use individual packages here to keep behavior explicit: https://opentelemetry.io/docs/languages/js/libraries/
- OpenTelemetry JS propagation docs show manual `propagation.inject(context.active(), carrier)` and `propagation.extract(...)` for non-HTTP transports: https://opentelemetry.io/docs/languages/js/propagation/
- OpenTelemetry HTTP instrumentation docs confirm header capture is opt-in through `headersToSpanAttributes`; leave this disabled: https://open-telemetry.github.io/opentelemetry-js/modules/_opentelemetry_instrumentation-http.html

## Attribute Policy

Allowed as raw Honeycomb attributes:

- References and IDs generated by BetterData or vendors when they are not PII: `payment.reference`, `order.reference`, `vendor.id`, `vendor.order_reference`, `package.id`, `queue.name`, `app.version`, `git.commit`.
- Non-sensitive enums: `payment.provider`, `payment.purpose`, `payment.status`, `payment.channel`, `network`, `fulfillment.status`, `vendor.error_category`.
- Numbers and booleans: `payment.amount_ghs`, `payment.amount_pesewas`, `payment.reconciliation_duration_seconds`, `vendor.response_time_ms`, `vendor.status_code`, `vendor.balance_ghs`, `package.size_mb`, `order.profit_margin_ghs`, `queue.attempts_count`, `error.is_retryable`.

Allowed only as keyed hashes through `hashForTelemetry()`:

- `userId`, Firebase UID, recipient phone, payer phone, guest contact phone, email.

Blocked from Honeycomb entirely:

- Raw phones, emails, customer names, auth headers, cookies, Firebase tokens, Paystack signatures, DataMart API keys, service secrets, admin API keys, Paystack access codes, Paystack authorization URLs, raw webhook bodies, raw provider payloads, request/response bodies.

## Implementation Approach

Use direct OpenTelemetry packages instead of the broad `@opentelemetry/auto-instrumentations-node` bundle. The broad bundle is convenient, but explicit instrumentation makes it easier to prove that no unsafe headers, bodies, filesystem calls, or unexpected libraries are captured.

Use a preload file for auto-instrumentation. The current `apps/api/src/index.ts` imports Fastify and route modules before `setupTelemetry()` runs, so some monkey-patched instrumentation can be too late. The implementation is only complete when API and worker startup paths initialize telemetry before Fastify, Undici/fetch, and amqplib are imported.

## Task 1: Add Telemetry Sanitizer and Security Tests

**Files:**

- Create: `apps/api/src/telemetry/sanitize.ts`
- Create: `apps/api/src/telemetry/sanitize.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Write the failing sanitizer test**

Create `apps/api/src/telemetry/sanitize.check.ts`:

```ts
import assert from "node:assert/strict";

import {
  sanitizeTelemetryAttributes,
  sanitizeTelemetryCarrier,
  sanitizeTelemetryError
} from "./sanitize";

const attributes = sanitizeTelemetryAttributes({
  "payment.reference": "BDP_data_purchase_123",
  "payment.amount_ghs": 20,
  "recipientPhone": "0551234567",
  "customer.email": "person@example.com",
  "http.request.header.authorization": "Bearer secret",
  "http.request.header.x-paystack-signature": "signature",
  "providerPayload": { customer: { email: "person@example.com" } },
  "user.hash": "abc123",
  "vendor.balance_ghs": 100
});

assert.equal(attributes["payment.reference"], "BDP_data_purchase_123");
assert.equal(attributes["payment.amount_ghs"], 20);
assert.equal(attributes["user.hash"], "abc123");
assert.equal(attributes["vendor.balance_ghs"], 100);
assert.equal("recipientPhone" in attributes, false);
assert.equal("customer.email" in attributes, false);
assert.equal("http.request.header.authorization" in attributes, false);
assert.equal("http.request.header.x-paystack-signature" in attributes, false);
assert.equal("providerPayload" in attributes, false);

assert.deepEqual(
  sanitizeTelemetryCarrier({
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    tracestate: "vendor=value",
    baggage: "user.email=person@example.com",
    authorization: "Bearer secret"
  }),
  {
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    tracestate: "vendor=value"
  }
);

assert.equal(
  sanitizeTelemetryCarrier({
    traceparent: "bad",
    tracestate: "vendor=value"
  }),
  undefined
);

const error = sanitizeTelemetryError(
  new Error("Paystack body included phone 0551234567 and email person@example.com")
);
assert.equal(error["error.class"], "Error");
assert.equal(error["error.message"], undefined);
```

**Step 2: Add the check to the API test script**

Modify `apps/api/package.json` and insert `tsx src/telemetry/sanitize.check.ts &&` before `tsx src/modules/payments/payments.routes.check.ts`.

**Step 3: Run the failing test**

Run:

```bash
pnpm --filter @betterdata/api test
```

Expected: fail because `./sanitize` does not exist.

**Step 4: Implement the sanitizer**

Create `apps/api/src/telemetry/sanitize.ts`:

```ts
export type TelemetryAttributeValue = string | number | boolean;

export type TelemetryContextCarrier = {
  traceparent: string;
  tracestate?: string;
};

const sensitiveKeyFragments = [
  "authorization",
  "api_key",
  "apikey",
  "access_code",
  "authorization_url",
  "cookie",
  "customer",
  "email",
  "mobile",
  "password",
  "paystack-signature",
  "phone",
  "providerpayload",
  "raw",
  "rawbody",
  "secret",
  "signature",
  "token"
];

const allowedSensitiveSuffixes = [".hash"];

const traceparentPattern =
  /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

export function sanitizeTelemetryAttributes(
  attributes: Record<string, unknown>
): Record<string, TelemetryAttributeValue> {
  const sanitized: Record<string, TelemetryAttributeValue> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (!isSafeTelemetryKey(key) || !isTelemetryAttributeValue(value)) {
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export function sanitizeTelemetryError(error: unknown) {
  if (error instanceof Error) {
    return {
      "error.class": error.name || "Error"
    };
  }

  return {
    "error.class": typeof error
  };
}

export function sanitizeTelemetryCarrier(
  input: unknown
): TelemetryContextCarrier | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const traceparent = record.traceparent;
  const tracestate = record.tracestate;

  if (typeof traceparent !== "string" || !traceparentPattern.test(traceparent)) {
    return undefined;
  }

  if (
    tracestate !== undefined &&
    (typeof tracestate !== "string" || tracestate.length > 512)
  ) {
    return { traceparent };
  }

  return tracestate === undefined ? { traceparent } : { traceparent, tracestate };
}

export function isSafeTelemetryKey(key: string) {
  const normalized = key.toLowerCase().replace(/[-\s]/g, "_");

  if (allowedSensitiveSuffixes.some((suffix) => normalized.endsWith(suffix))) {
    return true;
  }

  return !sensitiveKeyFragments.some((fragment) => normalized.includes(fragment));
}

function isTelemetryAttributeValue(value: unknown): value is TelemetryAttributeValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}
```

**Step 5: Run the test**

Run:

```bash
pnpm --filter @betterdata/api test
```

Expected: pass.

**Step 6: Commit**

```bash
git add apps/api/package.json apps/api/src/telemetry/sanitize.ts apps/api/src/telemetry/sanitize.check.ts
git commit -m "test: add telemetry sanitization guardrails"
```

## Task 2: Apply Sanitizer to Manual Telemetry Helpers

**Files:**

- Modify: `apps/api/src/telemetry/appTelemetry.ts`
- Modify: `apps/api/src/telemetry/paymentTelemetry.ts`
- Create: `apps/api/src/telemetry/manualTelemetry.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Write the failing helper test**

Create `apps/api/src/telemetry/manualTelemetry.check.ts`.

The test should monkey-patch a local fake span through helper-level pure functions, not the global OpenTelemetry SDK. If helper functions are not exported yet, first write the test against the names that should exist:

```ts
import assert from "node:assert/strict";

import { buildAppTelemetryAttributes } from "./appTelemetry";
import { buildPaymentTelemetryAttributes } from "./paymentTelemetry";

const appAttrs = buildAppTelemetryAttributes({
  name: "test",
  attributes: {
    "order.reference": "BD-1",
    "customer.email": "person@example.com",
    "http.request.header.authorization": "Bearer secret"
  },
  userId: "user-1",
  recipientPhone: "0551234567",
  error: new Error("raw phone 0551234567")
});

assert.equal(appAttrs["order.reference"], "BD-1");
assert.equal(typeof appAttrs["user.hash"], "string");
assert.equal(typeof appAttrs["recipient_phone.hash"], "string");
assert.equal("customer.email" in appAttrs, false);
assert.equal("http.request.header.authorization" in appAttrs, false);
assert.equal(appAttrs["error.class"], "Error");
assert.equal("error.message" in appAttrs, false);

const paymentAttrs = buildPaymentTelemetryAttributes({
  name: "payment.test",
  paymentReference: "BDP-1",
  payerPhone: "0559999999",
  errorMessage: "raw phone 0559999999"
});

assert.equal(paymentAttrs["payment.reference"], "BDP-1");
assert.equal(typeof paymentAttrs["payer_phone.hash"], "string");
assert.equal("error.message" in paymentAttrs, false);
```

Before running this test, set a temporary hash secret inside the test if needed:

```ts
process.env.TELEMETRY_HASH_SECRET ??= "test-telemetry-secret";
```

**Step 2: Add the check to `apps/api/package.json`**

Insert `tsx src/telemetry/manualTelemetry.check.ts &&` after `tsx src/telemetry/sanitize.check.ts &&`.

**Step 3: Run the failing test**

Run:

```bash
pnpm --filter @betterdata/api test
```

Expected: fail because `buildAppTelemetryAttributes` and `buildPaymentTelemetryAttributes` are not exported yet.

**Step 4: Refactor manual telemetry helpers**

In `apps/api/src/telemetry/appTelemetry.ts`:

- Build all attributes in an exported `buildAppTelemetryAttributes(event)` function.
- Run caller-provided `event.attributes` through `sanitizeTelemetryAttributes`.
- Add only hashes for `userId` and `recipientPhone`.
- Add sanitized error fields from `sanitizeTelemetryError`.
- Do not set raw `error.message`.
- Keep the current `try/catch` so telemetry never interrupts app flows.

In `apps/api/src/telemetry/paymentTelemetry.ts`:

- Build all attributes in an exported `buildPaymentTelemetryAttributes(event)` function.
- Hash `userId`, `recipientPhone`, and `payerPhone`.
- Stop exporting raw `errorMessage`.
- Prefer `error.code`, `error.class`, `error.category`, and `error.is_retryable`.
- Wrap `emitPaymentTelemetry` in `try/catch`; it currently does not catch telemetry failures.

**Step 5: Run tests**

Run:

```bash
pnpm --filter @betterdata/api test
```

Expected: pass.

**Step 6: Commit**

```bash
git add apps/api/package.json apps/api/src/telemetry/appTelemetry.ts apps/api/src/telemetry/paymentTelemetry.ts apps/api/src/telemetry/manualTelemetry.check.ts
git commit -m "fix: sanitize manual telemetry attributes"
```

## Task 3: Add Safe Exporter Sanitization

**Files:**

- Create: `apps/api/src/telemetry/sanitizingExporter.ts`
- Create: `apps/api/src/telemetry/sanitizingExporter.check.ts`
- Modify: `apps/api/src/telemetry/setup.ts`
- Modify: `apps/api/package.json`

**Step 1: Add dependency if importing SDK trace base types**

Run:

```bash
pnpm --filter @betterdata/api add @opentelemetry/sdk-trace-base@^1.30.1
```

**Step 2: Write the failing exporter test**

Create `apps/api/src/telemetry/sanitizingExporter.check.ts`:

```ts
import assert from "node:assert/strict";

import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { ExportResultCode } from "@opentelemetry/core";

import { SanitizingSpanExporter } from "./sanitizingExporter";

let exported: ReadableSpan[] = [];
const delegate: SpanExporter = {
  export(spans, callback) {
    exported = spans;
    callback({ code: ExportResultCode.SUCCESS });
  },
  shutdown: async () => {},
  forceFlush: async () => {}
};

const exporter = new SanitizingSpanExporter(delegate);
await new Promise<void>((resolve, reject) => {
  exporter.export(
    [
      {
        attributes: {
          "payment.reference": "BDP-1",
          "http.request.header.authorization": "Bearer secret",
          "customer.email": "person@example.com",
          "vendor.balance_ghs": 100
        }
      } as ReadableSpan
    ],
    (result) => {
      if (result.code === ExportResultCode.SUCCESS) {
        resolve();
      } else {
        reject(new Error("export failed"));
      }
    }
  );
});

assert.equal(exported[0]?.attributes["payment.reference"], "BDP-1");
assert.equal(exported[0]?.attributes["vendor.balance_ghs"], 100);
assert.equal("http.request.header.authorization" in exported[0]!.attributes, false);
assert.equal("customer.email" in exported[0]!.attributes, false);
```

**Step 3: Add the test to `apps/api/package.json`**

Insert `tsx src/telemetry/sanitizingExporter.check.ts &&` after manual telemetry checks.

**Step 4: Run the failing test**

Run:

```bash
pnpm --filter @betterdata/api test
```

Expected: fail because `SanitizingSpanExporter` does not exist.

**Step 5: Implement a wrapper exporter**

Create `apps/api/src/telemetry/sanitizingExporter.ts`.

Implementation notes:

- Implement `SpanExporter`.
- Accept a delegate exporter in the constructor.
- In `export(spans, callback)`, pass shallow-cloned spans to the delegate with sanitized `attributes`.
- Do not mutate the original span objects unless cloning proves impossible with the actual OpenTelemetry types.
- Delegate `shutdown()` and `forceFlush()`.
- Do not call `this.delegate.export` from a monkey-patched method on the same exporter instance.

**Step 6: Wire it into setup**

Modify `apps/api/src/telemetry/setup.ts`:

- Keep `OTLPTraceExporter`.
- Wrap it with `new SanitizingSpanExporter(exporter)`.
- Use `spanProcessors: [new BatchSpanProcessor(new SanitizingSpanExporter(exporter))]` if supported by the installed `NodeSDK` version.
- If this SDK version only supports `traceExporter`, set `traceExporter: new SanitizingSpanExporter(exporter)` and keep a test proving it compiles.

**Step 7: Run tests and typecheck**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: pass.

**Step 8: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/telemetry/setup.ts apps/api/src/telemetry/sanitizingExporter.ts apps/api/src/telemetry/sanitizingExporter.check.ts
git commit -m "fix: sanitize exported telemetry spans"
```

## Task 4: Add Trace Context Helpers

**Files:**

- Create: `apps/api/src/telemetry/context.ts`
- Create: `apps/api/src/telemetry/context.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Write the failing context test**

Create `apps/api/src/telemetry/context.check.ts`:

```ts
import assert from "node:assert/strict";

import { sanitizeTelemetryCarrier } from "./sanitize";

assert.deepEqual(
  sanitizeTelemetryCarrier({
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    tracestate: "vendor=value",
    baggage: "phone=0551234567"
  }),
  {
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    tracestate: "vendor=value"
  }
);
```

Extend this with helper tests after creating the helper:

- `captureTelemetryContext()` returns `undefined` when there is no valid active span context.
- `withTelemetryContext(carrier, fn)` calls `fn` even if carrier is invalid.
- Invalid carriers never throw.

**Step 2: Add to test script**

Insert `tsx src/telemetry/context.check.ts &&` after sanitizer tests.

**Step 3: Implement helpers**

Create `apps/api/src/telemetry/context.ts`:

- `captureTelemetryContext(): TelemetryContextCarrier | undefined`
  - Use `propagation.inject(context.active(), carrier)`.
  - Return `sanitizeTelemetryCarrier(carrier)`.
- `withTelemetryContext<T>(carrier, fn): T`
  - Sanitize carrier.
  - If invalid, call `fn()` normally.
  - If valid, extract into an OpenTelemetry context and run `context.with(extracted, fn)`.
- `startSpanWithTelemetryContext<T>(name, carrier, fn)` may be added only if needed by workers. Prefer `withTelemetryContext` plus existing `trace.startActiveSpan`.

**Step 4: Run tests**

Run:

```bash
pnpm --filter @betterdata/api test
```

Expected: pass.

**Step 5: Commit**

```bash
git add apps/api/package.json apps/api/src/telemetry/context.ts apps/api/src/telemetry/context.check.ts
git commit -m "feat: add safe telemetry context helpers"
```

## Task 5: Store Original Payment Trace Context in Convex

**Files:**

- Modify: `convex/schema.ts`
- Modify: `convex/payments.ts`
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: `apps/api/src/modules/payments/payments.routes.check.ts`

**Step 1: Write failing API route builder test**

Extend `apps/api/src/modules/payments/payments.routes.check.ts` with a test that proves the API can pass sanitized telemetry context through job creation without raw PII:

```ts
const traceContext = {
  traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
  tracestate: "vendor=value"
};

const tracedJob = buildPaidDataPurchaseJob({
  providerReference: "BDP_data_purchase_trace",
  packageId: "pkg_123",
  vendorPackageId: "dm_123",
  network: "mtn",
  recipientPhone: "0551234567",
  vendorId: "datamart",
  telemetryContext: traceContext
});

assert.deepEqual(tracedJob.telemetryContext, traceContext);
```

This will fail until queue types accept `telemetryContext`; that is okay if Task 6 is implemented immediately after this task. If the agent wants strict task isolation, add the queue type first in Task 6 and return to this test.

**Step 2: Update Convex schema**

In `convex/schema.ts`, add to `paymentIntents`:

```ts
telemetryContext: v.optional(
  v.object({
    traceparent: v.string(),
    tracestate: v.optional(v.string())
  })
),
```

Do not add baggage. Do not add user, phone, email, or request metadata to this field.

**Step 3: Update Convex payment mutations**

In `convex/payments.ts`:

- Add the same optional `telemetryContext` validator to `prepareIntent` args.
- Store `telemetryContext` only after validating shape in the API. Convex should still reject clearly invalid objects if possible.
- When `prepareIntent` sees an existing matching intent:
  - If `existing.telemetryContext` is missing and `args.telemetryContext` is present, patch it.
  - Do not overwrite an existing trace context after payment creation; stable original context makes webhook traces deterministic.
- Include `telemetryContext` in `getByProviderReference` service query results automatically through the document return. Do not expose it in `getPublicStatus`.

**Step 4: Capture context during intent creation**

In `apps/api/src/modules/payments/payments.routes.ts`:

- Import `captureTelemetryContext`.
- In `POST /payments/intents`, call it after entering the route handler and before `prepareIntent`.
- Pass the returned carrier to `paymentFunctions.prepareIntent` only if it is defined.
- Do not accept trace context from the client request body.

**Step 5: Restore context during webhook completion**

In `apps/api/src/modules/payments/payments.routes.ts`:

- After Paystack signature verification and reference extraction, fetch or use the payment intent through the existing `getByProviderReference` call.
- Use `withTelemetryContext(intent.telemetryContext, async () => { ... })` around transaction verification, completion, telemetry emission, and enqueueing.
- Keep existing Paystack transaction verification before any Convex state mutation.
- Do not use any `traceparent` header from Paystack.

**Step 6: Regenerate Convex types if needed**

Run:

```bash
pnpm convex:codegen
```

Expected: generated Convex files update only if schema/type generation is configured for this repo.

**Step 7: Run tests**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: pass or fail only on queue type additions deferred to Task 6. Do not leave the repo failing after Task 6.

**Step 8: Commit**

```bash
git add convex/schema.ts convex/payments.ts convex/_generated apps/api/src/modules/payments/payments.routes.ts apps/api/src/modules/payments/payments.routes.check.ts
git commit -m "feat: store payment trace context"
```

If `convex/_generated` did not change, omit it from `git add`.

## Task 6: Propagate Context Through Queue Jobs

**Files:**

- Modify: `apps/api/src/queue/types.ts`
- Modify: `apps/api/src/queue/localQueue.ts`
- Modify: `apps/api/src/queue/amqpQueue.ts`
- Modify: `apps/api/src/queue/queue.check.ts`
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: `apps/api/src/modules/orders/orders.routes.ts`

**Step 1: Write failing queue tests**

Extend `apps/api/src/queue/queue.check.ts`:

```ts
const traceContext = {
  traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
  tracestate: "vendor=value"
};

await queue.enqueue(QUEUE_NAMES.purchaseRequested, {
  ...job,
  telemetryContext: traceContext
});

let consumedTraceContext: unknown;
const stopTrace = await queue.consume(
  QUEUE_NAMES.purchaseRequested,
  async (message) => {
    consumedTraceContext = message.job.telemetryContext;
    await message.ack();
  }
);

await waitFor(() => consumedTraceContext !== undefined);
assert.deepEqual(consumedTraceContext, traceContext);
await stopTrace();
```

Add retry/dead-letter assertions:

- `message.retry()` preserves `job.telemetryContext`.
- `message.deadLetter()` preserves `job.telemetryContext`.

**Step 2: Add telemetry context to queue types**

In `apps/api/src/queue/types.ts`:

```ts
import type { TelemetryContextCarrier } from "../telemetry/sanitize";

type TelemetryContextFields = {
  telemetryContext?: TelemetryContextCarrier;
};
```

Add `& TelemetryContextFields` or explicit optional `telemetryContext?: TelemetryContextCarrier` to both `PurchaseJob` and `StatusRefreshJob`.

**Step 3: Preserve context in local queue**

In `apps/api/src/queue/localQueue.ts`:

- Store job objects as-is after sanitizing `job.telemetryContext`.
- On retry, preserve the existing `telemetryContext`.
- On dead-letter, preserve the existing `telemetryContext`.
- Do not add any recipient phone or user field to telemetry context.

**Step 4: Preserve context in AMQP queue**

In `apps/api/src/queue/amqpQueue.ts`:

- Sanitize `job.telemetryContext` before `JSON.stringify`.
- Also put `traceparent` and optional `tracestate` in AMQP message headers if present, because OpenTelemetry AMQP tooling can understand message headers. Do not put baggage or PII in headers.
- On consume, prefer sanitized `job.telemetryContext`; if missing, fall back to sanitized `message.properties.headers` trace fields.
- On retry and dead-letter, preserve sanitized telemetry context.
- Keep existing `attempt` behavior.

**Step 5: Attach context when enqueueing from payment/order flows**

In `apps/api/src/modules/payments/payments.routes.ts`:

- `buildPaidDataPurchaseJob` accepts optional `telemetryContext`.
- `buildPaidDataPurchaseJobFromIntent` reads `intent.telemetryContext` and passes it through.
- `enqueuePaidDataPurchaseFulfillment` preserves the context from the intent.

In `apps/api/src/modules/orders/orders.routes.ts`:

- For wallet/internal orders, call `captureTelemetryContext()` and set it on the purchase job.
- For status refresh enqueue routes, call `captureTelemetryContext()` or rely on queue provider auto-capture if added.

**Step 6: Run tests**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: pass.

**Step 7: Commit**

```bash
git add apps/api/src/queue/types.ts apps/api/src/queue/localQueue.ts apps/api/src/queue/amqpQueue.ts apps/api/src/queue/queue.check.ts apps/api/src/modules/payments/payments.routes.ts apps/api/src/modules/orders/orders.routes.ts
git commit -m "feat: propagate trace context through queues"
```

## Task 7: Restore Context in Workers

**Files:**

- Modify: `apps/api/src/workers/purchaseWorker.ts`
- Modify: `apps/api/src/workers/statusWorker.ts`
- Modify: `apps/api/src/workers/purchaseWorker.check.ts`
- Modify: `apps/api/src/workers/statusWorker.check.ts`

**Step 1: Write failing worker tests**

In `purchaseWorker.check.ts` and `statusWorker.check.ts`, add tests that send jobs with `telemetryContext` and prove:

- The worker does not throw when context is present.
- Retry/dead-letter paths preserve context.
- New `status-refresh` jobs created by `purchaseWorker` include a telemetry context.

Do not assert Honeycomb output in these tests; assert queue job behavior and worker safety.

**Step 2: Wrap worker message processing**

In `apps/api/src/workers/purchaseWorker.ts`:

- Import `withTelemetryContext`.
- In `processPurchaseMessage`, wrap the existing body in `withTelemetryContext(message.job.telemetryContext, async () => { ... })`.
- When enqueueing `StatusRefreshJob`, include `telemetryContext: message.job.telemetryContext`.
- Keep recipient phone only as the private vendor fulfillment input and hashed telemetry input.

In `apps/api/src/workers/statusWorker.ts`:

- Wrap the consumer body with `withTelemetryContext(message.job.telemetryContext, async () => { ... })`.
- Preserve telemetry context on retry/dead-letter automatically through queue behavior.

**Step 3: Run tests**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: pass.

**Step 4: Commit**

```bash
git add apps/api/src/workers/purchaseWorker.ts apps/api/src/workers/statusWorker.ts apps/api/src/workers/purchaseWorker.check.ts apps/api/src/workers/statusWorker.check.ts
git commit -m "feat: restore trace context in workers"
```

## Task 8: Add Explicit Auto-Instrumentation Safely

**Files:**

- Modify: `apps/api/package.json`
- Modify: `apps/api/tsup.config.ts`
- Create: `apps/api/src/telemetry/preload.ts`
- Modify: `apps/api/src/telemetry/setup.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/worker.ts`
- Create: `apps/api/src/telemetry/setup.check.ts`

**Step 1: Install explicit instrumentation packages**

Run:

```bash
pnpm --filter @betterdata/api add @opentelemetry/instrumentation-http @opentelemetry/instrumentation-fastify @opentelemetry/instrumentation-amqplib @opentelemetry/instrumentation-undici
```

Why include Undici: Paystack, DataMart, Resend, Convex, and Upstash calls use `fetch` or fetch-like clients. In modern Node.js, fetch is Undici-based; HTTP instrumentation alone may miss those calls.

**Step 2: Write setup test**

Create `apps/api/src/telemetry/setup.check.ts` to verify:

- `shouldEnableTelemetry()` still returns false in development without `HONEYCOMB_API_KEY`.
- Setup requires `TELEMETRY_HASH_SECRET` when enabled.
- Instrumentation config does not set `headersToSpanAttributes` for request headers.
- Honeycomb exporter endpoint normalization still appends `/v1/traces`.

Export small pure helpers from `setup.ts` if needed for testing. Do not make the test send data to Honeycomb.

**Step 3: Add the test to package script**

Insert `tsx src/telemetry/setup.check.ts &&` after exporter checks.

**Step 4: Refactor setup for explicit instrumentations**

In `apps/api/src/telemetry/setup.ts`:

- Export a `buildTelemetryInstrumentations()` helper for tests.
- Register:
  - `new HttpInstrumentation({ ... })`
  - `new FastifyInstrumentation({ ... })`
  - `new AmqplibInstrumentation({ ... })`
  - `new UndiciInstrumentation({ ... })`
- Do not configure `headersToSpanAttributes` for request headers.
- Add ignore hooks for Honeycomb export calls to avoid self-tracing loops: in the HTTP and Undici instrumentation setup (use the options named `ignoreIncomingRequestHook` and `ignoreOutgoingRequestHook`), implement hooks that inspect the outgoing request URL/host and return `true` when it matches the Honeycomb exporter endpoint (use the exporter config or `HONEYCOMB_*` env vars to obtain the exact host/URL), thereby skipping instrumentation for those requests; ensure matching covers scheme, host, port and common path variants and apply the same check for both incoming and outgoing hooks to avoid self-tracing loops.
- Add route or request hooks only for safe attributes such as route pattern, method, status, service name, and deployment environment.
- Do not capture query strings as attributes unless sanitized and proven not to contain tokens. Prefer route templates.

**Step 5: Add preload entry**

Create `apps/api/src/telemetry/preload.ts`:

```ts
import { setupTelemetry } from "./setup";

await setupTelemetry({
  serviceName: process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME
});
```

Modify `apps/api/tsup.config.ts` entries:

```ts
entry: ["src/index.ts", "src/worker.ts", "src/telemetry/preload.ts"],
```

**Step 6: Update startup scripts**

Modify `apps/api/package.json` scripts so telemetry preload runs before app imports:

- Development API:
  - Set `OTEL_SERVICE_NAME=betterdata-api`.
  - Start with a Node/tsx preload import for `src/telemetry/preload.ts`.
- Development worker:
  - Set `OTEL_SERVICE_NAME=betterdata-worker`.
  - Start with a Node/tsx preload import for `src/telemetry/preload.ts`.
- Production API:
  - `node --import ./dist/telemetry/preload.js dist/index.js`
- Production worker:
  - `node --import ./dist/telemetry/preload.js dist/worker.js`

If `tsx watch --import` is not supported, use the supported `tsx` equivalent and document the exact syntax in the commit message. The acceptance criterion is that preload runs before `src/index.ts` or `src/worker.ts` imports Fastify, fetch users, or amqplib.

**Step 7: Avoid double setup**

In `apps/api/src/index.ts` and `apps/api/src/worker.ts`:

- Keep explicit `await setupTelemetry(...)` as a safe fallback only if `setupTelemetry` is idempotent.
- Update `setupTelemetry` so calling it twice returns immediately when `sdk` is already initialized or setup is in progress.
- Make telemetry startup resilient: wrap setupTelemetry initialization in a try/catch block that, on any failure, logs a warning (including the error) and sets a `telemetryDisabled` flag so callers/app can continue without telemetry. Ensure that `shutdownTelemetry()` is a no-op when telemetry is not initialized or is disabled.
- Call sites in `index.ts` and `worker.ts` should return immediately when telemetry is disabled or already initialized.
- Preserve `shutdownTelemetry()`.

**Step 8: Run tests and build**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
pnpm --filter @betterdata/api build
```

Expected: pass.

**Step 9: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/tsup.config.ts apps/api/src/telemetry/preload.ts apps/api/src/telemetry/setup.ts apps/api/src/telemetry/setup.check.ts apps/api/src/index.ts apps/api/src/worker.ts
git commit -m "feat: add safe OpenTelemetry auto-instrumentation"
```

## Task 9: Add Wide Event Domain Attributes

**Files:**

- Modify: `apps/api/src/telemetry/paymentTelemetry.ts`
- Modify: `apps/api/src/telemetry/appTelemetry.ts`
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: `apps/api/src/workers/purchaseWorker.ts`
- Modify: `apps/api/src/workers/statusWorker.ts`
- Modify: `apps/api/src/vendors/datamart/transport.ts`
- Modify: related `.check.ts` files for changed helpers

**Step 1: Add tests for allowed wide attributes**

Extend telemetry helper tests to assert these safe attributes pass:

- `payment.provider`
- `payment.channel`
- `payment.bank_or_carrier`
- `payment.is_retry`
- `payment.reconciliation_duration_seconds`
- `vendor.id`
- `vendor.response_time_ms`
- `vendor.status_code`
- `vendor.error_category`
- `vendor.balance_ghs`
- `package.id`
- `package.size_mb`
- `order.profit_margin_ghs`
- `error.class`
- `error.is_retryable`
- `queue.attempts_count`
- `app.version`
- `git.commit`

Also assert these remain blocked:

- `payment.customer.email`
- `payment.customer.phone`
- `vendor.raw`
- `providerPayload`
- `http.request.header.authorization`

**Step 2: Extend telemetry event types**

In `paymentTelemetry.ts`:

- Add optional typed fields for payment provider/channel/carrier/retry/reconciliation duration.
- Keep phone fields as inputs only for hashing.
- Remove or deprecate raw `errorMessage` use.

In `appTelemetry.ts`:

- Keep `attributes` flexible but sanitized.
- Prefer helper functions for common app/vendor attributes if repeated logic appears.

**Step 3: Add payment attributes in routes**

In `apps/api/src/modules/payments/payments.routes.ts`:

- Set `payment.provider = "paystack"` on all Paystack payment telemetry.
- Compute `payment.reconciliation_duration_seconds` from `initializedAt` or `createdAt` to `completedAt`/now when the intent is available.
- Add `payment.channel` and `payment.bank_or_carrier` only from sanitized Paystack verification fields if they are stable non-PII enums/names. Do not store or emit customer fields.
- Add `payment.is_retry` when processing retry alerts.

**Step 4: Add vendor attributes in workers**

In `purchaseWorker.ts`:

- Measure vendor purchase duration around `options.vendor.purchase`.
- Emit `vendor.response_time_ms`.
- Emit `vendor.status_code` only from typed `DataMartHttpError.statusCode`, not raw payload.
- Emit `vendor.error_category` through a safe classifier:
  - `low_balance`
  - `rate_limit`
  - `invalid_number`
  - `network_timeout`
  - `vendor_5xx`
  - `unknown`
- Emit `queue.attempts_count`.
- Emit package and profit fields when already available from safe order records. Do not query extra user data just for telemetry.

In `statusWorker.ts`:

- Emit status refresh duration and queue attempts.
- Keep vendor order reference raw only if it is vendor-generated and not PII.

**Step 5: Add deployment attributes**

In `setup.ts` or startup telemetry:

- Add `app.version` from `process.env.APP_VERSION`.
- Add `git.commit` from `process.env.GIT_COMMIT`.
- Do not shell out to git at runtime.

**Step 6: Run tests**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: pass.

**Step 7: Commit**

```bash
git add apps/api/src/telemetry apps/api/src/modules/payments/payments.routes.ts apps/api/src/workers/purchaseWorker.ts apps/api/src/workers/statusWorker.ts apps/api/src/vendors/datamart/transport.ts
git commit -m "feat: add safe observability domain attributes"
```

## Task 10: Emit Vendor Balance Heartbeat Events

**Files:**

- Modify: `apps/api/src/vendors/vendorBalance.ts`
- Modify: `apps/api/src/vendors/vendorBalance.check.ts` if created, otherwise create it
- Modify: `apps/api/src/workers/purchaseWorker.ts`
- Modify: `apps/api/src/modules/admin/admin.routes.ts`
- Modify: `apps/api/package.json`

**Step 1: Write failing vendor balance telemetry test**

Create `apps/api/src/vendors/vendorBalance.check.ts` if none exists.

Test pure helpers:

- `buildVendorBalanceTelemetryAttributes({ vendorId: "datamart", balanceGhs: 50, source: "purchase_response" })` returns:
  - `vendor.id`
  - `vendor.balance_ghs`
  - `vendor.source`
- Metadata is not included.
- Negative, `NaN`, and infinite balances produce no telemetry attributes.

**Step 2: Add test to package script**

Insert `tsx src/vendors/vendorBalance.check.ts &&` near other vendor checks.

**Step 3: Implement heartbeat helper**

In `apps/api/src/vendors/vendorBalance.ts`:

- Add `emitVendorBalanceSnapshotTelemetry(input)` or call `emitAppTelemetry` after successful `recordForApi`.
- Event name: `vendor.balance_snapshot`.
- Attributes:
  - `vendor.id`
  - `vendor.balance_ghs`
  - `vendor.source`
- Do not include raw `metadata`.

**Step 4: Call heartbeat only after valid snapshots**

In `recordVendorBalanceSnapshotSafely`:

- Emit heartbeat only after Convex accepts the snapshot.
- If Convex write fails, return false and do not emit heartbeat.

**Step 5: Run tests**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: pass.

**Step 6: Commit**

```bash
git add apps/api/package.json apps/api/src/vendors/vendorBalance.ts apps/api/src/vendors/vendorBalance.check.ts apps/api/src/workers/purchaseWorker.ts apps/api/src/modules/admin/admin.routes.ts
git commit -m "feat: emit vendor balance telemetry snapshots"
```

## Task 11: Add Honeycomb Low Balance Trigger

**Files:**

- Modify: `scripts/ops/bootstrap-honeycomb-alerts.mjs`
- Create: `scripts/ops/bootstrap-honeycomb-alerts.check.mjs`
- Modify: root `package.json` only if adding a script is preferred

**Step 1: Write script helper test**

Refactor `bootstrap-honeycomb-alerts.mjs` so trigger-body builders are testable without network calls:

- Export `buildTriggerBody`.
- Export a new `buildLowVendorBalanceTriggerInput` or equivalent.
- Ensure the script still runs when executed directly.

Create `scripts/ops/bootstrap-honeycomb-alerts.check.mjs`:

```js
import assert from "node:assert/strict";

import { buildTriggerBody } from "./bootstrap-honeycomb-alerts.mjs";

const body = buildTriggerBody({
  recipient: { id: "recipient-1" },
  name: "BetterData Low Vendor Balance",
  description: "Alerts when a vendor balance drops below the configured threshold.",
  query: {
    calculations: [{ op: "MIN", column: "vendor.balance_ghs" }],
    filters: [{ column: "name", op: "=", value: "vendor.balance_snapshot" }],
    breakdowns: ["vendor.id"],
    time_range: 300
  },
  threshold: { op: "<", value: 100 }
});

assert.equal(body.name, "BetterData Low Vendor Balance");
assert.deepEqual(body.query.breakdowns, ["vendor.id"]);
assert.deepEqual(body.threshold, { op: "<", value: 100 });
```

**Step 2: Run failing script test**

Run:

```bash
node scripts/ops/bootstrap-honeycomb-alerts.check.mjs
```

Expected: fail until exports/refactor exist.

**Step 3: Refactor alert script**

In `scripts/ops/bootstrap-honeycomb-alerts.mjs`:

- Keep existing fulfillment and worker failure triggers.
- Add low vendor balance trigger using event `vendor.balance_snapshot`.
- Use env var `VENDOR_BALANCE_HONEYCOMB_ALERT_GHS`, default `100`.
- Build query:
  - calculation: `MIN(vendor.balance_ghs)`
  - filter: `name = vendor.balance_snapshot`
  - breakdown: `vendor.id`
  - time range: 300 seconds
  - threshold: `< configured threshold`
- Keep dataset-not-found behavior.

**Step 4: Run script test**

Run:

```bash
node scripts/ops/bootstrap-honeycomb-alerts.check.mjs
```

Expected: pass.

**Step 5: Commit**

```bash
git add scripts/ops/bootstrap-honeycomb-alerts.mjs scripts/ops/bootstrap-honeycomb-alerts.check.mjs
git commit -m "feat: add Honeycomb vendor balance trigger"
```

## Task 12: Documentation and Operations Update

**Files:**

- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/operations/production-smoke-tests.md`
- Modify: `.env.example`

**Step 1: Update env documentation**

In `.env.example`, add:

```bash
OTEL_SERVICE_NAME=
APP_VERSION=
GIT_COMMIT=
VENDOR_BALANCE_HONEYCOMB_ALERT_GHS=100
```

Do not add sample secret values.

**Step 2: Update README telemetry section**

Document:

- Honeycomb requires `HONEYCOMB_API_KEY` and `TELEMETRY_HASH_SECRET` outside development.
- Telemetry uses keyed hashes for correlation.
- Raw PII, secrets, auth headers, webhook signatures, and provider payloads are blocked.
- Trace context is propagated through internal payment intents and queues only.
- Paystack webhook security is unchanged: signature verification and transaction verification remain mandatory.

**Step 3: Update architecture doc**

Add a concise observability subsection:

- API and worker use OpenTelemetry.
- Convex stores only W3C trace context on payment intents, not PII.
- Queue jobs carry sanitized trace context.
- Honeycomb gets curated wide events and auto-instrumented spans after sanitizer enforcement.

**Step 4: Update smoke tests**

In `docs/operations/production-smoke-tests.md`, add checks:

- Create a test payment intent in staging and confirm Honeycomb shows API span plus webhook/worker continuation when Paystack test webhook is replayed.
- Stop worker, enqueue wallet/internal order, restart worker, and confirm queue trace continuity.
- Trigger admin balance refresh and confirm `vendor.balance_snapshot` appears without raw metadata.
- Verify Honeycomb does not contain known test email, phone, `authorization`, `x-paystack-signature`, `x-betterdata-service-secret`, or `X-API-Key`.

**Step 5: Commit**

```bash
git add README.md docs/architecture.md docs/operations/production-smoke-tests.md .env.example
git commit -m "docs: document secure telemetry operations"
```

## Final Verification

Run all local verification:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
pnpm --filter @betterdata/api build
node scripts/ops/bootstrap-honeycomb-alerts.check.mjs
```

Run secret/PII string checks against telemetry code:

```bash
rg -n "authorization|x-paystack-signature|x-betterdata-service-secret|x-api-key|customerEmail|recipientPhone|payerPhone|guestContactPhone|providerPayload|rawBody" apps/api/src/telemetry apps/api/src/workers apps/api/src/modules/payments apps/api/src/queue
```

Expected:

- Matches in route/worker business code are allowed only when values are used for payment, fulfillment, hashing, or sanitizer tests.
- No telemetry export path sends raw matches to Honeycomb.
- No instrumentation config enables generic header capture.

Manual staging verification:

1. Deploy API and worker with `HONEYCOMB_API_KEY`, `HONEYCOMB_DATASET`, `TELEMETRY_HASH_SECRET`, `APP_VERSION`, and `GIT_COMMIT`.
2. Create a staging data purchase payment intent.
3. Complete or replay a Paystack test webhook.
4. Confirm Honeycomb shows connected spans from `/payments/intents` through webhook handling, queue enqueue, worker processing, vendor purchase, and notification work.
5. Query Honeycomb for the test phone number, test email, `Bearer`, `x-paystack-signature`, `PAYSTACK_SECRET_KEY`, and DataMart API key value. Expected: no results.
6. Confirm `vendor.balance_snapshot` events appear with `vendor.id`, `vendor.balance_ghs`, and `vendor.source`.
7. Run `scripts/ops/bootstrap-honeycomb-alerts.mjs` in staging and confirm the low-balance trigger is present.

## Rollback Plan

If staging shows missing spans but no security leak:

1. Disable auto-instrumentation by removing the preload from runtime command.
2. Keep manual sanitized telemetry helpers.
3. Keep trace context fields because they are inert without telemetry startup.

If staging shows any PII or secret leakage:

1. Immediately remove `HONEYCOMB_API_KEY` from the affected deployment and restart API/worker.
2. Rotate any leaked secret.
3. Delete the affected Honeycomb dataset if required by incident policy.
4. Add a regression test for the leaked key/value.
5. Only re-enable telemetry after the sanitizer test fails before the fix and passes after the fix.

If payment or fulfillment behavior regresses:

1. Revert only the telemetry propagation changes from the failing commit.
2. Do not revert payment signature verification, transaction verification, idempotency, or Convex payment state checks.
3. Keep ops alerts active while investigating missed fulfillment.

## Definition of Done

- API tests, typecheck, build, and alert script tests pass.
- Trace context propagates through payment intent creation, Paystack webhook processing, purchase queue, purchase worker, status refresh queue, and status worker.
- Auto-instrumentation is initialized before Fastify, fetch/Undici, and amqplib are imported.
- Honeycomb receives route, outbound HTTP/fetch, AMQP, worker, vendor, payment, and balance spans/events.
- Honeycomb does not receive raw PII, secrets, auth headers, webhook signatures, raw provider payloads, or request/response bodies.
- Low vendor balance trigger is provisioned from `scripts/ops/bootstrap-honeycomb-alerts.mjs`.
- Production docs explain env vars, smoke tests, trace context behavior, and rollback.
