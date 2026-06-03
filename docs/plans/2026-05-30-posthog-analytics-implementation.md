# PostHog Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add privacy-safe managed PostHog analytics for Better Data web purchase behavior, backend payment/order outcomes, and agent activity.

**Architecture:** Use explicit PostHog capture only. The web app captures product intent and friction through a small client analytics wrapper, while the API captures authoritative payment, wallet, order, fulfillment, and agent outcomes through a server-side helper. Shared event/property types keep the taxonomy consistent now and reusable for the future mobile app.

**Tech Stack:** TypeScript monorepo, Next.js 15 web app, Fastify API, Convex, Paystack, PostHog JS browser SDK, PostHog Node SDK, pnpm, tsx checks.

---

## Reference

Approved design: `docs/plans/2026-05-30-posthog-analytics-design.md`

Key existing files:

- Web root layout: `apps/web/app/layout.tsx`
- Web auth context: `apps/web/app/lib/AuthContext.tsx`
- Web purchase flow: `apps/web/app/buy/BuyContent.tsx`
- Web agent application: `apps/web/app/agents/apply/page.tsx`
- API payments: `apps/api/src/modules/payments/payments.routes.ts`
- API wallet orders: `apps/api/src/modules/orders/orders.routes.ts`
- API purchase worker: `apps/api/src/workers/purchaseWorker.ts`
- Existing telemetry hash helper: `apps/api/src/telemetry/hash.ts`
- Env example: `.env.example`

## Task 1: Add Dependencies And Environment Keys

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/api/package.json`
- Modify: `.env.example`

**Step 1: Add PostHog dependencies**

Add `posthog-js` to `apps/web/package.json` dependencies:

```json
"posthog-js": "^1.246.0"
```

Add `posthog-node` to `apps/api/package.json` dependencies:

```json
"posthog-node": "^5.0.0"
```

Use the latest compatible versions if `pnpm add` resolves newer versions.

**Step 2: Install packages**

Run:

```bash
pnpm --filter @betterdata/web add posthog-js
pnpm --filter @betterdata/api add posthog-node
```

Expected: `pnpm-lock.yaml`, `apps/web/package.json`, and `apps/api/package.json` update.

**Step 3: Add env examples**

Add under `.env.example` telemetry section:

```dotenv
# PostHog product analytics
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_POSTHOG_ENVIRONMENT=development
NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE=0.1
POSTHOG_PROJECT_TOKEN=
POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_ENVIRONMENT=development
POSTHOG_DISABLED=false
```

Use the correct managed PostHog host for the project region when configuring production.

**Step 4: Typecheck**

Run:

```bash
pnpm --filter @betterdata/web typecheck
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add .env.example apps/web/package.json apps/api/package.json pnpm-lock.yaml
git commit -m "chore: add posthog dependencies and config"
```

## Task 2: Create Shared Analytics Event Contract

**Files:**

- Create: `packages/contracts/src/analytics.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/analytics.check.ts`
- Modify: `packages/contracts/package.json`

**Step 1: Write the failing check**

Create `packages/contracts/src/analytics.check.ts`:

```ts
import assert from "node:assert/strict";

import {
  ANALYTICS_EVENTS,
  normalizeAnalyticsProperties,
  type AnalyticsEventName
} from "./analytics";

assert.equal(ANALYTICS_EVENTS.includes("payment_started"), true);

const eventName: AnalyticsEventName = "order_completed";
assert.equal(eventName, "order_completed");

const normalized = normalizeAnalyticsProperties({
  environment: "production",
  platform: "web",
  role: "agent",
  amount_ghs: 12,
  empty: "",
  missing: undefined,
  raw_phone_number: "0241234567"
});

assert.deepEqual(normalized, {
  environment: "production",
  platform: "web",
  role: "agent",
  amount_ghs: 12
});

console.log("analytics contract checks passed");
```

**Step 2: Run check to verify it fails**

Run:

```bash
pnpm --filter @betterdata/contracts exec tsx src/analytics.check.ts
```

Expected: FAIL because `analytics.ts` does not exist.

**Step 3: Add the analytics contract**

Create `packages/contracts/src/analytics.ts`:

```ts
export const ANALYTICS_EVENTS = [
  "package_list_viewed",
  "package_selected",
  "network_selected",
  "network_mismatch_detected",
  "network_mismatch_switch_clicked",
  "recipient_entered",
  "recipient_confirmed",
  "payment_method_selected",
  "payment_started",
  "wallet_insufficient_balance_shown",
  "saved_number_selected",
  "saved_number_prompt_shown",
  "saved_number_prompt_saved",
  "saved_number_prompt_skipped",
  "bulk_recipient_added",
  "bulk_recipient_removed",
  "bulk_entry_error_shown",
  "bulk_file_upload_started",
  "bulk_file_upload_parsed",
  "purchase_error_shown",
  "agent_apply_viewed",
  "agent_application_payment_started",
  "payment_intent_created",
  "payment_succeeded",
  "payment_failed",
  "wallet_debited",
  "wallet_topup_succeeded",
  "order_created",
  "order_completed",
  "order_failed",
  "order_refunded",
  "agent_application_started",
  "agent_application_paid",
  "agent_application_approved",
  "agent_application_rejected",
  "agent_purchase_completed"
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsPrimitive = string | number | boolean;

export type AnalyticsProperties = Record<string, AnalyticsPrimitive | null | undefined>;

const FORBIDDEN_PROPERTY_PATTERNS = [
  /email/i,
  /name/i,
  /phone/i,
  /token/i,
  /authorization/i,
  /paystack.*reference/i,
  /vendor.*reference/i,
  /raw/i,
  /payload/i
];

export function normalizeAnalyticsProperties(input: AnalyticsProperties): Record<string, AnalyticsPrimitive> {
  const output: Record<string, AnalyticsPrimitive> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (FORBIDDEN_PROPERTY_PATTERNS.some((pattern) => pattern.test(key))) {
      continue;
    }

    output[key] = value;
  }

  return output;
}
```

Modify `packages/contracts/src/index.ts`:

```ts
export * from "./analytics";
```

Append the export without removing existing exports.

**Step 4: Add contract test script**

If `packages/contracts/package.json` has no analytics check in `test`, add it. Keep existing scripts intact.

```json
"test": "tsx src/analytics.check.ts"
```

If a `test` script already exists, append:

```bash
&& tsx src/analytics.check.ts
```

**Step 5: Run checks**

Run:

```bash
pnpm --filter @betterdata/contracts test
pnpm --filter @betterdata/contracts typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/contracts/src/analytics.ts packages/contracts/src/analytics.check.ts packages/contracts/src/index.ts packages/contracts/package.json
git commit -m "feat: add analytics event contract"
```

## Task 3: Add Backend PostHog Helper

**Files:**

- Create: `apps/api/src/analytics/posthog.ts`
- Create: `apps/api/src/analytics/posthog.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Write the failing check**

Create `apps/api/src/analytics/posthog.check.ts`:

```ts
import assert from "node:assert/strict";

import { buildPostHogEvent, isPostHogEnabled } from "./posthog";

assert.equal(isPostHogEnabled({ POSTHOG_PROJECT_TOKEN: "" }), false);
assert.equal(isPostHogEnabled({ POSTHOG_PROJECT_TOKEN: "phc_test", POSTHOG_DISABLED: "true" }), false);
assert.equal(isPostHogEnabled({ POSTHOG_PROJECT_TOKEN: "phc_test" }), true);

const event = buildPostHogEvent({
  distinctId: "user_hash",
  event: "payment_succeeded",
  properties: {
    environment: "production",
    platform: "web",
    amount_ghs: 20,
    raw_phone: "0241234567",
    payment_hash: "payment_hash"
  }
});

assert.deepEqual(event, {
  distinctId: "user_hash",
  event: "payment_succeeded",
  properties: {
    environment: "production",
    platform: "web",
    amount_ghs: 20,
    payment_hash: "payment_hash"
  }
});

console.log("posthog helper checks passed");
```

**Step 2: Run check to verify it fails**

Run:

```bash
pnpm --filter @betterdata/api exec tsx src/analytics/posthog.check.ts
```

Expected: FAIL because `posthog.ts` does not exist.

**Step 3: Add helper**

Create `apps/api/src/analytics/posthog.ts`:

```ts
import { PostHog } from "posthog-node";
import {
  normalizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties
} from "@betterdata/contracts";

type Env = Partial<NodeJS.ProcessEnv>;

type CaptureInput = {
  distinctId: string;
  event: AnalyticsEventName;
  properties?: AnalyticsProperties;
};

let client: PostHog | null | undefined;

export function isPostHogEnabled(env: Env = process.env) {
  return env.POSTHOG_DISABLED !== "true" && Boolean(env.POSTHOG_PROJECT_TOKEN?.trim());
}

export function buildPostHogEvent(input: CaptureInput) {
  return {
    distinctId: input.distinctId,
    event: input.event,
    properties: normalizeAnalyticsProperties({
      environment: process.env.POSTHOG_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
      platform: "api",
      ...input.properties
    })
  };
}

export function getPostHogClient(env: Env = process.env) {
  if (!isPostHogEnabled(env)) {
    return null;
  }

  if (client !== undefined) {
    return client;
  }

  client = new PostHog(env.POSTHOG_PROJECT_TOKEN!, {
    host: env.POSTHOG_HOST || "https://us.i.posthog.com"
  });

  return client;
}

export function capturePostHogEvent(input: CaptureInput) {
  try {
    const posthog = getPostHogClient();

    if (posthog === null) {
      return;
    }

    const event = buildPostHogEvent(input);
    posthog.capture(event);
  } catch {
    // Product analytics must never interrupt payment, wallet, or fulfillment flows.
  }
}

export async function shutdownPostHog() {
  if (client) {
    await client.shutdown();
  }
  client = undefined;
}
```

**Step 4: Add test script**

Append this check to `apps/api/package.json` `test` script:

```bash
&& tsx src/analytics/posthog.check.ts
```

**Step 5: Run checks**

Run:

```bash
pnpm --filter @betterdata/api exec tsx src/analytics/posthog.check.ts
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/analytics/posthog.ts apps/api/src/analytics/posthog.check.ts apps/api/package.json
git commit -m "feat(api): add posthog capture helper"
```

## Task 4: Add Backend Privacy Hash Helpers For Product Analytics

**Files:**

- Modify: `apps/api/src/telemetry/hash.ts`
- Create: `apps/api/src/telemetry/hash.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Write the failing check**

Create `apps/api/src/telemetry/hash.check.ts`:

```ts
import assert from "node:assert/strict";

process.env.TELEMETRY_HASH_SECRET = "test-secret";

const { hashForTelemetry, hashAnalyticsId } = await import("./hash");

const a = hashForTelemetry(" 0241234567 ");
const b = hashForTelemetry("0241234567");
const c = hashAnalyticsId("recipient", "0241234567");
const d = hashAnalyticsId("payment", "0241234567");

assert.equal(a, b);
assert.notEqual(c, d);
assert.equal(c?.length, 64);

console.log("hash checks passed");
```

**Step 2: Run check to verify it fails**

Run:

```bash
pnpm --filter @betterdata/api exec tsx src/telemetry/hash.check.ts
```

Expected: FAIL because `hashAnalyticsId` does not exist.

**Step 3: Add namespaced hash helper**

Modify `apps/api/src/telemetry/hash.ts`:

```ts
export function hashAnalyticsId(namespace: string, value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return hashForTelemetry(`${namespace}:${value}`);
}
```

Leave `hashForTelemetry` behavior unchanged so existing Honeycomb telemetry stays stable.

**Step 4: Add test script**

Append this check to `apps/api/package.json` `test` script:

```bash
&& tsx src/telemetry/hash.check.ts
```

**Step 5: Run checks**

Run:

```bash
pnpm --filter @betterdata/api exec tsx src/telemetry/hash.check.ts
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/telemetry/hash.ts apps/api/src/telemetry/hash.check.ts apps/api/package.json
git commit -m "feat(api): add namespaced analytics hashes"
```

## Task 5: Capture Backend Payment And Order Outcome Events

**Files:**

- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Modify: `apps/api/src/workers/purchaseWorker.ts`
- Test: `apps/api/src/modules/payments/payments.routes.check.ts`
- Test: `apps/api/src/workers/purchaseWorker.check.ts`

**Step 1: Add imports**

Add to API files where needed:

```ts
import { capturePostHogEvent } from "../../analytics/posthog";
import { hashAnalyticsId } from "../../telemetry/hash";
```

Use correct relative path from worker:

```ts
import { capturePostHogEvent } from "../analytics/posthog";
import { hashAnalyticsId } from "../telemetry/hash";
```

**Step 2: Capture payment intent creation**

In `apps/api/src/modules/payments/payments.routes.ts`, after `emitPaymentTelemetry({ name: "payment.intent.initialized", ... })`, add:

```ts
capturePostHogEvent({
  distinctId: hashAnalyticsId("user", user?.id) ?? hashAnalyticsId("payment", prepared.reference) ?? "anonymous",
  event: "payment_intent_created",
  properties: {
    platform: "web",
    role: user?.role ?? "guest",
    is_authenticated: user !== null,
    is_agent: user?.role === "agent",
    payment_hash: hashAnalyticsId("payment", prepared.reference),
    purpose: prepared.purpose,
    amount_ghs: prepared.amountGhs,
    payment_method: "paystack_momo",
    ...(request.body.purpose === "data_purchase"
      ? {
          purchase_mode: "single",
          recipient_hash: hashAnalyticsId("recipient", request.body.recipientPhone)
        }
      : {})
  }
});
```

If TypeScript rejects `purpose` because the contract does not include it in allowed properties, keep it because `AnalyticsProperties` accepts arbitrary safe keys.

**Step 3: Capture payment success/failure**

After `emitPaymentTelemetry({ name: "payment.intent.completed", ... })`, add:

```ts
capturePostHogEvent({
  distinctId: hashAnalyticsId("payment", reference) ?? "anonymous",
  event: "payment_succeeded",
  properties: {
    payment_hash: hashAnalyticsId("payment", reference),
    amount_ghs: verified.amountGhs,
    payment_method: "paystack_momo",
    status: "succeeded"
  }
});
```

After `emitPaymentTelemetry({ name: "payment.intent.failed", ... })`, add:

```ts
capturePostHogEvent({
  distinctId: hashAnalyticsId("payment", reference) ?? "anonymous",
  event: "payment_failed",
  properties: {
    payment_hash: hashAnalyticsId("payment", reference),
    status: verified.status,
    error_code: "paystack_status_not_success"
  }
});
```

**Step 4: Capture wallet order and wallet debit**

In `apps/api/src/modules/orders/orders.routes.ts`, after `createVerifiedWalletOrder` succeeds and before queue enqueue:

```ts
capturePostHogEvent({
  distinctId: hashAnalyticsId("user", user.id) ?? "anonymous",
  event: "wallet_debited",
  properties: {
    role: user.role ?? "user",
    is_authenticated: true,
    is_agent: user.role === "agent",
    order_hash: hashAnalyticsId("order", order.reference),
    recipient_hash: hashAnalyticsId("recipient", order.recipientPhone),
    network: order.network,
    payment_method: "wallet",
    purchase_mode: "single"
  }
});

capturePostHogEvent({
  distinctId: hashAnalyticsId("user", user.id) ?? "anonymous",
  event: "order_created",
  properties: {
    role: user.role ?? "user",
    is_authenticated: true,
    is_agent: user.role === "agent",
    order_hash: hashAnalyticsId("order", order.reference),
    recipient_hash: hashAnalyticsId("recipient", order.recipientPhone),
    network: order.network,
    payment_method: "wallet",
    purchase_mode: "single"
  }
});
```

**Step 5: Capture fulfillment outcomes**

In `apps/api/src/workers/purchaseWorker.ts`, after `recordVendorResult` succeeds:

```ts
if (result.status === "completed") {
  capturePostHogEvent({
    distinctId: hashAnalyticsId("order", job.orderReference) ?? "anonymous",
    event: "order_completed",
    properties: {
      order_hash: hashAnalyticsId("order", job.orderReference),
      recipient_hash: hashAnalyticsId("recipient", job.recipientPhone),
      network: job.network,
      package_id: job.packageId,
      payment_method: job.paymentMethod,
      vendor_id: job.vendorId
    }
  });
}
```

For terminal failures/refunds inside `reportFulfillmentTerminalStatus`, add:

```ts
capturePostHogEvent({
  distinctId: hashAnalyticsId("order", input.job.orderReference) ?? "anonymous",
  event: input.status === "failed" ? "order_failed" : "order_refunded",
  properties: {
    order_hash: hashAnalyticsId("order", input.job.orderReference),
    recipient_hash: hashAnalyticsId("recipient", input.job.recipientPhone),
    network: input.job.network,
    package_id: input.job.packageId,
    payment_method: input.job.paymentMethod,
    vendor_id: input.job.vendorId,
    status: input.status
  }
});
```

**Step 6: Run checks**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add apps/api/src/modules/payments/payments.routes.ts apps/api/src/modules/orders/orders.routes.ts apps/api/src/workers/purchaseWorker.ts
git commit -m "feat(api): capture posthog purchase outcomes"
```

## Task 6: Add Web PostHog Provider And Identity Sync

**Files:**

- Create: `apps/web/app/lib/analytics.ts`
- Create: `apps/web/app/lib/PostHogProvider.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/lib/AuthContext.tsx`
- Test: `apps/web/app/lib/analytics.check.ts`
- Modify: `apps/web/package.json`

**Step 1: Write the failing check**

Create `apps/web/app/lib/analytics.check.ts`:

```ts
import assert from "node:assert/strict";

import { buildWebAnalyticsProperties, shouldEnableSessionReplay } from "./analytics";

assert.equal(shouldEnableSessionReplay(0.1, 0.05), true);
assert.equal(shouldEnableSessionReplay(0.1, 0.5), false);

assert.deepEqual(
  buildWebAnalyticsProperties({
    role: "agent",
    environment: "production",
    amount_ghs: 10,
    raw_phone: "0241234567"
  }),
  {
    platform: "web",
    role: "agent",
    environment: "production",
    amount_ghs: 10
  }
);

console.log("web analytics checks passed");
```

**Step 2: Run check to verify it fails**

Run:

```bash
pnpm --filter @betterdata/web exec tsx app/lib/analytics.check.ts
```

Expected: FAIL because `analytics.ts` does not exist.

**Step 3: Add web analytics wrapper**

Create `apps/web/app/lib/analytics.ts`:

```ts
"use client";

import posthog from "posthog-js";
import {
  normalizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties
} from "@betterdata/contracts";

export function getAnalyticsEnvironment() {
  return process.env.NEXT_PUBLIC_POSTHOG_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
}

export function buildWebAnalyticsProperties(properties: AnalyticsProperties = {}) {
  return normalizeAnalyticsProperties({
    platform: "web",
    environment: getAnalyticsEnvironment(),
    ...properties
  });
}

export function shouldEnableSessionReplay(sampleRate: number, randomValue = Math.random()) {
  return sampleRate > 0 && randomValue < sampleRate;
}

export function captureWebEvent(event: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (!isPostHogConfigured()) {
    return;
  }

  posthog.capture(event, buildWebAnalyticsProperties(properties));
}

export function identifyWebUser(userHash: string, properties: AnalyticsProperties = {}) {
  if (!isPostHogConfigured()) {
    return;
  }

  posthog.identify(userHash, buildWebAnalyticsProperties(properties));
}

export function resetWebAnalytics() {
  if (isPostHogConfigured()) {
    posthog.reset();
  }
}

export function isPostHogConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim());
}
```

**Step 4: Add PostHog provider**

Create `apps/web/app/lib/PostHogProvider.tsx`:

```tsx
"use client";

import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";
import { useEffect, type ReactNode } from "react";

import { shouldEnableSessionReplay } from "./analytics";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

    if (!key) {
      return;
    }

    const replaySampleRate = Number(process.env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE ?? "0.1");
    const sessionReplayEligible = shouldEnableSessionReplay(
      Number.isFinite(replaySampleRate) ? replaySampleRate : 0
    );

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      disable_session_recording: !sessionReplayEligible,
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: {
          password: true,
          email: true,
          tel: true,
          text: true,
          textarea: true
        }
      },
      loaded: (client) => {
        client.register({
          environment: process.env.NEXT_PUBLIC_POSTHOG_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
          platform: "web",
          session_replay_eligible: sessionReplayEligible
        });
      }
    });
  }, []);

  return <Provider client={posthog}>{children}</Provider>;
}
```

Check current PostHog SDK types and adjust `session_recording` option names if needed.

**Step 5: Wrap the app**

Modify `apps/web/app/layout.tsx`:

```tsx
import { PostHogProvider } from "./lib/PostHogProvider";
```

Wrap:

```tsx
<PostHogProvider>
  <AuthProvider>{children}</AuthProvider>
</PostHogProvider>
```

**Step 6: Sync user identity**

Modify `apps/web/app/lib/AuthContext.tsx` to import helpers:

```ts
import { identifyWebUser, resetWebAnalytics } from "./analytics";
```

After `setUserProfile(fullProfile);`, add:

```ts
if (fullProfile.id) {
  identifyWebUser(fullProfile.id, {
    role: fullProfile.role,
    is_authenticated: true,
    is_agent: fullProfile.role === "agent",
    has_wallet: typeof fullProfile.walletBalanceGhs === "number"
  });
}
```

Important: if `fullProfile.id` is a raw database ID, replace this with a backend-provided hashed analytics ID before implementation goes live. Do not ship raw user IDs if they are considered sensitive. The preferred implementation is to add `analyticsUserHash` to `getMe`.

In `signOut`, after clearing state:

```ts
resetWebAnalytics();
```

**Step 7: Add test script**

Append to `apps/web/package.json`:

```json
"test": "tsx app/lib/analytics.check.ts"
```

If keeping the existing placeholder matters, replace it with the check.

**Step 8: Run checks**

Run:

```bash
pnpm --filter @betterdata/web test
pnpm --filter @betterdata/web typecheck
```

Expected: PASS.

**Step 9: Commit**

```bash
git add apps/web/app/lib/analytics.ts apps/web/app/lib/PostHogProvider.tsx apps/web/app/layout.tsx apps/web/app/lib/AuthContext.tsx apps/web/package.json
git commit -m "feat(web): initialize posthog analytics"
```

## Task 7: Add Backend Analytics Identity Endpoint Or Profile Field

**Files:**

- Modify: `apps/api/src/modules/auth/auth.routes.ts`
- Modify: `packages/api-client/src/index.ts`
- Modify: `apps/web/app/lib/AuthContext.tsx`
- Test: relevant existing API auth checks if present

**Step 1: Inspect current profile shape**

Open:

```bash
Get-Content -Raw apps/api/src/modules/auth/auth.routes.ts
Get-Content -Raw packages/api-client/src/index.ts
```

Find the `getMe` response and exported `UserProfile` type.

**Step 2: Add hashed analytics ID to profile response**

In API auth route, import:

```ts
import { hashAnalyticsId } from "../../telemetry/hash";
```

Add to the user profile response:

```ts
analyticsUserHash: hashAnalyticsId("user", user.id)
```

Do not expose raw Firebase UID, email, or phone as analytics identity.

**Step 3: Update API client type**

In `packages/api-client/src/index.ts`, add:

```ts
analyticsUserHash?: string;
```

to `UserProfile`.

**Step 4: Update web identity sync**

In `apps/web/app/lib/AuthContext.tsx`, change the identify call to:

```ts
if (fullProfile.analyticsUserHash) {
  identifyWebUser(fullProfile.analyticsUserHash, {
    role: fullProfile.role,
    is_authenticated: true,
    is_agent: fullProfile.role === "agent",
    has_wallet: typeof fullProfile.walletBalanceGhs === "number"
  });
}
```

**Step 5: Run checks**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
pnpm --filter @betterdata/web typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/modules/auth/auth.routes.ts packages/api-client/src/index.ts apps/web/app/lib/AuthContext.tsx
git commit -m "feat: expose hashed analytics identity"
```

## Task 8: Instrument Web Purchase Flow

**Files:**

- Modify: `apps/web/app/buy/BuyContent.tsx`

**Step 1: Add analytics import**

Add:

```ts
import { captureWebEvent } from "../lib/analytics";
```

**Step 2: Capture package list viewed**

After packages load successfully:

```ts
captureWebEvent("package_list_viewed", {
  role: userProfile?.role ?? "guest",
  is_authenticated: isAuthenticated,
  is_agent: isAgent,
  purchase_mode: mode,
  network,
  package_count: data.packages.length
});
```

Guard this so it does not fire repeatedly on every render. Use the existing package-load `useEffect`.

**Step 3: Capture network and mode changes**

In network selection handlers, add:

```ts
captureWebEvent("network_selected", {
  role: userProfile?.role ?? "guest",
  is_authenticated: isAuthenticated,
  is_agent: isAgent,
  purchase_mode: mode,
  selected_network: nextNetwork
});
```

When mode switches to `single` or `bulk`, capture `purchase_mode_selected` only if that event is added to the contract. Otherwise skip mode event for v1.

**Step 4: Capture package selected**

Where package cards set `selectedPkgId`, add:

```ts
captureWebEvent("package_selected", {
  role: userProfile?.role ?? "guest",
  is_authenticated: isAuthenticated,
  is_agent: isAgent,
  purchase_mode: mode,
  network,
  package_id: pkg.id,
  package_size_mb: pkg.sizeMb,
  amount_ghs: pkg.customerPriceGhs
});
```

**Step 5: Capture recipient and mismatch behavior**

When recipient reaches a valid 10-digit shape, fire once per current value:

```ts
captureWebEvent("recipient_entered", {
  role: userProfile?.role ?? "guest",
  is_authenticated: isAuthenticated,
  is_agent: isAgent,
  purchase_mode: mode,
  selected_network: network,
  detected_network: detectedNet ?? undefined,
  network_mismatch: detectedNet !== null && detectedNet !== network
});
```

Do not send the raw phone number.

When the mismatch switch button is clicked, add:

```ts
captureWebEvent("network_mismatch_switch_clicked", {
  selected_network: network,
  detected_network: detectedNet
});
```

**Step 6: Capture recipient confirmation**

When confirmation checkbox changes to checked:

```ts
captureWebEvent("recipient_confirmed", {
  role: userProfile?.role ?? "guest",
  is_authenticated: isAuthenticated,
  is_agent: isAgent,
  purchase_mode: mode,
  network,
  payment_method: payMethod
});
```

**Step 7: Capture payment method and wallet friction**

When payment method is selected:

```ts
captureWebEvent("payment_method_selected", {
  role: userProfile?.role ?? "guest",
  is_authenticated: isAuthenticated,
  is_agent: isAgent,
  purchase_mode: mode,
  network,
  payment_method: nextMethod
});
```

When wallet balance disables or blocks submit:

```ts
captureWebEvent("wallet_insufficient_balance_shown", {
  role: userProfile?.role ?? "guest",
  is_authenticated: isAuthenticated,
  is_agent: isAgent,
  purchase_mode: mode,
  network,
  amount_ghs: selectedPkg.customerPriceGhs
});
```

Do not send wallet balance unless explicitly approved later.

**Step 8: Capture payment start and errors**

At the beginning of `handleSinglePay` after validation:

```ts
captureWebEvent("payment_started", {
  role: userProfile?.role ?? "guest",
  is_authenticated: isAuthenticated,
  is_agent: isAgent,
  purchase_mode: "single",
  network,
  package_id: selectedPkg.id,
  package_size_mb: selectedPkg.sizeMb,
  amount_ghs: selectedPkg.customerPriceGhs,
  payment_method: payMethod
});
```

In catch blocks:

```ts
captureWebEvent("purchase_error_shown", {
  role: userProfile?.role ?? "guest",
  is_authenticated: isAuthenticated,
  is_agent: isAgent,
  purchase_mode: mode,
  network,
  payment_method: payMethod,
  error_message: readApiError(err, "Payment submission failed")
});
```

Before shipping, decide whether `error_message` is too detailed. If so, replace it with a safe `error_code` or coarse category.

**Step 9: Capture saved-number and bulk interactions**

Add captures in:

- `selectSavedNumber`: `saved_number_selected`
- save suggestion shown branch: `saved_number_prompt_shown`
- `saveSuggestedNumber`: `saved_number_prompt_saved`
- `skipSaveSuggestedNumber`: `saved_number_prompt_skipped`
- `beginBulkGbEntry`: `bulk_recipient_added`
- invalid bulk pill creation: `bulk_entry_error_shown`
- bulk removal handler: `bulk_recipient_removed`
- file upload handler: `bulk_file_upload_started` and `bulk_file_upload_parsed`

Never send phone values, file contents, or typed labels.

**Step 10: Run checks**

Run:

```bash
pnpm --filter @betterdata/web typecheck
```

Expected: PASS.

**Step 11: Commit**

```bash
git add apps/web/app/buy/BuyContent.tsx
git commit -m "feat(web): track purchase flow analytics"
```

## Task 9: Instrument Agent Application Flow

**Files:**

- Modify: `apps/web/app/agents/apply/page.tsx`
- Modify: `apps/web/app/dashboard/agent/page.tsx`
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: relevant Convex/admin agent approval path if event source is available

**Step 1: Add frontend events**

In `apps/web/app/agents/apply/page.tsx`, import:

```ts
import { captureWebEvent } from "../../lib/analytics";
```

On page load after pricing/application state resolves:

```ts
captureWebEvent("agent_apply_viewed", {
  role: userProfile?.role ?? "guest",
  is_authenticated: isAuthenticated,
  is_agent: userProfile?.role === "agent",
  agent_status: application?.status ?? "none"
});
```

Before `apiClient.createPaymentIntent({ purpose: "agent_application_fee" }, token)`:

```ts
captureWebEvent("agent_application_payment_started", {
  role: userProfile?.role ?? "user",
  is_authenticated: true,
  is_agent: false,
  amount_ghs: pricing?.agentOnboardingFeeGhs
});
```

**Step 2: Add backend agent payment events**

In `apps/api/src/modules/payments/payments.routes.ts`, when `prepared.purpose === "agent_application_fee"`, capture:

```ts
capturePostHogEvent({
  distinctId: hashAnalyticsId("user", user?.id) ?? hashAnalyticsId("payment", prepared.reference) ?? "anonymous",
  event: "agent_application_started",
  properties: {
    role: user?.role ?? "user",
    is_authenticated: user !== null,
    payment_hash: hashAnalyticsId("payment", prepared.reference),
    amount_ghs: prepared.amountGhs
  }
});
```

When the agent application payment succeeds, capture `agent_application_paid`. If the payment completion code cannot distinguish purpose without extra query data, add a lookup from the payment intent record already loaded by `getByProviderReference`.

**Step 3: Add approval/rejection events**

Find the admin/Convex path that approves or rejects agents:

```bash
rg "agent_application|approve|reject" convex apps/api/src/modules/admin apps/admin -n
```

Add backend capture for:

```ts
event: "agent_application_approved"
```

and:

```ts
event: "agent_application_rejected"
```

Use hashed user ID as `distinctId`.

**Step 4: Run checks**

Run:

```bash
pnpm --filter @betterdata/web typecheck
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/app/agents/apply/page.tsx apps/web/app/dashboard/agent/page.tsx apps/api/src/modules/payments/payments.routes.ts convex apps/api/src/modules/admin apps/admin
git commit -m "feat: track agent analytics events"
```

Only add files actually modified.

## Task 10: Add Privacy Policy Update

**Files:**

- Modify: `apps/web/app/privacy/page.tsx`

**Step 1: Add analytics disclosure**

Add concise copy covering:

- anonymized product analytics
- hashed user and recipient identifiers
- no names, raw phone numbers, emails, or payment references in analytics
- masked session replay for a small sample of purchase sessions
- opt-out path if one exists, or a note to contact support until a UI opt-out is built

Suggested copy:

```text
We use privacy-focused product analytics to understand how visitors use Better Data and where the purchase flow can be improved. Analytics events do not include names, email addresses, raw phone numbers, raw payment references, authentication tokens, or provider payloads. Where repeat behavior needs to be measured, we use one-way hashed identifiers.

For a small sample of purchase sessions, we may use masked session replay to understand interface issues. Form inputs and typed values are masked, and sensitive network payloads are not intentionally collected.
```

**Step 2: Run checks**

Run:

```bash
pnpm --filter @betterdata/web typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/web/app/privacy/page.tsx
git commit -m "docs(web): disclose privacy-safe analytics"
```

## Task 11: Add Verification Checklist And Dashboard Setup Notes

**Files:**

- Create: `docs/operations/posthog-analytics.md`

**Step 1: Create operations doc**

Add:

```md
# PostHog Analytics Operations

## Production Filters

All production dashboards must filter `environment = production`.

## Required Dashboards

- Customer purchase funnel
- Guest-to-registered conversion
- Registered user repeat behavior
- Package and network performance
- Wallet usage and wallet friction
- Saved-number adoption
- Bulk purchase and agent behavior
- Agent application funnel
- Payment and fulfillment outcomes
- Session replay review queue

## Privacy QA

Before enabling production analytics:

- Confirm no raw phone numbers appear in events.
- Confirm no emails or names appear in events.
- Confirm no raw Paystack references appear in events.
- Confirm no vendor references appear in events.
- Confirm all input values are masked in replay.
- Confirm admin/internal/test traffic is excluded from dashboards.

## Retention Windows

Use 7, 14, 30, 60, and 90-day windows. Do not use daily purchase retention as the primary success metric.
```

**Step 2: Commit**

```bash
git add docs/operations/posthog-analytics.md
git commit -m "docs: add posthog operations checklist"
```

## Task 12: Final End-To-End Verification

**Files:**

- No edits unless checks reveal issues.

**Step 1: Run full checks**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: PASS.

**Step 2: Run local app smoke test**

Start the apps:

```bash
pnpm dev
```

Open the web app at:

```text
http://localhost:3000
```

Verify:

- homepage loads
- `/buy` loads packages
- selecting network and package does not emit raw phone values
- entering a recipient number emits only safe derived fields
- wallet and MoMo payment starts emit `payment_started`
- backend payment intent emits `payment_intent_created`
- session replay is sampled and masks input fields

**Step 3: Inspect PostHog live events**

In PostHog, confirm:

- event names match the contract
- `environment` is present
- `platform` is present
- no raw phone/email/name/reference fields appear
- hashed IDs are opaque 64-character hashes
- development/staging events can be filtered out

**Step 4: Final commit if needed**

If verification changes are needed:

```bash
git add <changed-files>
git commit -m "fix: polish posthog analytics rollout"
```

## Risk Notes

- Do not ship frontend identity using a raw user ID. Use `analyticsUserHash`.
- Do not enable broad PostHog autocapture.
- Do not capture raw form values, labels typed by users, payment references, or provider payloads.
- Analytics capture must be best-effort and must never block payment, wallet, order, or fulfillment flows.
- If PostHog SDK option names differ by installed version, adjust implementation to match installed official package types and rerun typecheck.
