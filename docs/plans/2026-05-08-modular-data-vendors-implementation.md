# Modular Data Vendors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace DataMart-specific fulfillment coupling with a vendor adapter registry that supports one configured active data vendor now and multiple vendors later.

**Architecture:** Add a vendor boundary inside `apps/api/src/vendors` and route package, order, balance, and webhook behavior through a normalized `DataVendor` interface. Rename shared contracts and Convex fields away from DataMart/provider-specific names while keeping DataMart as the first adapter.

**Tech Stack:** TypeScript, Fastify, Convex, pnpm workspaces, Turborepo.

---

### Task 1: Add Vendor-Neutral Shared Contracts

**Files:**
- Modify: `packages/contracts/src/networks.ts`
- Modify: `packages/contracts/src/orders.ts`
- Create: `packages/contracts/src/vendors.ts`
- Modify: `packages/contracts/src/index.ts`

**Step 1: Update internal network codes**

In `packages/contracts/src/networks.ts`, replace DataMart-shaped network codes with Better Data-owned codes:

```ts
export const NETWORK_CODES = {
  MTN: "mtn",
  TELECEL: "telecel",
  AIRTELTIGO: "airteltigo"
} as const;

export type NetworkKey = keyof typeof NETWORK_CODES;
export type NetworkCode = (typeof NETWORK_CODES)[NetworkKey];

export type DataPackage = {
  id: string;
  vendorId: string;
  vendorPackageId: string;
  network: NetworkCode;
  name: string;
  sizeMb: number;
  costGhs: number;
  customerPriceGhs: number;
  isAvailable: boolean;
};
```

**Step 2: Add vendor contract exports**

Create `packages/contracts/src/vendors.ts`:

```ts
import type { NetworkCode } from "./networks";

export type DataVendorId = "datamart";

export type VendorOrderStatus =
  | "processing"
  | "completed"
  | "failed"
  | "refunded";

export type VendorErrorCode =
  | "vendor_unavailable"
  | "package_unavailable"
  | "insufficient_vendor_balance"
  | "duplicate_request"
  | "invalid_recipient"
  | "unknown_vendor_error";

export type VendorPackage = {
  vendorPackageId: string;
  network: NetworkCode;
  name: string;
  sizeMb: number;
  costGhs: number;
  isAvailable: boolean;
  raw?: unknown;
};

export type VendorPurchaseInput = {
  packageId: string;
  network: NetworkCode;
  recipientPhone: string;
  idempotencyKey: string;
};

export type VendorPurchaseResult = {
  vendorOrderReference: string;
  status: VendorOrderStatus;
  raw?: unknown;
};

export type VendorBalance = {
  balanceGhs: number;
  raw?: unknown;
};

export type VendorWebhookEvent = {
  vendorOrderReference: string;
  status: VendorOrderStatus;
  raw?: unknown;
};
```

**Step 3: Rename order contract references**

In `packages/contracts/src/orders.ts`, import `NetworkCode` and rename `DataMartWebhookEvent`:

```ts
import type { NetworkCode } from "./networks";

export type PurchaseRequest = {
  packageId: string;
  network: NetworkCode;
  recipientPhone: string;
  confirmRecipientIsCorrect: true;
  paymentMethod: "paystack_momo" | "wallet";
  savedNumberId?: string;
};

export type Order = {
  id: string;
  reference: string;
  status: OrderStatus;
  packageId: string;
  vendorId?: string;
  vendorOrderReference?: string;
  network: NetworkCode;
  recipientPhone: string;
  amountGhs: number;
  createdAt: string;
  updatedAt: string;
};

export type DataVendorWebhookEvent =
  | "order.created"
  | "order.completed"
  | "order.failed"
  | "order.refunded";
```

Remove the old `DataMartNetworkCode` and `DataMartWebhookEvent` names from shared contracts.

**Step 4: Export vendors**

In `packages/contracts/src/index.ts`, add:

```ts
export * from "./vendors";
```

**Step 5: Verify contracts**

Run:

```bash
pnpm --filter @betterdata/contracts typecheck
```

Expected: Type errors may appear in apps still importing the old names. Do not commit until those imports are updated in later tasks.

---

### Task 2: Update Convex Schema to Store Vendor Metadata

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/packages.ts`
- Modify: `convex/orders.ts`

**Step 1: Update package schema**

In `convex/schema.ts`, change `dataPackages` from `providerPackageId` to vendor metadata:

```ts
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
```

Keep `providerCostGhs` for now if renaming it would create unnecessary pricing churn. Rename it to `vendorCostGhs` in a later cleanup only if all call sites are updated in the same task.

**Step 2: Update saved number network literals**

In `savedNumbers`, replace network literals with:

```ts
v.optional(v.union(v.literal("mtn"), v.literal("telecel"), v.literal("airteltigo")))
```

**Step 3: Update order schema**

In `orders`, replace network literals and DataMart references:

```ts
vendorId: v.string(),
vendorPackageId: v.optional(v.string()),
vendorOrderReference: v.optional(v.string()),
vendorRaw: v.optional(v.any()),
network: v.union(v.literal("mtn"), v.literal("telecel"), v.literal("airteltigo")),
```

Replace the `by_datamart_reference` index with:

```ts
.index("by_vendor_order_reference", ["vendorId", "vendorOrderReference"])
```

**Step 4: Update Convex function args**

In `convex/packages.ts` and `convex/orders.ts`, replace `YELLO | TELECEL | AT_PREMIUM` validators with `mtn | telecel | airteltigo`.

In `convex/orders.ts`, add required `vendorId` and optional vendor fields to `createIntent` args and insert payload.

**Step 5: Verify Convex types**

Run:

```bash
pnpm convex:codegen
pnpm --filter @betterdata/api typecheck
```

Expected: Convex codegen succeeds. API typecheck may still show route-level references that are fixed in later tasks.

---

### Task 3: Add API Vendor Interface and Registry

**Files:**
- Create: `apps/api/src/vendors/types.ts`
- Create: `apps/api/src/vendors/registry.ts`
- Create: `apps/api/src/vendors/activeVendor.ts`

**Step 1: Create API-side vendor types**

In `apps/api/src/vendors/types.ts`:

```ts
import type {
  DataVendorId,
  VendorBalance,
  VendorPackage,
  VendorPurchaseInput,
  VendorPurchaseResult,
  VendorWebhookEvent
} from "@betterdata/contracts";

export type DataVendor = {
  id: DataVendorId;
  displayName: string;
  listPackages(): Promise<VendorPackage[]>;
  purchase(input: VendorPurchaseInput): Promise<VendorPurchaseResult>;
  getOrderStatus(reference: string): Promise<string>;
  getBalance(): Promise<VendorBalance>;
  normalizeWebhook?(
    payload: unknown,
    headers: Record<string, string>
  ): Promise<VendorWebhookEvent>;
};
```

**Step 2: Create registry**

In `apps/api/src/vendors/registry.ts`:

```ts
import { createDataMartVendor } from "./datamart/client";
import type { DataVendor } from "./types";

const vendors = {
  datamart: createDataMartVendor()
} satisfies Record<string, DataVendor>;

export function getVendorById(id: string): DataVendor | undefined {
  return vendors[id];
}

export function listVendors(): DataVendor[] {
  return Object.values(vendors);
}
```

This imports a DataMart adapter that will be created in Task 4.

**Step 3: Create active resolver**

In `apps/api/src/vendors/activeVendor.ts`:

```ts
import { getVendorById } from "./registry";

export function getActiveDataVendor() {
  const vendorId = process.env.BETTERDATA_ACTIVE_DATA_VENDOR ?? "datamart";
  const vendor = getVendorById(vendorId);

  if (!vendor) {
    throw new Error(`Unknown active data vendor: ${vendorId}`);
  }

  return vendor;
}
```

**Step 4: Verify expected temporary failure**

Run:

```bash
pnpm --filter @betterdata/api typecheck
```

Expected: FAIL until `./datamart/client` exists in Task 4.

---

### Task 4: Move DataMart Behind an Adapter

**Files:**
- Create: `apps/api/src/vendors/datamart/mapper.ts`
- Create: `apps/api/src/vendors/datamart/client.ts`
- Leave for later deletion or compatibility: `apps/api/src/integrations/datamart/client.ts`

**Step 1: Add DataMart mapper**

In `apps/api/src/vendors/datamart/mapper.ts`:

```ts
import type { NetworkCode, VendorOrderStatus, VendorPackage } from "@betterdata/contracts";

export const DATAMART_NETWORK_CODES = {
  mtn: "YELLO",
  telecel: "TELECEL",
  airteltigo: "AT_PREMIUM"
} satisfies Record<NetworkCode, string>;

export function toDataMartNetworkCode(network: NetworkCode): string {
  return DATAMART_NETWORK_CODES[network];
}

export function fromDataMartNetworkCode(code: string): NetworkCode | undefined {
  const entry = Object.entries(DATAMART_NETWORK_CODES).find(([, value]) => value === code);
  return entry?.[0] as NetworkCode | undefined;
}

export function mapDataMartStatus(status: string): VendorOrderStatus {
  switch (status.toLowerCase()) {
    case "completed":
    case "success":
      return "completed";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      return "processing";
  }
}

export function mapDataMartPackage(raw: {
  id?: string;
  package_id?: string;
  network?: string;
  name?: string;
  size_mb?: number;
  cost?: number;
  price?: number;
  available?: boolean;
}): VendorPackage | undefined {
  const vendorPackageId = raw.id ?? raw.package_id;
  const network = raw.network ? fromDataMartNetworkCode(raw.network) : undefined;

  if (!vendorPackageId || !network || !raw.name) {
    return undefined;
  }

  return {
    vendorPackageId,
    network,
    name: raw.name,
    sizeMb: raw.size_mb ?? 0,
    costGhs: raw.cost ?? raw.price ?? 0,
    isAvailable: raw.available ?? true,
    raw
  };
}
```

Adjust raw field names if `docs/datamart_api_docs.md` confirms different response shapes.

**Step 2: Add DataMart adapter**

In `apps/api/src/vendors/datamart/client.ts`:

```ts
import type { VendorPackage, VendorPurchaseInput, VendorPurchaseResult } from "@betterdata/contracts";
import { mapDataMartPackage, mapDataMartStatus, toDataMartNetworkCode } from "./mapper";
import type { DataVendor } from "../types";

export function createDataMartVendor(): DataVendor {
  const baseUrl = process.env.DATAMART_BASE_URL;
  const apiKey = process.env.DATAMART_API_KEY;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!baseUrl || !apiKey) {
      throw new Error("DataMart vendor is not configured.");
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(`DataMart request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  return {
    id: "datamart",
    displayName: "DataMartGH",

    async listPackages(): Promise<VendorPackage[]> {
      const response = await request<{ packages?: unknown[] }>("/data-packages");
      return (response.packages ?? [])
        .map((item) => mapDataMartPackage(item as Parameters<typeof mapDataMartPackage>[0]))
        .filter((item): item is VendorPackage => Boolean(item));
    },

    async purchase(input: VendorPurchaseInput): Promise<VendorPurchaseResult> {
      const response = await request<{ reference?: string; status?: string }>("/purchase", {
        method: "POST",
        headers: {
          "x-idempotency-key": input.idempotencyKey
        },
        body: JSON.stringify({
          package_id: input.packageId,
          network: toDataMartNetworkCode(input.network),
          recipient_phone: input.recipientPhone
        })
      });

      if (!response.reference) {
        throw new Error("DataMart purchase response did not include a reference.");
      }

      return {
        vendorOrderReference: response.reference,
        status: mapDataMartStatus(response.status ?? "processing"),
        raw: response
      };
    },

    async getOrderStatus(reference: string) {
      const response = await request<{ status?: string }>(`/order-status/${reference}`);
      return mapDataMartStatus(response.status ?? "processing");
    },

    async getBalance() {
      const response = await request<{ balance?: number }>("/balance");
      return {
        balanceGhs: response.balance ?? 0,
        raw: response
      };
    }
  };
}
```

**Step 3: Verify API compiles**

Run:

```bash
pnpm --filter @betterdata/api typecheck
```

Expected: Any remaining failures should be old contract names or route references. Fix them in following tasks.

---

### Task 5: Route Packages Through the Active Vendor

**Files:**
- Modify: `apps/api/src/modules/packages/packages.routes.ts`
- Modify if needed: `apps/api/src/index.ts`
- Modify: `.env.example`

**Step 1: Update environment example**

In `.env.example`, add:

```env
BETTERDATA_ACTIVE_DATA_VENDOR=datamart
```

Keep DataMart-specific env vars under their own section because they are adapter credentials.

**Step 2: Update packages route**

In `apps/api/src/modules/packages/packages.routes.ts`, replace direct network-code response with active vendor packages:

```ts
import type { DataPackage } from "@betterdata/contracts";
import type { FastifyInstance } from "fastify";
import { getActiveDataVendor } from "../../vendors/activeVendor";

export async function registerPackageRoutes(server: FastifyInstance) {
  server.get("/data-packages", async () => {
    const vendor = getActiveDataVendor();
    const packages = await vendor.listPackages();

    return {
      vendor: {
        id: vendor.id,
        displayName: vendor.displayName
      },
      packages: packages.map(
        (item): DataPackage => ({
          id: `${vendor.id}:${item.vendorPackageId}`,
          vendorId: vendor.id,
          vendorPackageId: item.vendorPackageId,
          network: item.network,
          name: item.name,
          sizeMb: item.sizeMb,
          costGhs: item.costGhs,
          customerPriceGhs: item.costGhs,
          isAvailable: item.isAvailable
        })
      )
    };
  });
}
```

Pricing markup can remain a follow-up. Do not add pricing complexity in this adapter task.

**Step 3: Verify route compiles**

Run:

```bash
pnpm --filter @betterdata/api typecheck
```

Expected: PASS or only failures from order/webhook files not yet updated.

---

### Task 6: Rename Data Vendor Webhook Route

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts`

**Step 1: Replace DataMart route name**

Change:

```ts
server.post("/webhooks/datamart", async () => ({
  received: true
}));
```

To:

```ts
server.post("/webhooks/data-vendor", async (request) => {
  const vendor = getActiveDataVendor();

  if (!vendor.normalizeWebhook) {
    return {
      received: true,
      vendorId: vendor.id,
      normalized: false
    };
  }

  const event = await vendor.normalizeWebhook(
    request.body,
    request.headers as Record<string, string>
  );

  return {
    received: true,
    vendorId: vendor.id,
    event
  };
});
```

Import `getActiveDataVendor` from `../../vendors/activeVendor`.

**Step 2: Keep behavior neutral**

Do not add DataMart-specific webhook parsing in the route. That belongs under `apps/api/src/vendors/datamart/webhook.ts` later when the exact webhook payload is confirmed.

**Step 3: Verify**

Run:

```bash
pnpm --filter @betterdata/api typecheck
```

Expected: Any type errors should be about `request.body` being `unknown`. If needed, cast only inside the adapter call.

---

### Task 7: Update Order Route to Use Vendor-Neutral Naming

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Modify: `packages/contracts/src/orders.ts`

**Step 1: Keep current placeholder purchase behavior vendor-aware**

The current order route returns a placeholder reference. Update it to include the active vendor without calling fulfillment yet:

```ts
server.post<{ Body: PurchaseRequest }>("/orders", async (request, reply) => {
  if (!request.body.confirmRecipientIsCorrect) {
    return reply.code(400).send({
      message: "Recipient number confirmation is required."
    });
  }

  const vendor = getActiveDataVendor();

  return reply.code(202).send({
    reference: "pending-provider-integration",
    vendorId: vendor.id,
    status: "pending"
  });
});
```

This keeps the adapter refactor separate from real payment/fulfillment.

**Step 2: Verify no DataMart route imports remain**

Run:

```bash
rg "DataMart|datamartReference|DataMartNetworkCode|DataMartWebhookEvent" apps packages convex
```

Expected: Only DataMart adapter files, `.env.example`, docs, and compatibility comments should mention DataMart. No route, schema, or shared generic contract should depend on DataMart-specific names.

**Step 3: Typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

---

### Task 8: Update Web and Mobile Network Usage

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/mobile/App.tsx`
- Search and update any other files returned by `rg "YELLO|AT_PREMIUM|TELECEL"`

**Step 1: Update homepage network ids**

In `apps/web/app/page.tsx`, change local IDs:

```ts
const NETWORKS = [
  { name: "MTN", id: "mtn", Logo: MtnLogo },
  { name: "Telecel", id: "telecel", Logo: TelecelLogo },
  { name: "AirtelTigo", id: "airteltigo", Logo: AirtelTigoLogo },
];
```

Set initial state:

```ts
const [network, setNetwork] = useState("mtn");
```

**Step 2: Update mobile display**

`apps/mobile/App.tsx` can keep using `NETWORK_CODES`, but it should now display internal Better Data codes. No DataMart code should appear in mobile UI.

**Step 3: Verify app typechecks**

Run:

```bash
pnpm --filter @betterdata/web typecheck
pnpm --filter @betterdata/mobile typecheck
```

Expected: PASS.

---

### Task 9: Add Lightweight Vendor Mapping Checks

**Files:**
- Create: `apps/api/src/vendors/datamart/mapper.check.ts`
- Modify: `apps/api/package.json`

**Step 1: Add a small assertion script**

In `apps/api/src/vendors/datamart/mapper.check.ts`:

```ts
import assert from "node:assert/strict";
import {
  fromDataMartNetworkCode,
  mapDataMartStatus,
  toDataMartNetworkCode
} from "./mapper";

assert.equal(toDataMartNetworkCode("mtn"), "YELLO");
assert.equal(toDataMartNetworkCode("telecel"), "TELECEL");
assert.equal(toDataMartNetworkCode("airteltigo"), "AT_PREMIUM");

assert.equal(fromDataMartNetworkCode("YELLO"), "mtn");
assert.equal(fromDataMartNetworkCode("TELECEL"), "telecel");
assert.equal(fromDataMartNetworkCode("AT_PREMIUM"), "airteltigo");

assert.equal(mapDataMartStatus("success"), "completed");
assert.equal(mapDataMartStatus("completed"), "completed");
assert.equal(mapDataMartStatus("failed"), "failed");
assert.equal(mapDataMartStatus("refunded"), "refunded");
assert.equal(mapDataMartStatus("pending"), "processing");
```

**Step 2: Add package test command**

In `apps/api/package.json`, replace the placeholder test script:

```json
"test": "tsx src/vendors/datamart/mapper.check.ts"
```

**Step 3: Run focused check**

Run:

```bash
pnpm --filter @betterdata/api test
```

Expected: command exits with code 0 and no assertion error.

---

### Task 10: Final Verification and Commit

**Files:**
- Review all modified files.

**Step 1: Run search checks**

Run:

```bash
rg "DataMartNetworkCode|DataMartWebhookEvent|datamartReference|providerPackageId" apps packages convex
```

Expected: no results.

Run:

```bash
rg "YELLO|AT_PREMIUM|TELECEL" apps packages convex
```

Expected: only `apps/api/src/vendors/datamart/mapper.ts`, its check file, and DataMart-specific docs or comments.

**Step 2: Run full verification**

Run:

```bash
pnpm typecheck
pnpm --filter @betterdata/api test
```

Expected: all commands pass.

**Step 3: Review git diff**

Run:

```bash
git diff --stat
git diff
```

Expected: changes are limited to contracts, Convex schema/functions, API vendor boundary/routes, env docs, and network code usage.

**Step 4: Commit implementation**

Run:

```bash
git add .env.example apps/api apps/web apps/mobile packages/contracts convex docs/plans/2026-05-08-modular-data-vendors-implementation.md
git commit -m "refactor: add modular data vendor boundary"
```

Do not add unrelated untracked files such as `docs/datamart_api_docs.md` unless they are intentionally part of the implementation.

