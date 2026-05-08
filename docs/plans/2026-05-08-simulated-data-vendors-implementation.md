# Simulated Data Vendors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add simulated data vendors so Better Data can build and test package browsing, purchase flow, admin operations, status tracking, and delayed fulfillment without making real vendor API calls.

**Architecture:** Treat simulation as normal `DataVendor` adapters, not special route logic. DataMart keeps its documented request/response mapping, but uses a fake local transport until real API calls are enabled. Sandbox vendors model fast success, delayed delivery, and failure/refund behavior through the same vendor interface used by production vendors.

**Tech Stack:** TypeScript, Fastify, Convex, pnpm workspaces, Turborepo.

---

### Task 1: Extend Vendor Contracts for Simulated Fulfillment

**Files:**
- Modify: `packages/contracts/src/vendors.ts`
- Modify: `apps/api/src/vendors/types.ts`

**Step 1: Add sandbox vendor ids**

In `packages/contracts/src/vendors.ts`, expand `DataVendorId`:

```ts
export type DataVendorId =
  | "datamart"
  | "sandbox-fast"
  | "sandbox-delayed"
  | "sandbox-flaky";
```

**Step 2: Add richer vendor purchase output**

Update `VendorPurchaseResult` to support delayed fulfillment metadata:

```ts
export type VendorPurchaseResult = {
  vendorOrderReference: string;
  status: VendorOrderStatus;
  estimatedDeliverySeconds?: number;
  raw?: unknown;
};
```

**Step 3: Add delivery tracker contract**

Add optional normalized tracker types:

```ts
export type VendorDeliveryTracker = {
  message: string;
  scanner: {
    active: boolean;
    waiting: boolean;
    waitSeconds: number;
  };
  stats: {
    checked: number;
    delivered: number;
    partial: number;
    pending: number;
    failed: number;
  };
  raw?: unknown;
};
```

**Step 4: Extend API vendor interface**

In `apps/api/src/vendors/types.ts`, add optional support:

```ts
getDeliveryTracker?(): Promise<VendorDeliveryTracker>;
```

Import `VendorDeliveryTracker` from contracts.

**Step 5: Verify contracts**

Run:

```bash
pnpm --filter @betterdata/contracts typecheck
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

---

### Task 2: Add Shared Simulated Vendor Store

**Files:**
- Create: `apps/api/src/vendors/simulation/store.ts`
- Create: `apps/api/src/vendors/simulation/packages.ts`

**Step 1: Add deterministic package fixtures**

Create `apps/api/src/vendors/simulation/packages.ts` with normalized package fixtures:

```ts
import type { VendorPackage } from "@betterdata/contracts";

export const SIMULATED_PACKAGES: VendorPackage[] = [
  { vendorPackageId: "mtn-1gb", network: "mtn", name: "MTN 1GB", sizeMb: 1024, costGhs: 4, isAvailable: true },
  { vendorPackageId: "mtn-2gb", network: "mtn", name: "MTN 2GB", sizeMb: 2048, costGhs: 9, isAvailable: true },
  { vendorPackageId: "mtn-5gb", network: "mtn", name: "MTN 5GB", sizeMb: 5120, costGhs: 23, isAvailable: true },
  { vendorPackageId: "telecel-1gb", network: "telecel", name: "Telecel 1GB", sizeMb: 1024, costGhs: 4.5, isAvailable: true },
  { vendorPackageId: "telecel-5gb", network: "telecel", name: "Telecel 5GB", sizeMb: 5120, costGhs: 24, isAvailable: true },
  { vendorPackageId: "airteltigo-1gb", network: "airteltigo", name: "AirtelTigo 1GB", sizeMb: 1024, costGhs: 4.25, isAvailable: true },
  { vendorPackageId: "airteltigo-3gb", network: "airteltigo", name: "AirtelTigo 3GB", sizeMb: 3072, costGhs: 13, isAvailable: true }
];
```

**Step 2: Add in-memory order store**

Create `apps/api/src/vendors/simulation/store.ts`:

```ts
import type { VendorOrderStatus, VendorPurchaseInput } from "@betterdata/contracts";

export type SimulatedOrder = {
  reference: string;
  input: VendorPurchaseInput;
  status: VendorOrderStatus;
  createdAt: number;
  updatedAt: number;
  completeAfterMs?: number;
  failAfterMs?: number;
};

const orders = new Map<string, SimulatedOrder>();

export function createSimulatedOrder(
  input: VendorPurchaseInput,
  options: {
    prefix: string;
    initialStatus: VendorOrderStatus;
    completeAfterMs?: number;
    failAfterMs?: number;
  }
) {
  const now = Date.now();
  const reference = `${options.prefix}-${now}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const order: SimulatedOrder = {
    reference,
    input,
    status: options.initialStatus,
    createdAt: now,
    updatedAt: now,
    completeAfterMs: options.completeAfterMs,
    failAfterMs: options.failAfterMs
  };

  orders.set(reference, order);
  return materializeSimulatedOrder(order);
}

export function getSimulatedOrder(reference: string) {
  const order = orders.get(reference);
  return order ? materializeSimulatedOrder(order) : undefined;
}

export function setSimulatedOrderStatus(reference: string, status: VendorOrderStatus) {
  const order = orders.get(reference);
  if (!order) return undefined;
  order.status = status;
  order.updatedAt = Date.now();
  return materializeSimulatedOrder(order);
}

export function listSimulatedOrders() {
  return Array.from(orders.values()).map(materializeSimulatedOrder);
}

function materializeSimulatedOrder(order: SimulatedOrder): SimulatedOrder {
  const elapsed = Date.now() - order.createdAt;

  if (order.status === "processing" && order.failAfterMs && elapsed >= order.failAfterMs) {
    order.status = "failed";
    order.updatedAt = Date.now();
  }

  if (order.status === "processing" && order.completeAfterMs && elapsed >= order.completeAfterMs) {
    order.status = "completed";
    order.updatedAt = Date.now();
  }

  return { ...order };
}
```

**Step 3: Verify API typecheck**

Run:

```bash
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

---

### Task 3: Add Sandbox Vendor Adapters

**Files:**
- Create: `apps/api/src/vendors/sandbox/fast.ts`
- Create: `apps/api/src/vendors/sandbox/delayed.ts`
- Create: `apps/api/src/vendors/sandbox/flaky.ts`
- Modify: `apps/api/src/vendors/registry.ts`

**Step 1: Add `sandbox-fast`**

Create `apps/api/src/vendors/sandbox/fast.ts`:

```ts
import type { DataVendor } from "../types";
import { SIMULATED_PACKAGES } from "../simulation/packages";
import { createSimulatedOrder, getSimulatedOrder } from "../simulation/store";

export function createSandboxFastVendor(): DataVendor {
  return {
    id: "sandbox-fast",
    displayName: "Sandbox Fast",

    async listPackages() {
      return SIMULATED_PACKAGES;
    },

    async purchase(input) {
      const order = createSimulatedOrder(input, {
        prefix: "SFX",
        initialStatus: "completed"
      });

      return {
        vendorOrderReference: order.reference,
        status: order.status,
        estimatedDeliverySeconds: 0,
        raw: order
      };
    },

    async getOrderStatus(reference) {
      return getSimulatedOrder(reference)?.status ?? "failed";
    },

    async getBalance() {
      return { balanceGhs: 10000 };
    }
  };
}
```

**Step 2: Add `sandbox-delayed`**

Create `apps/api/src/vendors/sandbox/delayed.ts`:

```ts
import type { DataVendor } from "../types";
import { SIMULATED_PACKAGES } from "../simulation/packages";
import { createSimulatedOrder, getSimulatedOrder } from "../simulation/store";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export function createSandboxDelayedVendor(): DataVendor {
  return {
    id: "sandbox-delayed",
    displayName: "Sandbox Delayed",

    async listPackages() {
      return SIMULATED_PACKAGES;
    },

    async purchase(input) {
      const longDelay = input.recipientPhone.endsWith("60");
      const completeAfterMs = longDelay ? ONE_HOUR_MS : THIRTY_MINUTES_MS;
      const order = createSimulatedOrder(input, {
        prefix: longDelay ? "SD60" : "SD30",
        initialStatus: "processing",
        completeAfterMs
      });

      return {
        vendorOrderReference: order.reference,
        status: order.status,
        estimatedDeliverySeconds: completeAfterMs / 1000,
        raw: order
      };
    },

    async getOrderStatus(reference) {
      return getSimulatedOrder(reference)?.status ?? "failed";
    },

    async getBalance() {
      return { balanceGhs: 10000 };
    }
  };
}
```

Use phone numbers ending in `60` to simulate one-hour delivery. All other delayed sandbox purchases simulate 30-minute delivery.

**Step 3: Add `sandbox-flaky`**

Create `apps/api/src/vendors/sandbox/flaky.ts`:

```ts
import type { DataVendor } from "../types";
import { SIMULATED_PACKAGES } from "../simulation/packages";
import { createSimulatedOrder, getSimulatedOrder } from "../simulation/store";

export function createSandboxFlakyVendor(): DataVendor {
  return {
    id: "sandbox-flaky",
    displayName: "Sandbox Flaky",

    async listPackages() {
      return SIMULATED_PACKAGES;
    },

    async purchase(input) {
      const shouldFail = input.recipientPhone.endsWith("99");
      const order = createSimulatedOrder(input, {
        prefix: shouldFail ? "SFL" : "SFS",
        initialStatus: "processing",
        completeAfterMs: shouldFail ? undefined : 2 * 60 * 1000,
        failAfterMs: shouldFail ? 2 * 60 * 1000 : undefined
      });

      return {
        vendorOrderReference: order.reference,
        status: order.status,
        estimatedDeliverySeconds: 120,
        raw: order
      };
    },

    async getOrderStatus(reference) {
      return getSimulatedOrder(reference)?.status ?? "failed";
    },

    async getBalance() {
      return { balanceGhs: 250 };
    }
  };
}
```

Use phone numbers ending in `99` to simulate a failed order.

**Step 4: Register sandbox vendors**

In `apps/api/src/vendors/registry.ts`, register:

```ts
import { createSandboxDelayedVendor } from "./sandbox/delayed";
import { createSandboxFastVendor } from "./sandbox/fast";
import { createSandboxFlakyVendor } from "./sandbox/flaky";

const vendors: Record<string, DataVendor> = {
  datamart: createDataMartVendor(),
  "sandbox-fast": createSandboxFastVendor(),
  "sandbox-delayed": createSandboxDelayedVendor(),
  "sandbox-flaky": createSandboxFlakyVendor()
};
```

**Step 5: Verify**

Run:

```bash
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

---

### Task 4: Replace DataMart Real HTTP With Documented Fake Transport

**Files:**
- Modify: `apps/api/src/vendors/datamart/mapper.ts`
- Modify: `apps/api/src/vendors/datamart/client.ts`
- Create: `apps/api/src/vendors/datamart/fakeTransport.ts`
- Modify: `apps/api/src/vendors/datamart/mapper.check.ts`

**Step 1: Update mapper to match docs**

`docs/datamart_api_docs.md` says `GET /data-packages` returns:

```json
{
  "status": "success",
  "pricingTier": "reseller",
  "data": {
    "YELLO": [{ "capacity": 5, "mb": 5120, "network": "YELLO", "price": 23 }]
  }
}
```

Update mapper support for:

- package `capacity`
- package `mb`
- package `price`
- purchase response `data.orderReference`
- purchase response `data.orderStatus`
- status response `data.orderStatus`
- balance response `data.balance`
- webhook `data.orderReference` and `data.status`

**Step 2: Add fake DataMart transport**

Create `apps/api/src/vendors/datamart/fakeTransport.ts`.

It should expose:

```ts
export async function fakeDataMartListPackages();
export async function fakeDataMartPurchase(input, idempotencyKey);
export async function fakeDataMartGetOrderStatus(reference);
export async function fakeDataMartGetBalance();
```

Return responses shaped like the DataMart docs, including `status`, `data`, and `rateLimit` where relevant.

**Step 3: Make DataMart adapter use fake transport**

In `apps/api/src/vendors/datamart/client.ts`, remove `fetch` usage for now and call the fake transport functions.

The request body created for fake purchase must match the docs:

```ts
{
  phoneNumber: input.recipientPhone,
  network: toDataMartProviderCode(input.network),
  capacity: capacityInGbAsString,
  gateway: "wallet"
}
```

Derive `capacity` from `input.packageId` or package fixture data. If package id cannot be parsed, use `"1"` and include the raw input in the fake response.

**Step 4: Preserve request-shape verification**

Add checks in `mapper.check.ts` for:

- `mapDataMartPackage` maps `{ capacity: 5, mb: 5120, network: "YELLO", price: 23 }`
- purchase status `completed` maps to Better Data `completed`
- `pending`, `waiting`, and `processing` map to Better Data `processing`

**Step 5: Verify**

Run:

```bash
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

---

### Task 5: Add Dev-Only Vendor Simulation Routes

**Files:**
- Create: `apps/api/src/modules/dev/vendor-simulation.routes.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Add dev routes**

Create `apps/api/src/modules/dev/vendor-simulation.routes.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { listSimulatedOrders, setSimulatedOrderStatus } from "../../vendors/simulation/store";

export async function registerVendorSimulationRoutes(server: FastifyInstance) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  server.get("/dev/vendor-simulation/orders", async () => ({
    orders: listSimulatedOrders()
  }));

  server.post<{
    Params: { reference: string };
    Body: { status: "processing" | "completed" | "failed" | "refunded" };
  }>("/dev/vendor-simulation/orders/:reference/status", async (request, reply) => {
    const order = setSimulatedOrderStatus(request.params.reference, request.body.status);

    if (!order) {
      return reply.code(404).send({ message: "Simulated order not found." });
    }

    return { order };
  });
}
```

**Step 2: Register dev routes**

In `apps/api/src/index.ts`, import and register after normal routes:

```ts
import { registerVendorSimulationRoutes } from "./modules/dev/vendor-simulation.routes";

await registerVendorSimulationRoutes(server);
```

**Step 3: Verify**

Run:

```bash
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

---

### Task 6: Use Simulated Vendor Purchase in Order Route

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts`

**Step 1: Call active vendor purchase**

Update `POST /orders` to call the active vendor after validation:

```ts
const vendor = getActiveDataVendor();
const idempotencyKey = crypto.randomUUID();
const result = await vendor.purchase({
  packageId: request.body.packageId,
  network: request.body.network,
  recipientPhone: request.body.recipientPhone,
  idempotencyKey
});

return reply.code(202).send({
  reference: result.vendorOrderReference,
  vendorId: vendor.id,
  status: result.status,
  estimatedDeliverySeconds: result.estimatedDeliverySeconds
});
```

Use Node's built-in `crypto.randomUUID`.

**Step 2: Add order status route**

Add:

```ts
server.get<{ Params: { reference: string } }>("/orders/:reference/status", async (request) => {
  const vendor = getActiveDataVendor();
  const status = await vendor.getOrderStatus(request.params.reference);

  return {
    reference: request.params.reference,
    vendorId: vendor.id,
    status
  };
});
```

**Step 3: Verify**

Run:

```bash
pnpm --filter @betterdata/api typecheck
```

Expected: PASS.

---

### Task 7: Update Local Defaults and Documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: Default local vendor to sandbox**

In `.env.example`, set:

```env
BETTERDATA_ACTIVE_DATA_VENDOR=sandbox-fast
```

Keep DataMart credentials blank below it.

**Step 2: Document vendor modes**

In `README.md`, add a short section:

```md
## Data Vendor Simulation

Local development can run without real vendor API calls:

- `sandbox-fast` completes purchases immediately.
- `sandbox-delayed` keeps purchases processing for 30 minutes, or 60 minutes when the recipient phone ends in `60`.
- `sandbox-flaky` fails purchases after about 2 minutes when the recipient phone ends in `99`.
- `datamart` uses DataMart-shaped fake responses for now; real HTTP is intentionally disabled until credentials and production readiness are confirmed.

Set `BETTERDATA_ACTIVE_DATA_VENDOR` in `.env`.
```

**Step 3: Verify docs only**

Run:

```bash
git diff -- README.md .env.example
```

Expected: README and env docs explain the simulated modes.

---

### Task 8: Add Simulation Checks

**Files:**
- Create: `apps/api/src/vendors/simulation/simulation.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Add simulation check script**

Create `apps/api/src/vendors/simulation/simulation.check.ts`:

```ts
import assert from "node:assert/strict";
import { createSandboxDelayedVendor } from "../sandbox/delayed";
import { createSandboxFastVendor } from "../sandbox/fast";
import { createSandboxFlakyVendor } from "../sandbox/flaky";

const fast = createSandboxFastVendor();
const fastOrder = await fast.purchase({
  packageId: "mtn-1gb",
  network: "mtn",
  recipientPhone: "0551234567",
  idempotencyKey: "fast-1"
});
assert.equal(fastOrder.status, "completed");

const delayed = createSandboxDelayedVendor();
const delayed30 = await delayed.purchase({
  packageId: "mtn-1gb",
  network: "mtn",
  recipientPhone: "0551234567",
  idempotencyKey: "delay-30"
});
assert.equal(delayed30.status, "processing");
assert.equal(delayed30.estimatedDeliverySeconds, 30 * 60);

const delayed60 = await delayed.purchase({
  packageId: "mtn-1gb",
  network: "mtn",
  recipientPhone: "0551234560",
  idempotencyKey: "delay-60"
});
assert.equal(delayed60.status, "processing");
assert.equal(delayed60.estimatedDeliverySeconds, 60 * 60);

const flaky = createSandboxFlakyVendor();
const flakyOrder = await flaky.purchase({
  packageId: "mtn-1gb",
  network: "mtn",
  recipientPhone: "0551234599",
  idempotencyKey: "flaky-1"
});
assert.equal(flakyOrder.status, "processing");
```

**Step 2: Update API test command**

In `apps/api/package.json`, make test run both checks:

```json
"test": "tsx src/vendors/datamart/mapper.check.ts && tsx src/vendors/simulation/simulation.check.ts"
```

**Step 3: Run checks**

Run:

```bash
pnpm --filter @betterdata/api test
```

Expected: PASS.

---

### Task 9: Final Verification and Commit

**Files:**
- Review all modified files.

**Step 1: Run full verification**

Run:

```bash
pnpm typecheck
pnpm --filter @betterdata/api test
pnpm convex:codegen
```

Expected: all commands pass.

**Step 2: Confirm no real vendor calls remain**

Run:

```bash
rg "fetch\\(|axios|request<" apps/api/src/vendors
```

Expected: no real HTTP call paths in vendor adapters. If `request` appears only as a fake transport helper name, rename it to avoid confusion.

**Step 3: Review diff**

Run:

```bash
git diff --stat
git diff
```

Expected: changes are limited to vendor simulation, DataMart fake transport/mapping, dev simulation routes, docs, and API order/status routing.

**Step 4: Commit**

Run:

```bash
git add .env.example README.md apps/api packages/contracts docs/plans/2026-05-08-simulated-data-vendors-implementation.md
git commit -m "feat: add simulated data vendors"
```

**Step 5: Push current PR branch**

Run:

```bash
git push
```

Expected: PR #4 updates with the new simulation commit.

