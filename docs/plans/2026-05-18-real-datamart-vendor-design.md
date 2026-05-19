# Real DataMart Vendor Design

## Goal

Replace the DataMart-shaped fake transport with real DataMart API calls while keeping sandbox vendors available only as explicit development and test modes.

## Current State

The API already has a vendor boundary in `apps/api/src/vendors/types.ts`. The `datamart` vendor is registered in `apps/api/src/vendors/registry.ts`, but `apps/api/src/vendors/datamart/client.ts` currently calls `fakeTransport.ts` instead of DataMart over HTTP. Sandbox vendors are useful for local simulation, but they should no longer be the live path.

## DataMart Limits

DataMart documents these limits:

- API key generation: 200 requests per minute.
- General API: 150 requests per minute.
- Purchases: 120 requests per minute.
- Bulk purchase: up to 50 orders per request.

Every response includes rate limit metadata in a `rateLimit` object and also exposes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. Purchase and bulk purchase endpoints support `X-Idempotency-Key`; retries after timeouts or 5xx responses must reuse the same key.

## Recommended Approach

Use a hybrid smart dispatcher.

At low traffic, a purchase should call DataMart `/purchase` immediately. When traffic rises or DataMart-reported purchase headroom drops, new purchases should enter a short batching window and flush through `/bulk-purchase`. This keeps normal purchases fast and makes burst traffic safer.

The dispatcher should choose bulk mode when any of these conditions are true:

- More than a configurable number of purchases arrived in the last 30 seconds.
- DataMart reports low remaining purchase capacity.
- There is already more than one compatible order waiting in the queue.
- The queue reaches the 50-order bulk limit, which triggers immediate flush.

## Architecture

Create a real DataMart HTTP transport for documented endpoints:

- `GET /data-packages`
- `POST /purchase`
- `POST /bulk-purchase`
- `GET /order-status/:reference`
- `GET /balance`
- `GET /delivery-tracker`

The transport owns base URL, API key headers, JSON parsing, response validation, error mapping, timeout handling, retry classification, and rate-limit metadata extraction.

Create a purchase dispatcher used by `createDataMartVendor().purchase()`. The dispatcher returns a `VendorPurchaseResult` per Better Data purchase, even when DataMart receives a bulk request. In bulk mode, each order should use the DataMart `ref` field to preserve our internal idempotency key or logical reference so results can be matched back to waiting callers.

Keep the public Better Data routes stable. `POST /orders` continues calling `vendor.purchase()`, and `GET /orders/:reference/status` continues calling `vendor.getOrderStatus()`.

## Idempotency And Retries

Single purchases use one fresh `X-Idempotency-Key` per logical purchase. Bulk purchases use one fresh `X-Idempotency-Key` per batch. If a timeout or 5xx occurs, retry only with the same idempotency key.

If DataMart returns `409 REQUEST_IN_PROGRESS`, do not create a new idempotency key. Treat the order as processing and prefer a follow-up status lookup by reference when available.

## Rate-Limit Strategy

Maintain two signals:

- Local traffic history over a rolling 30-second window.
- Vendor-reported rate limit state from response bodies and headers.

Default behavior should stay below DataMart's 120 purchases per minute limit. When remaining capacity is near zero, delay flushes until `resetInSeconds` has passed. Package, balance, status, and delivery-tracker calls should be cached or throttled separately so they do not compete with purchase capacity unnecessarily.

## Error Handling

Map DataMart failures into stable vendor errors:

- Insufficient wallet balance.
- Invalid recipient or package validation failure.
- Duplicate or in-progress idempotency key.
- Rate limited.
- Vendor unavailable.
- Malformed vendor response.

API routes should log the raw vendor context server-side and return safe, stable 4xx or 5xx responses to clients.

## Configuration

Use environment variables:

- `BETTERDATA_ACTIVE_DATA_VENDOR=datamart` for the live DataMart path.
- `DATAMART_BASE_URL=https://api.datamartgh.shop/api/developer` by default.
- `DATAMART_API_KEY` for authentication.
- Optional dispatcher controls for batch window, burst threshold, low remaining threshold, request timeout, and retry count.

Sandbox vendors remain registered for local development and explicit test scenarios only.

## Testing

Add focused tests for:

- HTTP request construction and headers.
- DataMart response mapping.
- Rate-limit metadata extraction from body and headers.
- Single purchase path.
- Bulk purchase path.
- Dispatcher switching from single to bulk during bursts.
- Retry behavior with idempotency preserved.
- Error mapping for insufficient balance, rate limits, and malformed responses.

Use fake fetch implementations for deterministic transport tests. Keep the existing sandbox checks.
