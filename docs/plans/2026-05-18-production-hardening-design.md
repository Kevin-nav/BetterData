# Production Hardening Design

## Goal

Prepare Better Data for real DataMart purchases on `api.betterdatagh.com` by locking down public surfaces, persisting order state, moving vendor calls into a durable LavinMQ-backed queue, and giving admins enough operational visibility to handle failures safely.

## Domains

Production uses three public domains:

- `https://betterdatagh.com` for the customer app.
- `https://admin.betterdatagh.com` for admin operations.
- `https://api.betterdatagh.com` for the API.

The API should allow browser CORS requests only from the customer and admin domains in production. Local development may allow localhost origins.

## Security Boundary

The API currently exposes useful routes without enough access control. Before real vendor credentials are used in production:

- `/admin/*` must require authenticated admin access.
- `/dev/vendor-simulation/*` must be disabled in production or require an explicit dev token outside production.
- `/orders` must validate the request at runtime and rate-limit inbound traffic.
- `/orders/:reference/status` must prevent unlimited polling.
- `/webhooks/data-vendor` must verify a DataMart signature if available, or a shared secret header/token if DataMart does not provide signing.

Admin app access should use Firebase identity and a server-side role check against the app user record. The API should reject admin requests unless the caller is an admin. Service-to-service calls from the admin app to the API may use a short-lived Firebase ID token or a server-only admin API key, but browser-exposed static secrets must not be used.

## Order Lifecycle

Vendor purchase calls should not happen directly inside the public request/response path. The safe lifecycle is:

1. Receive purchase request.
2. Validate phone number, network, package, payment method, and confirmation.
3. Confirm payment or wallet availability.
4. Create an internal order as `pending`.
5. Store an idempotency key for the logical purchase.
6. Publish a durable purchase job.
7. Return the internal order reference to the client.
8. A worker consumes the job and calls DataMart.
9. The worker stores vendor reference, vendor raw response, and latest status.
10. Webhook or status reconciliation moves the order to `completed`, `failed`, or `refunded`.

This protects orders from API restarts, DataMart timeouts, and duplicate retries.

## Queue Choice

Use CloudAMQP LavinMQ Loyal Lemming for the first production queue. It gives AMQP 0-9-1 semantics on a managed perpetual free tier and enough capacity for early traffic. The code should hide LavinMQ behind an internal queue interface so a later move to RabbitMQ quorum queues or a paid dedicated broker does not rewrite order logic.

Initial queues:

- `orders.purchase.requested`: durable purchase jobs.
- `orders.purchase.retry`: delayed retries after rate limits, `5xx`, timeouts, and in-progress responses.
- `orders.purchase.dead`: dead-letter jobs after retry exhaustion.
- `orders.status.refresh`: status reconciliation jobs for processing orders.

Workers should acknowledge messages only after the internal order state is safely updated.

## DataMart Dispatch

The existing DataMart dispatcher can remain the purchase execution engine, but it should run inside the worker instead of the route. It should still choose between `/purchase` and `/bulk-purchase` based on traffic and rate-limit headroom.

When a queue message is retried, it must keep the same logical idempotency key. If DataMart times out after accepting a purchase, retrying with a new idempotency key can double-charge. The order record is the source of truth for the key.

## Admin Operations

The admin dashboard should grow from balance cards into an operations surface:

- Vendor balance and low/critical status.
- Order list with filters for `pending`, `processing`, `completed`, `failed`, and `refunded`.
- Stuck processing orders.
- Failed orders.
- Vendor reference search.
- Manual status refresh/reconcile action.
- Retry eligible failed jobs.
- Dead-letter queue count.
- Balance alert history.

Admin actions that can affect money or vendor calls should be audited with actor, timestamp, target order, and action result.

## Payment Safety

Real vendor purchases should only happen after payment safety is clear:

- Guest Paystack payment must be verified before queueing a vendor purchase.
- Wallet purchases must atomically reserve or debit wallet funds before queueing.
- A paid order must not create more than one vendor purchase.
- If vendor purchase fails after payment, the app needs a refund, reversal, or manual review path.
- Ambiguous vendor responses should move orders to an admin review state rather than silently failing.

## Observability

Every order-related log should carry stable fields:

- `orderId`
- `orderReference`
- `vendorId`
- `vendorOrderReference`
- `idempotencyKey`
- `queueMessageId`
- `attempt`

Track at minimum:

- queue depth
- dead-letter count
- purchase job age
- DataMart balance
- DataMart rate-limit remaining/reset
- purchase success/failure counts
- webhook received/failed counts
- order status reconciliation lag

Start with structured logs and admin counters. Move to metrics and alerting as traffic grows.

## Configuration

Production environment should include:

```env
PUBLIC_APP_URL=https://betterdatagh.com
PUBLIC_ADMIN_URL=https://admin.betterdatagh.com
API_BASE_URL=https://api.betterdatagh.com
BETTERDATA_ACTIVE_DATA_VENDOR=datamart
DATAMART_API_KEY=
CLOUDAMQP_URL=
WEBHOOK_SECRET=
VENDOR_BALANCE_LOW_GHS=200
VENDOR_BALANCE_CRITICAL_GHS=50
```

Local development should keep sandbox vendor defaults and allow local origins only outside production.

## Rollout Order

1. Security lockdown.
2. Order persistence and idempotency.
3. Queue abstraction and LavinMQ provider.
4. Worker-based DataMart purchase execution.
5. Webhook verification and reconciliation.
6. Admin operations views.
7. Payment safety completion.
8. Observability and alerting.
