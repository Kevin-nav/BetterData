# Payment Security Hardening Design

## Goal

Harden the Paystack payment foundation so Better Data can safely support guest data purchases, authenticated wallet top-ups, authenticated agent application payments, operational telemetry, and recovery from payment-related failures.

## Auth Boundaries

Guest data purchases remain unauthenticated. Guests provide only the recipient phone number needed for fulfillment. The system uses that recipient phone as the fallback support contact. The API generates a Paystack-compatible placeholder email for guest checkout, such as `guest+<reference>@betterdatagh.com`, so guest checkout does not ask for an email.

Wallet top-ups, agent application payments, and logged-in data purchases require Firebase authentication. The API must derive the user from the Firebase bearer token and matching Convex user record. Clients must not send trusted `userId` values for payment ownership.

If a logged-in Firebase user has an email, the API uses it for Paystack initialization. If not, the API generates a placeholder email tied to the user/payment reference.

Paystack payer phone is optional provider data. If Paystack returns a payer phone during verification, store it as a sanitized optional field. Do not depend on it for core workflows.

## Provider Verification

Paystack webhook signature verification must use `PAYSTACK_SECRET_KEY`, matching Paystack's documented `x-paystack-signature` HMAC behavior. `PAYSTACK_WEBHOOK_SECRET` should be removed or treated only as a deprecated compatibility alias.

Every webhook is treated as untrusted until the API verifies the transaction directly with Paystack. Business state changes require all of the following to match:

- Paystack reference
- status `success`
- currency `GHS`
- expected amount in integer pesewas
- local payment intent that is pending or initialized

Payment completion mutations should be internal or service-protected. Client-accessible Convex functions must never be able to mark payments successful, credit wallets, or complete agent applications.

## Expiry and Paystack Timeout

Payment expiry must be coordinated with Paystack's session timeout. The API should read Paystack's live payment session timeout for diagnostics and compare it to Convex config.

Initial config:

- `paymentIntentExpirySeconds`: `1800`
- grace period: `300` seconds

The system should not abandon an unpaid intent until Paystack timeout plus grace has elapsed. A verified late success should still be honored unless the payment was manually voided or refunded.

Timeout mismatch should not block payment creation at first. It should create admin-visible warnings and structured logs. Production readiness can report warning status for mismatch, but hard failures should be reserved for missing secrets, missing required config, Paystack API unreachability during diagnostics, or webhook verification being impossible.

## Config

Convex remains the source of truth for payment config.

Initial defaults:

- `minimumWalletTopUpGhs`: `10`
- `maximumWalletTopUpGhs`: `500`
- `paymentIntentExpirySeconds`: `1800`

Fail-closed config:

- `agentOnboardingFeeGhs` has no default. Agent application payment creation is blocked until an admin configures it.

Discount defaults:

- `firstPurchaseDiscountGhs` behaves as `0` when missing.
- `agentDiscountPercentage` behaves as `0` when missing.

Fees:

Better Data will not add custom fee markup now. Paystack fee handling remains Paystack-owned. Payment intents should still store business amount and verified provider amount separately so reconciliation remains clear.

## Telemetry

Use OpenTelemetry in `apps/api` and export to Honeycomb only when configured for non-development environments.

Telemetry is enabled only when:

- `NODE_ENV !== "development"`
- `HONEYCOMB_API_KEY` is present

When Honeycomb is enabled, `TELEMETRY_HASH_SECRET` is required. The API sends keyed HMAC SHA-256 hashes for identifiers that need correlation:

- user IDs or Firebase UIDs
- recipient phone numbers
- optional Paystack payer phone

Do not send raw phone numbers, emails, Firebase tokens, Paystack secret keys, auth headers, or full raw provider payloads to Honeycomb.

For now, store sanitized provider/payment fields in Convex and structured telemetry events in Honeycomb. Later, consider Cloudflare R2 for encrypted, short-retention raw provider payload archives if dispute or compliance needs justify it.

## Ops Alerts

Add admin-visible operational alerts for payment and fulfillment failures. Alerts should be durable Convex records, independent from telemetry.

Alert triggers include:

- Paystack signature failure spike or suspicious webhook
- unknown Paystack reference
- amount or currency mismatch
- verified payment success with no matching local intent
- duplicate or replay-like webhook behavior
- vendor fulfillment failure after verified payment success
- wallet credit failure after verified payment success
- agent application completion failure after verified payment success
- Paystack timeout mismatch

Alert fields should include severity, status, category, payment reference, message, sanitized metadata, timestamps, and retry metadata.

## Retries

Automatic retries should handle downstream failures after verified successful payment. All retry actions must be idempotent by payment reference.

Data fulfillment retry schedule:

- `1m`
- `5m`
- `15m`
- `30m`
- `1h`

Wallet top-up and agent application retry schedule:

- `30s`
- `2m`
- `5m`
- `15m`
- `30m`

Each failure opens an alert immediately as `warning`. After the final failed attempt, the alert escalates to `critical` and remains open for manual admin handling.

Convex should own durable alert/retry state. The API should own external side effects that require provider or vendor secrets. Internal Convex actions can schedule retry attempts and call API-owned retry endpoints where private external integrations are required.
