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
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
WEBHOOK_SECRET=...
ADMIN_API_KEY=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
BETTERDATA_SERVICE_SECRET=...
CONVEX_URL=...
CONVEX_API_SECRET=...
```

Required GitHub bootstrap and public build-time values:

```env
INFISICAL_CLIENT_ID=...
INFISICAL_CLIENT_SECRET=...
INFISICAL_PROJECT_ID=...
INFISICAL_ENVIRONMENT=prod
INFISICAL_SECRET_PATH=/
NEXT_PUBLIC_API_BASE_URL=https://api.betterdatagh.com
NEXT_PUBLIC_CONVEX_URL=...
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
CLOUDFLARED_TOKEN=...
```

## Deployment

Automatic deploy:

1. Push to `master`.
2. Confirm `Build and Push Web` succeeds.
3. Confirm `Build and Push API` succeeds.
4. Confirm `Deploy Platform` runs on the self-hosted k3s runner.
5. Confirm the workflow synced Infisical secrets, applied manifests, rolled out
   web/API, and passed smoke checks.

Manual deploy:

```bash
gh workflow run "Deploy Platform" \
  -f api_image_tag=master \
  -f web_image_tag=master \
  -f environment=production
```

Cluster rollout checks:

```bash
kubectl -n betterdata rollout status deployment/betterdata-web --timeout=300s
kubectl -n betterdata rollout status deployment/betterdata-api --timeout=300s
kubectl -n betterdata get pods -l app.kubernetes.io/part-of=betterdata
```

Rollback if production smoke checks fail:

```bash
kubectl -n betterdata rollout undo deployment/betterdata-web
kubectl -n betterdata rollout undo deployment/betterdata-api
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

Confirm KEDA is installed:

```bash
kubectl get ns keda
kubectl get crd scaledobjects.keda.sh
kubectl -n keda rollout status deployment/keda-operator --timeout=180s
kubectl -n keda rollout status deployment/keda-operator-metrics-apiserver --timeout=180s
kubectl -n keda rollout status deployment/keda-admission-webhooks --timeout=180s
kubectl -n betterdata get scaledobject betterdata-worker
kubectl -n betterdata describe scaledobject betterdata-worker
```

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
- `orders.status.refresh.retry`

## Upstash Redis

Confirm the API starts with production Redis settings. If either Upstash REST env var is missing, startup should fail fast.

Check admin metrics through the overview endpoint after running package and queue checks:

```bash
curl -i https://api.betterdatagh.com/admin/overview \
  -H "X-Admin-Api-Key: $ADMIN_API_KEY"
```

Expected:

- Response includes `metrics`.
- Repeated DataMart package/balance checks should not call DataMart on every request while cache TTLs are active.

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
