# Paystack Payment Gateway Design

## Goal

Better Data needs one secure payment core for Paystack collections that can support data purchases, wallet top-ups, and agent application fees without duplicating payment logic. Product amounts must come from Convex-managed configuration and package pricing, not from client-provided values or hardcoded constants.

## Recommended Architecture

Use a unified payment intent model with a `purpose` field. The payment core owns provider state, amount snapshots, references, webhook verification, transaction verification, and idempotent completion. Purpose-specific handlers run only after a payment has been verified as successful.

The first supported provider is Paystack. The design should keep provider-specific code behind an API integration boundary so another gateway can be added later without changing product workflows.

## Payment Purposes

The payment intent purpose controls which business action is completed after successful collection:

- `data_purchase`: collect direct Mobile Money payment for a data bundle, then place or release the fulfillment order.
- `wallet_top_up`: collect Mobile Money payment, credit the user's wallet, and create a wallet transaction.
- `agent_application_fee`: collect the configurable onboarding fee, create or update the agent application, and leave it pending admin review.

Each payment intent stores immutable snapshots of the resolved amount, currency, user or guest context, purpose metadata, Paystack reference, status, and timestamps. Amounts are resolved on the backend from Convex data before Paystack initialization.

## Configuration Source

Convex remains the source of truth for product configuration:

- `dataPackages` and `pricingRules` determine package prices.
- `platformConfig.minimumWalletTopUpGhs` determines the minimum wallet top-up amount.
- `platformConfig.agentOnboardingFeeGhs` determines the agent application fee.
- `platformConfig.firstPurchaseDiscountGhs` and `platformConfig.agentDiscountPercentage` affect purchase pricing where eligible.

Missing required payment configuration should fail closed. For example, an agent application payment should not initialize if the onboarding fee is absent or invalid.

## Data Flow

1. Client asks the backend to create a payment intent for a specific purpose.
2. Backend validates the actor, purpose payload, and eligibility rules.
3. Backend reads Convex configuration and resolves the final amount in GHS.
4. Backend creates a local payment intent with status `pending`.
5. Backend initializes Paystack server-side with the secret key, GHS amount in pesewas, a generated reference, and Mobile Money as the allowed channel.
6. Client receives only public checkout data such as `authorizationUrl`, `accessCode`, and `reference`.
7. Paystack sends a webhook to the API.
8. API verifies the webhook signature with `PAYSTACK_WEBHOOK_SECRET` or the configured secret material, then verifies the transaction with Paystack by reference.
9. If Paystack confirms success and the local intent is still pending, the API marks the payment as successful and runs the purpose-specific completion exactly once.
10. Convex state updates drive real-time client updates for orders, wallet balances, and agent application state.

## Security Design

Clients never send trusted amounts, provider secrets, or final payment status. Client payloads can identify intent purpose and user choices, but the backend recomputes price and eligibility from Convex.

Paystack API calls happen only in `apps/api`. The public key may be exposed to clients only when needed by Paystack UI, but secret keys and webhook secrets remain server-only environment variables.

Webhook handling must be defensive:

- Verify `x-paystack-signature` before parsing the event as trusted.
- Verify the transaction through Paystack before changing business state.
- Match the verified amount, currency, reference, and expected status against the local payment intent.
- Reject mismatched, duplicate, stale, or unknown references.
- Make completion idempotent so retries do not double-credit wallets, double-submit orders, or create duplicate agent applications.
- Log provider event IDs, references, and validation failures without logging secret keys or full sensitive payloads.

Order fulfillment should happen only after a verified successful payment or a confirmed wallet debit. Wallet debits and credits must be recorded with transaction rows and audit-friendly references.

## API Boundary

Add payment endpoints to the Fastify API:

- `POST /payments/intents` creates a payment intent and initializes Paystack.
- `GET /payments/intents/:reference` returns public-safe intent status.
- `POST /webhooks/paystack` receives signed Paystack events.

The API should expose typed request and response shapes through `packages/contracts` and `packages/api-client` so web and mobile do not build payment URLs by hand.

## Convex Boundary

Convex should own durable payment records and business state transitions:

- payment intents
- payment events
- wallet balance updates
- order records
- agent applications
- platform configuration
- audit logs

The API should use service-safe Convex functions for state changes. Functions that mutate payment, wallet, order, or agent state should enforce idempotency by Paystack reference and local intent ID.

## Initial Implementation Scope

The first implementation should scaffold the full secure payment core, but keep UI wiring minimal:

- Add shared payment contracts.
- Add Convex schema and mutations for payment intents, config reads, and idempotent completion.
- Implement Paystack initialize, verify, and webhook signature helpers.
- Add API routes for intent creation, status, and webhook receipt.
- Add API client helpers for web and mobile.
- Support purpose handlers for data purchase, wallet top-up, and agent application payments.
- Add focused tests for amount conversion, signature verification, reference matching, idempotency, and purpose-specific completion.

Admin UI for editing all configuration can follow after the backend contract exists, but the backend config keys and validation should be introduced now.

## Open Items

- Exact default values for minimum wallet top-up, agent onboarding fee, first-purchase discount, and agent discount percentage.
- Whether Paystack transaction fees are absorbed by Better Data or added to customer-facing prices.
- Whether failed guest data purchases should create a manual support queue entry after Paystack success and vendor failure.
