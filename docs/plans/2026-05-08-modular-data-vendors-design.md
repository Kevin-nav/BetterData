# Modular Data Vendors Design

## Goal

Better Data should support one active data vendor at a time for v1 while keeping the codebase ready for multiple vendors later. DataMart should become one adapter behind a Better Data-owned vendor boundary, not a platform-wide dependency.

## Context

The PRD originally names DataMartGH as the fulfillment provider, but the product needs room to use other data vendors with different API shapes. Vendors may differ in auth, package formats, network codes, order references, statuses, webhook payloads, balance endpoints, and error responses.

The rest of the platform should work with normalized Better Data concepts:

- networks
- packages
- orders
- vendor order references
- wallet and pricing behavior
- customer-facing order statuses

Vendor-specific details should stay inside API-side adapters.

## Decision

Use a vendor adapter registry with one active vendor selected by configuration for v1.

The API will resolve the configured vendor and call a common interface. Customer web, mobile, admin, Convex, pricing, and order code should not import DataMart-specific modules directly.

## Proposed Structure

Create a vendor boundary in the API app:

```txt
apps/api/src/vendors/
  types.ts
  registry.ts
  activeVendor.ts
  datamart/
    client.ts
    mapper.ts
    webhook.ts
```

Future vendors can be added beside DataMart:

```txt
apps/api/src/vendors/
  other-vendor/
    client.ts
    mapper.ts
    webhook.ts
```

## Vendor Interface

Each vendor implements one normalized contract:

```ts
type DataVendor = {
  id: DataVendorId;
  displayName: string;

  listPackages(): Promise<VendorPackage[]>;
  purchase(input: VendorPurchaseInput): Promise<VendorPurchaseResult>;
  getOrderStatus(reference: string): Promise<VendorOrderStatus>;
  getBalance(): Promise<VendorBalance>;

  normalizeWebhook?(
    payload: unknown,
    headers: Record<string, string>
  ): Promise<VendorWebhookEvent>;
};
```

Normalized vendor values use Better Data language:

```ts
type VendorPackage = {
  vendorPackageId: string;
  network: NetworkCode;
  name: string;
  sizeMb: number;
  costGhs: number;
  isAvailable: boolean;
  raw?: unknown;
};

type VendorPurchaseInput = {
  packageId: string;
  network: NetworkCode;
  recipientPhone: string;
  idempotencyKey: string;
};

type VendorPurchaseResult = {
  vendorOrderReference: string;
  status: "processing" | "completed" | "failed";
  raw?: unknown;
};
```

The optional `raw` fields are for debugging and audit history. Business logic should not depend on vendor raw payloads.

## Configuration

Use one active vendor setting for v1:

```env
BETTERDATA_ACTIVE_DATA_VENDOR=datamart
```

`activeVendor.ts` resolves this setting through the registry:

```ts
const vendor = getActiveDataVendor();
```

If the configured vendor is unknown, the API should fail clearly. Silent fallback is unsafe because this path controls paid fulfillment.

## Data Model Changes

Convex stores normalized Better Data entities plus vendor metadata.

For `dataPackages`, rename or add:

```ts
vendorId: string;
vendorPackageId: string;
vendorRaw?: any;
```

The current `providerPackageId` field should become `vendorPackageId`.

For `orders`, rename or add:

```ts
vendorId: string;
vendorPackageId?: string;
vendorOrderReference?: string;
vendorRaw?: any;
```

The current `datamartReference` field should become `vendorOrderReference`.

This supports one configured vendor today and multiple vendors later without changing the core order shape again.

## Network Codes

Better Data should own internal network codes:

```ts
"mtn" | "telecel" | "airteltigo"
```

Each vendor adapter maps those codes to its provider-specific values.

DataMart mapping:

```txt
mtn       -> YELLO
telecel   -> TELECEL
airteltigo -> AT_PREMIUM
```

Another vendor might use different strings, numeric IDs, or product categories. The frontend and shared contracts should not treat DataMart codes as platform truth.

## API Flow

### Package Listing

1. `GET /data-packages` calls `getActiveDataVendor().listPackages()`.
2. The adapter fetches vendor packages.
3. The adapter maps the response into `VendorPackage[]`.
4. The API applies Better Data pricing rules.
5. The API returns normalized customer-facing packages.
6. The API may sync normalized packages into Convex.

### Purchase

1. Customer selects a normalized package.
2. API or Convex creates a Better Data order intent.
3. API resolves the active vendor.
4. API sends the purchase request through the vendor adapter.
5. Adapter returns a normalized `VendorPurchaseResult`.
6. Order stores `vendorId`, `vendorOrderReference`, and normalized status.
7. Customer sees Better Data order status only.

### Webhook

1. Vendor sends webhook to the Better Data vendor webhook endpoint.
2. API resolves the active vendor for v1.
3. Adapter normalizes the payload into a Better Data event.
4. API updates the order by `vendorOrderReference`.
5. Clients receive status updates through Convex.

## Routes

Keep public API routes vendor-neutral:

```txt
GET  /data-packages
POST /orders
GET  /orders/:reference/status
POST /webhooks/data-vendor
```

Avoid routes such as:

```txt
POST /webhooks/datamart
```

Vendor-specific validation and mapping belongs inside the active adapter.

## Shared Contracts

Move away from DataMart-named contracts in `packages/contracts`.

Current examples:

```ts
DataMartNetworkCode;
DataMartWebhookEvent;
```

Proposed examples:

```ts
NetworkCode;
DataVendorId;
VendorOrderStatus;
DataVendorWebhookEvent;
```

DataMart-specific request and response types should live under `apps/api/src/vendors/datamart` unless a client truly needs them. The frontend should not need them.

## Admin Later

For v1, active vendor configuration can stay environment-driven.

Later, admin can manage:

- available vendors
- active vendor
- per-network vendor assignment
- vendor health
- vendor balance
- fallback priority
- package sync status

This design avoids building that admin UI now while keeping the data model compatible with it.

## Multiple Vendors Later

The v1 resolver can later become a router.

For v1:

```ts
resolveVendorForPurchase() === getActiveDataVendor();
```

Later:

```ts
resolveVendorForPurchase({
  network,
  packageId,
  userRole,
  amountGhs
});
```

Routing rules can choose vendors by package, network, price, availability, priority, or health. Because packages and orders already store `vendorId`, this expansion should not require another core data-model rename.

## Error Handling

Vendor errors should be normalized before they leave the adapter.

Recommended vendor error codes:

```ts
"vendor_unavailable";
"package_unavailable";
"insufficient_vendor_balance";
"duplicate_request";
"invalid_recipient";
"unknown_vendor_error";
```

Customer-facing responses should use Better Data messaging, not raw provider errors.

## Testing Strategy

Focus tests on the adapter boundary:

- DataMart package mapping
- DataMart status mapping
- adapter error normalization
- active vendor resolution
- order route using the vendor interface instead of DataMart imports

This gives confidence that a future vendor can be added by implementing the same interface.

## Implementation Order

1. Add vendor-neutral contracts and internal network codes.
2. Add `apps/api/src/vendors` interface, registry, and active vendor resolver.
3. Move the current DataMart client into `vendors/datamart`.
4. Rename API route references from DataMart-specific to vendor-neutral.
5. Update Convex schema fields from provider/DataMart naming to vendor naming.
6. Update package and order routes to call the active vendor abstraction.
7. Add focused checks around mapping and active vendor selection.

