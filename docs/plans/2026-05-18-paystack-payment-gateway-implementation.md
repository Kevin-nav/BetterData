# Paystack Payment Gateway Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a secure, configurable Paystack payment core for data purchases, wallet top-ups, and agent application payments.

**Architecture:** Convex owns payment records, product configuration, wallet balances, orders, agent applications, and idempotent state transitions. The Fastify API owns Paystack secrets, transaction initialization, transaction verification, and signed webhook receipt. Web and mobile use shared typed contracts and `packages/api-client` helpers instead of constructing payment requests by hand.

**Tech Stack:** TypeScript, Fastify, Convex, pnpm workspaces, Paystack REST API, Node `crypto`, existing `@betterdata/contracts`, `@betterdata/api-client`, and `@betterdata/config`.

---

### Task 1: Add Shared Payment Contracts

**Files:**
- Modify: `packages/contracts/src/payments.ts`
- Modify: `packages/contracts/src/index.ts`

**Step 1: Add payment domain types**

Define these exported types in `packages/contracts/src/payments.ts`:

```ts
export type PaymentProvider = "paystack";

export type PaymentPurpose =
  | "data_purchase"
  | "wallet_top_up"
  | "agent_application_fee";

export type PaymentIntentStatus =
  | "pending"
  | "initialized"
  | "succeeded"
  | "failed"
  | "abandoned";

export type CreatePaymentIntentRequest =
  | {
      purpose: "data_purchase";
      packageId: string;
      network: "mtn" | "telecel" | "airteltigo";
      recipientPhone: string;
      confirmRecipientIsCorrect: true;
      savedNumberId?: string;
      guestContactPhone?: string;
    }
  | {
      purpose: "wallet_top_up";
      amountGhs: number;
    }
  | {
      purpose: "agent_application_fee";
    };

export type CreatePaymentIntentResponse = {
  provider: PaymentProvider;
  purpose: PaymentPurpose;
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amountGhs: number;
  currency: "GHS";
  status: PaymentIntentStatus;
};

export type PaymentIntentStatusResponse = {
  reference: string;
  purpose: PaymentPurpose;
  amountGhs: number;
  currency: "GHS";
  status: PaymentIntentStatus;
};
```

Keep the existing wallet transaction types in the same file.

The server derives the user identity for wallet top-ups and agent application fees from the Firebase token. Clients must not provide `userId` in payment intent requests.

**Step 2: Verify exports**

Run: `pnpm --filter @betterdata/contracts typecheck`

Expected: PASS.

**Step 3: Commit**

```bash
git add packages/contracts/src/payments.ts packages/contracts/src/index.ts
git commit -m "feat: add payment intent contracts"
```

---

### Task 2: Add Convex Payment Schema

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Add `paymentIntents` table**

Add a table with these fields:

```ts
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
  currency: v.literal("GHS"),
  providerReference: v.string(),
  providerAccessCode: v.optional(v.string()),
  providerAuthorizationUrl: v.optional(v.string()),
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
```

**Step 2: Add `paymentEvents` table**

Add a table with these fields:

```ts
paymentEvents: defineTable({
  provider: v.literal("paystack"),
  providerReference: v.string(),
  eventType: v.string(),
  payload: v.any(),
  receivedAt: v.number()
})
  .index("by_provider_reference", ["provider", "providerReference"])
  .index("by_event_type", ["eventType"]),
```

**Step 3: Extend `platformConfig` usage**

No schema field changes are required because `platformConfig.value` already accepts strings, numbers, and booleans. The implementation must use these keys:

```text
minimumWalletTopUpGhs
agentOnboardingFeeGhs
firstPurchaseDiscountGhs
agentDiscountPercentage
```

**Step 4: Verify**

Run: `pnpm convex:codegen`

Expected: Convex generated files update without schema errors.

Run: `pnpm typecheck`

Expected: PASS or only unrelated pre-existing failures. Investigate any schema-related failures before continuing.

**Step 5: Commit**

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat: add payment intent schema"
```

---

### Task 3: Add Convex Payment Functions

**Files:**
- Create: `convex/payments.ts`
- Modify: `convex/wallet.ts`
- Modify: `convex/orders.ts`

**Step 1: Create payment mutations**

Create `convex/payments.ts` with mutations for:

- `createPendingIntent`
- `markInitialized`
- `getByProviderReference`
- `recordProviderEvent`
- `completeSucceededIntent`
- `markFailed`

`createPendingIntent` must accept backend-resolved values only:

```ts
export const createPendingIntent = mutation({
  args: {
    provider: v.literal("paystack"),
    purpose: v.union(
      v.literal("data_purchase"),
      v.literal("wallet_top_up"),
      v.literal("agent_application_fee")
    ),
    userId: v.optional(v.id("users")),
    guestContactPhone: v.optional(v.string()),
    amountGhs: v.number(),
    currency: v.literal("GHS"),
    providerReference: v.string(),
    purposeMetadata: v.any()
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("paymentIntents")
      .withIndex("by_provider_reference", (q) =>
        q.eq("provider", args.provider).eq("providerReference", args.providerReference)
      )
      .first();

    if (existing !== null) {
      return existing._id;
    }

    return await ctx.db.insert("paymentIntents", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now
    });
  }
});
```

`markInitialized` stores Paystack checkout fields and moves status from `pending` to `initialized`. It should be idempotent for repeated calls with the same reference.

`completeSucceededIntent` must:

- Fetch by provider/reference.
- Return early if status is already `succeeded`.
- Reject if amount or currency does not match the verified Paystack transaction.
- Patch intent to `succeeded`.
- Dispatch by purpose.

**Step 2: Add purpose completion behavior**

For `wallet_top_up`, increment `users.walletBalanceGhs` and insert a `walletTransactions` row:

```ts
{
  userId,
  type: "top_up",
  amountGhs,
  reference: providerReference,
  notes: "Paystack wallet top-up"
}
```

For `agent_application_fee`, create or update one `agentApplications` row for the user with:

```ts
{
  userId,
  paymentReference: providerReference,
  status: "pending"
}
```

For `data_purchase`, create or update the order record needed by the current order workflow. Use the existing `orders` fields and set `paystackReference` to `providerReference`. Do not call the data vendor from Convex.

**Step 3: Add status query**

Add a query that returns public-safe status by provider reference:

```ts
{
  reference,
  purpose,
  amountGhs,
  currency,
  status
}
```

Do not return raw provider payloads or secret-like metadata.

**Step 4: Verify**

Run: `pnpm convex:codegen`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS or only unrelated pre-existing failures.

**Step 5: Commit**

```bash
git add convex/payments.ts convex/wallet.ts convex/orders.ts convex/_generated
git commit -m "feat: add convex payment workflow"
```

---

### Task 4: Add Paystack Client and Security Tests

**Files:**
- Modify: `apps/api/src/integrations/paystack/client.ts`
- Create: `apps/api/src/integrations/paystack/client.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Write tests first**

Create `client.check.ts` with tests for:

- `ghsToPesewas(10) === 1000`
- `ghsToPesewas(10.5) === 1050`
- invalid negative or zero amounts throw
- `verifyPaystackSignature(rawBody, secret, signature)` accepts valid HMAC SHA512
- invalid signatures return false
- `buildPaystackReference("wallet_top_up")` only contains Paystack-safe characters

Use Node `assert`.

**Step 2: Implement Paystack helpers**

In `client.ts`, implement:

```ts
export type PaystackPaymentIntent = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type InitializePaystackPaymentInput = {
  email: string;
  amountGhs: number;
  reference: string;
  callbackUrl?: string;
  metadata: Record<string, unknown>;
};

export type VerifiedPaystackTransaction = {
  reference: string;
  status: "success" | "failed" | "abandoned" | string;
  amountGhs: number;
  currency: string;
  paidAt?: string;
  channel?: string;
  customer?: {
    email?: string;
    phone?: string;
  };
};
```

Implement functions:

- `ghsToPesewas(amountGhs: number): number`
- `buildPaystackReference(purpose: PaymentPurpose): string`
- `verifyPaystackSignature(rawBody: string | Buffer, secret: string, signature: string | undefined): boolean`
- `initializeMobileMoneyPayment(input, options?)`
- `verifyPaystackTransaction(reference, options?)`

Paystack initialize must call `https://api.paystack.co/transaction/initialize` with:

```json
{
  "amount": 1000,
  "email": "customer@example.com",
  "currency": "GHS",
  "reference": "bd_wallet_top_up_...",
  "channels": ["mobile_money"],
  "metadata": {}
}
```

**Step 3: Update test script**

Append the Paystack check to `apps/api/package.json`:

```json
"test": "tsx src/vendors/datamart/mapper.check.ts && tsx src/vendors/simulation/simulation.check.ts && tsx src/integrations/paystack/client.check.ts"
```

**Step 4: Verify**

Run: `pnpm --filter @betterdata/api test`

Expected: PASS.

Run: `pnpm --filter @betterdata/api typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/src/integrations/paystack/client.ts apps/api/src/integrations/paystack/client.check.ts apps/api/package.json
git commit -m "feat: add paystack client helpers"
```

---

### Task 5: Add Payment API Routes

**Files:**
- Create: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `packages/api-client/src/index.ts`

**Step 1: Add route module**

Create `registerPaymentRoutes(server)` with:

- `POST /payments/intents`
- `GET /payments/intents/:reference`
- `POST /webhooks/paystack`

`POST /payments/intents` must:

- Validate the request purpose.
- Resolve amount from Convex/config, never trusting client amount except as a requested wallet top-up amount that is checked against minimum config.
- Create a Paystack reference server-side.
- Create the Convex pending intent before calling Paystack.
- Initialize Paystack.
- Mark the Convex intent initialized.
- Return public checkout fields.

`GET /payments/intents/:reference` must return the public-safe Convex status.

`POST /webhooks/paystack` must:

- Use the raw request body for signature verification.
- Verify `x-paystack-signature`.
- Record the provider event.
- Verify the transaction with Paystack by reference.
- Complete the Convex intent only if reference, amount, currency, and success status match.
- Return `{ received: true }` for valid processed events.

**Step 2: Register raw body support**

Fastify needs access to the raw body for signature verification. Add a small content parser or hook in the payment route module that preserves the raw body for the Paystack webhook path. Keep this scoped to `/webhooks/paystack`.

**Step 3: Register routes**

In `apps/api/src/index.ts`, import and call:

```ts
import { registerPaymentRoutes } from "./modules/payments/payments.routes";

await registerPaymentRoutes(server);
```

Register it before broad fallback routes if any are added later.

**Step 4: Add API client methods**

In `packages/api-client/src/index.ts`, add:

```ts
createPaymentIntent: (
  body: CreatePaymentIntentRequest
) => Promise<CreatePaymentIntentResponse>;
getPaymentIntentStatus: (
  reference: string
) => Promise<PaymentIntentStatusResponse>;
```

Import the new contract types from `@betterdata/contracts`.

**Step 5: Verify**

Run: `pnpm --filter @betterdata/api typecheck`

Expected: PASS.

Run: `pnpm --filter @betterdata/api-client typecheck`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS or only unrelated pre-existing failures.

**Step 6: Commit**

```bash
git add apps/api/src/modules/payments/payments.routes.ts apps/api/src/index.ts packages/api-client/src/index.ts
git commit -m "feat: add payment api routes"
```

---

### Task 6: Add Config Resolution

**Files:**
- Create: `convex/platformConfig.ts`
- Modify: `convex/payments.ts`
- Modify: `packages/contracts/src/pricing.ts`

**Step 1: Add config helpers**

Create Convex functions to read and write platform config by key:

- `getNumberConfig`
- `setNumberConfig`
- `listPaymentConfig`

Known keys:

```ts
export const PAYMENT_CONFIG_KEYS = [
  "minimumWalletTopUpGhs",
  "agentOnboardingFeeGhs",
  "firstPurchaseDiscountGhs",
  "agentDiscountPercentage"
] as const;
```

Only admin users should be able to write config. If admin auth is not fully wired yet, keep write functions isolated and documented as admin-only, but do not expose them through public API routes.

**Step 2: Enforce fail-closed config**

Payment creation must fail when:

- wallet top-up amount is below `minimumWalletTopUpGhs`
- `agentOnboardingFeeGhs` is missing or less than or equal to zero
- purchase package is unavailable
- resolved purchase amount is less than or equal to zero

**Step 3: Verify**

Run: `pnpm convex:codegen`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS or only unrelated pre-existing failures.

**Step 4: Commit**

```bash
git add convex/platformConfig.ts convex/payments.ts packages/contracts/src/pricing.ts convex/_generated
git commit -m "feat: add payment config resolution"
```

---

### Task 7: Wire Data Purchase Completion to Fulfillment

**Files:**
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Modify: `convex/orders.ts`

**Step 1: Preserve current `/orders` behavior where needed**

Keep the existing simulated order endpoint working for current UI until the frontend is switched to payment intents.

**Step 2: Add post-payment fulfillment path**

After Paystack verifies a `data_purchase` intent, the API should:

- Read purpose metadata from Convex.
- Call `getActiveDataVendor().purchase(...)` with a stable idempotency key derived from the payment reference.
- Patch the Convex order with `vendorId`, `vendorOrderReference`, vendor status, and status `processing` or terminal status.

**Step 3: Guard idempotency**

If the Convex order already has a `vendorOrderReference`, do not call the vendor again. Return the existing fulfillment state.

**Step 4: Verify**

Run: `pnpm --filter @betterdata/api test`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS or only unrelated pre-existing failures.

**Step 5: Commit**

```bash
git add apps/api/src/modules/payments/payments.routes.ts apps/api/src/modules/orders/orders.routes.ts convex/orders.ts
git commit -m "feat: fulfill paid data purchases"
```

---

### Task 8: Update Environment and Docs

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/architecture.md`

**Step 1: Confirm env contract**

Ensure `.env.example` includes:

```text
PAYSTACK_SECRET_KEY=
# Server-only. Do not expose this value to web or mobile clients; it is also used for Paystack webhook signature verification.
PAYSTACK_PUBLIC_KEY=
PUBLIC_APP_URL=http://localhost:3000
```

Do not add `PAYSTACK_WEBHOOK_SECRET`; it is obsolete. `PAYSTACK_SECRET_KEY` is the single authoritative Paystack server secret for initialization, verification, and webhook signature checks.

**Step 2: Document webhook setup**

In `README.md`, document:

```text
Paystack webhook URL:
POST https://<api-domain>/webhooks/paystack
```

Mention that the webhook must be configured in the Paystack dashboard and that the API verifies both the signature and the transaction reference.

**Step 3: Update architecture**

In `docs/architecture.md`, add the unified payment intent flow and note that Convex owns configurable payment amounts.

**Step 4: Verify**

Run: `pnpm typecheck`

Expected: PASS or only unrelated pre-existing failures.

**Step 5: Commit**

```bash
git add .env.example README.md docs/architecture.md
git commit -m "docs: document paystack payment setup"
```

---

### Task 9: Final Verification

**Files:**
- Review all changed files.

**Step 1: Run full checks**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS. If any failure is unrelated and pre-existing, record the exact command, failure summary, and why it is unrelated.

**Step 2: Manual smoke checks**

With API env vars configured and the dev API running:

```bash
pnpm --filter @betterdata/api dev
```

Use a local request to create each payment purpose in test mode:

- `data_purchase`
- `wallet_top_up`
- `agent_application_fee`

Expected:

- response contains a Paystack authorization URL
- local Convex payment intent is created
- no server logs expose secret keys
- invalid amount/config requests fail with 400-level errors

**Step 3: Final commit if needed**

Commit any fixes:

```bash
git add <changed-files>
git commit -m "test: verify paystack payment workflow"
```
