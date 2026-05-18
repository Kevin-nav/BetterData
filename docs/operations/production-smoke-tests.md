# Production Smoke Tests

Run these checks before putting real DataMart traffic through production.

## Environment

Required production domains:

```env
PUBLIC_APP_URL=https://betterdatagh.com
PUBLIC_ADMIN_URL=https://admin.betterdatagh.com
API_BASE_URL=https://api.betterdatagh.com
BETTERDATA_ACTIVE_DATA_VENDOR=datamart
QUEUE_PROVIDER=amqp
```

Required secrets:

```env
DATAMART_API_KEY=...
CLOUDAMQP_URL=...
WEBHOOK_SECRET=...
ADMIN_API_KEY=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

## CORS

Allowed:

```bash
curl -i https://api.betterdatagh.com/health \
  -H "Origin: https://betterdatagh.com"

curl -i https://api.betterdatagh.com/health \
  -H "Origin: https://admin.betterdatagh.com"
```

Rejected:

```bash
curl -i https://api.betterdatagh.com/health \
  -H "Origin: https://example.com"
```

## Admin Auth

Missing credentials must fail:

```bash
curl -i https://api.betterdatagh.com/admin/overview
```

Server admin key should pass:

```bash
curl -i https://api.betterdatagh.com/admin/overview \
  -H "X-Admin-Api-Key: $ADMIN_API_KEY"
```

## DataMart Readiness

Check packages:

```bash
curl -i https://api.betterdatagh.com/data-packages
```

Check admin balance:

```bash
curl -i https://api.betterdatagh.com/admin/overview \
  -H "X-Admin-Api-Key: $ADMIN_API_KEY"
```

Confirm the response includes `vendor.balanceGhs`, `vendor.balanceStatus`, and queue depth fields.

## Queue

Start API and worker separately:

```bash
pnpm --filter @betterdata/api start
pnpm --filter @betterdata/api start:worker
```

Confirm the worker logs:

```txt
Better Data worker started.
```

Check CloudAMQP/LavinMQ console for these queues:

- `orders.purchase.requested`
- `orders.purchase.retry`
- `orders.purchase.dead`
- `orders.status.refresh`

## Purchase Flow

Do not use this with a real customer number until the staging account is ready.

For Paystack orders, real verification must be implemented before production dispatch. If `ALLOW_UNVERIFIED_PAYSTACK_ORDERS=false`, this must fail safely with `402`:

```bash
curl -i -X POST https://api.betterdatagh.com/orders \
  -H "Content-Type: application/json" \
  -d '{"packageId":"datamart:yello-1gb","network":"mtn","recipientPhone":"0551234567","confirmRecipientIsCorrect":true,"paymentMethod":"paystack_momo"}'
```

Wallet/internal smoke test. This should fail unless wallet debit is implemented or `ALLOW_UNVERIFIED_WALLET_ORDERS=true` is set in a controlled staging environment:

```bash
curl -i -X POST https://api.betterdatagh.com/orders \
  -H "Content-Type: application/json" \
  -d '{"packageId":"datamart:yello-1gb","network":"mtn","recipientPhone":"0551234567","confirmRecipientIsCorrect":true,"paymentMethod":"wallet"}'
```

Expected when the controlled staging override is enabled:

- API returns `202`.
- Response reference starts with `BD-`.
- Queue depth increases briefly.
- Worker consumes the job.
- Admin order list shows vendor reference once DataMart accepts the order.

## Status Reconciliation

After a purchase returns a reference:

```bash
curl -i https://api.betterdatagh.com/orders/<BD_REFERENCE>/status
```

Expected:

- Pending order returns `pending`.
- Order with vendor reference checks DataMart status.
- Internal order status updates.

## Webhook Verification

Missing secret must fail:

```bash
curl -i -X POST https://api.betterdatagh.com/webhooks/data-vendor \
  -H "Content-Type: application/json" \
  -d '{}'
```

Secret header should pass verification:

```bash
curl -i -X POST https://api.betterdatagh.com/webhooks/data-vendor \
  -H "Content-Type: application/json" \
  -H "X-BetterData-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{"data":{"orderReference":"GN-TEST","status":"completed"}}'
```

## Failure Drills

1. Stop the worker, create a wallet/internal order, and confirm queue depth increases.
2. Restart the worker and confirm it drains the queue.
3. Force a bad DataMart key and confirm jobs retry/dead-letter rather than disappearing.
4. Lower `VENDOR_BALANCE_CRITICAL_GHS`/`LOW_GHS` around the current balance and confirm admin status changes.
5. Confirm admin page at `https://admin.betterdatagh.com/orders` renders without exposing raw phone numbers.
