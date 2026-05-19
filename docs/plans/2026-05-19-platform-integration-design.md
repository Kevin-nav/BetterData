# Platform Integration Design

## Goal

Integrate payments, data purchases, Redis caching, queue workers, Firebase authentication, deployment, and secret management into one coherent production workflow.

## Recommended Approach

Use queue-centered fulfillment. Paystack webhooks verify and record successful payment state, then enqueue purchase fulfillment. Workers are the only process that calls DataMart for purchases.

This keeps paid guest purchases, logged-in purchases, wallet purchases, retries, dead letters, queue metrics, and operational recovery on the same path.

## Architecture

Convex remains the durable source of truth for users, roles, payment intents, orders, wallet transactions, platform config, retry alerts, and app-facing reads.

The Fastify API owns private integrations: Paystack, Firebase Admin, DataMart, Resend, Redis, AMQP, webhooks, and internal service endpoints.

AMQP owns durable background work. Upstash Redis owns shared cache, metrics, rate-limit helpers, and short-lived coordination. Redis must not be the only store for payments, orders, wallet transactions, users, or retry state.

## Payment And Data Purchase Flow

1. Client creates a payment intent through `POST /payments/intents`.
2. API verifies Firebase auth when the payment purpose requires a user.
3. Convex calculates trusted amount and stores the payment intent.
4. Paystack webhook reaches `POST /webhooks/paystack`.
5. API verifies Paystack signature and verifies the transaction by reference.
6. Convex marks the payment intent succeeded and creates or links the order.
7. API enqueues `orders.purchase.requested` with the order reference and Paystack reference as the idempotency key.
8. Worker consumes the job, calls DataMart, and writes vendor result back to Convex.
9. Clients and admin surfaces read status from Convex.

The webhook should not call DataMart directly. If enqueue fails after successful payment, the API should create a retryable ops alert and return a failure so Paystack can retry the webhook.

## Redis Cache Design

Use Upstash Redis for shared API and worker cache:

- DataMart packages by vendor and network, around 300 seconds.
- Vendor balance, around 30 seconds.
- Delivery or status tracker lookups, around 60 seconds.
- DataMart rate-limit or headroom hints, around 15 to 30 seconds.
- Metrics counters and short-lived admin overview snapshots.
- Single-flight locks so many requests cannot stampede DataMart refreshes.

Convex should store curated package records and customer-facing prices. Redis should reduce DataMart reads, not decide billing. Payment amounts must still be resolved from Convex during payment intent creation.

## Lazy Fetch Policy

Do not run scheduled DataMart package refresh by default.

Public site visits should read cached or last-known package data. Expensive DataMart reads should happen only when:

- Redis cache is missing and no Convex fallback is available.
- A user starts checkout or creates a payment intent.
- An admin explicitly requests refresh.
- A worker needs vendor status after a real purchase.

Package refresh attempts should be globally and per-IP rate-limited through Redis. Checkout should require recipient confirmation and normal API rate limits before any stricter vendor freshness checks.

## Queue And Worker Design

Production must use AMQP. Local development can keep the local queue provider.

Workers consume purchase and status jobs. Purchase workers perform DataMart fulfillment and persist results to Convex. Retry and dead-letter behavior should stay in the worker and queue layer, with durable escalation recorded in Convex `opsAlerts`.

KEDA should scale workers from zero based on AMQP queue depth. This keeps worker compute idle when no one is buying.

## Scale Policy

Production should keep:

- API minimum replicas at 1 for Paystack and DataMart webhook reliability.
- Public web minimum replicas at 1 for customer responsiveness.
- Worker minimum replicas at 0 with KEDA queue-depth scaling.
- No cron loops or scheduled refresh jobs by default.

Staging and development can test API scale-to-zero, but production payment webhooks should not depend on cold starts until webhook timing has been verified.

## Authentication And Authorization

Firebase is the identity provider. Convex remains the user and role source.

Client apps should use Firebase client SDK login, then pass Firebase ID tokens as `Authorization: Bearer <token>` to protected API endpoints.

Allowed guest surfaces:

- Public package reads.
- Payment status by reference.
- Guest data-purchase payment intent creation.

Authenticated user surfaces:

- Wallet top-up.
- Wallet purchase.
- Saved numbers.
- User order history.
- Profile.
- Agent application.

Admin surfaces:

- Admin APIs.
- Retry controls.
- Diagnostics.
- Vendor balance and queue views.
- Alerts and operational dashboards.

Service-only surfaces should require `BETTERDATA_SERVICE_SECRET` or the existing internal service header pattern.

API and Convex code must derive user ownership from verified Firebase identity, never from request body user IDs.

## Secret Management

Use Infisical for runtime secrets:

- Paystack secret and public keys.
- Firebase Admin project ID, client email, and private key.
- DataMart API key and webhook secret.
- CloudAMQP URL.
- Upstash Redis REST URL and token.
- Resend API key.
- Convex service/API secrets.
- Honeycomb and telemetry hash secrets.
- Better Data internal service secret.

Use GitHub secrets for build and deployment bootstrap only:

- Public build-time variables such as `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_CONVEX_URL`.
- Infisical machine identity or token used by CI/deploy.
- GHCR credentials if needed.
- Cloudflare tunnel token if it cannot be pulled through Infisical at deploy time.

Kubernetes should receive runtime secrets from Infisical during deploy or through an Infisical operator. Do not write `.env` files on the VPS.

## Deployment Work

Add production deployment support for:

- API deployment and service.
- Worker deployment.
- Admin deployment if it is deployed separately from web.
- KEDA ScaledObject for worker queue depth.
- Runtime secret sync from Infisical.
- Health, readiness, and liveness probes.
- Production smoke tests covering API, worker, queue, Redis, Paystack webhook, DataMart cache, and Firebase auth.

## Testing Strategy

Add focused tests for:

- Paystack success enqueues exactly one fulfillment job.
- Repeated Paystack webhook does not duplicate orders or vendor jobs.
- Enqueue failure after payment success creates retryable ops alert.
- Worker fulfills paid orders through the same path as wallet/internal purchases.
- Redis package cache serves hits and uses single-flight refresh on misses.
- Public browsing does not trigger DataMart refresh when Convex fallback exists.
- Checkout path can request stricter package freshness.
- Firebase auth is required for protected routes and optional for guest data purchase.
- Admin routes reject non-admin users.
- KEDA manifests target the correct AMQP queue and worker deployment.

## Open Implementation Notes

The current repo already has most primitives: Fastify routes, Firebase Admin verification, Convex payment/order state, Upstash Redis helpers, AMQP queue provider, purchase worker, and production smoke docs.

The main implementation work is to remove the remaining split between Paystack webhook fulfillment and queued fulfillment, then finish deployment/runtime wiring for API, worker, Infisical, and KEDA.
