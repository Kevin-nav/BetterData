# DataMart Live Rollout

## Vendor Mode

Keep local development on a sandbox vendor unless you intentionally want to spend real vendor balance:

```env
BETTERDATA_ACTIVE_DATA_VENDOR=sandbox-fast
```

Use the real DataMart API in staging or production:

```env
BETTERDATA_ACTIVE_DATA_VENDOR=datamart
DATAMART_BASE_URL=https://api.datamartgh.shop/api/developer
DATAMART_API_KEY=...
```

## Rate-Limit Controls

DataMart documents 120 purchase requests per minute and 150 general API requests per minute. Better Data protects the purchase limit with a smart dispatcher:

- Low traffic uses `POST /purchase` immediately.
- Burst traffic queues briefly and flushes `POST /bulk-purchase`.
- Bulk batches send up to 50 orders.
- Low DataMart `rateLimit.remaining` forces batch mode.
- Timeouts and 5xx retries reuse the same idempotency key.

Recommended conservative starting values:

```env
DATAMART_REQUEST_TIMEOUT_MS=15000
DATAMART_RETRY_COUNT=1
DATAMART_PURCHASE_BATCH_WINDOW_MS=5000
DATAMART_PURCHASE_BURST_WINDOW_MS=30000
DATAMART_PURCHASE_BURST_THRESHOLD=20
DATAMART_LOW_RATE_LIMIT_REMAINING_THRESHOLD=20
QUEUE_PROVIDER=amqp
CLOUDAMQP_URL=amqps://...
QUEUE_PREFETCH=5
```

Lower `DATAMART_PURCHASE_BURST_THRESHOLD` if DataMart starts returning rate-limit responses. Raise it only after observing stable headroom.

## Smoke Test

Start the API:

```bash
pnpm --filter @betterdata/api dev
```

Check packages:

```bash
curl http://localhost:4000/data-packages
```

Create a purchase:

```bash
curl -X POST http://localhost:4000/orders \
  -H "Content-Type: application/json" \
  -d '{"packageId":"yello-1gb","network":"mtn","recipientPhone":"0551234567","confirmRecipientIsCorrect":true,"paymentMethod":"wallet"}'
```

Check returned status:

```bash
curl http://localhost:4000/orders/<reference>/status
```

## Monitoring

Watch API logs for:

- DataMart HTTP 429 responses.
- DataMart 5xx or timeout responses.
- `DataMart bulk response did not include result` errors.
- Insufficient DataMart wallet balance.
- purchase queue depth and dead-letter depth in the admin overview.

Do not retry a purchase with a new idempotency key after a timeout. Retry with the same logical request key or rely on the API dispatcher retry path.

## Admin Balance Alerting

The admin overview calls the active vendor balance endpoint and classifies DataMart balance with:

```env
VENDOR_BALANCE_LOW_GHS=200
VENDOR_BALANCE_CRITICAL_GHS=50
```

The admin dashboard shows `healthy`, `low`, `critical`, or `unknown`. `unknown` means the balance check failed and should be investigated before assuming the vendor wallet is funded.
