# Better Data Architecture

## Applications

The codebase is a pnpm/Turborepo monorepo with four application surfaces:

- Customer web app in `apps/web`
- Admin web app in `apps/admin`
- Expo mobile app in `apps/mobile`
- Backend API in `apps/api`
- Convex backend functions in `convex`

## Shared Packages

- `packages/api-client` contains a shared typed client for public-safe API endpoints used by web and mobile.
- `packages/app-api` contains shared Convex function references so app code imports one stable package instead of reaching into generated files directly.
- `packages/contracts` contains user roles, network codes, order statuses, and request/response contracts.
- `packages/config` contains shared constants and environment access helpers.
- `convex/schema.ts` owns the operational data model.
- `packages/database` keeps repository contracts for service code that should not depend directly on storage implementation details.
- `packages/ui` contains shared design tokens and web UI primitives.

## Integration Boundaries

Convex owns app-facing data reads, writes, durable workflow records, and real-time updates. Web, mobile, and admin should use Convex through `packages/app-api` for shared product workflows.

The Node API owns direct calls to Paystack, Resend, Firebase Admin, and DataMartGH. Client apps should use Better Data-owned endpoints/functions only, so customers and agents never interact directly with DataMartGH. When clients need HTTP access, they should use `packages/api-client` instead of inline endpoint strings and `fetch` calls.

API side effects must write resulting state back to the same Convex deployment used by web and mobile. This keeps order status, package availability, wallet changes, and admin updates real-time across surfaces.

## Data Flow

1. Client selects a network, package, and recipient number.
2. Client creates or reads app workflow state through Convex.
3. API initializes a Paystack payment intent or debits wallet balance when private side effects are needed.
4. Paystack webhooks are verified by signature and transaction reference before Convex state changes.
5. API places fulfillment requests with DataMartGH using idempotency keys after successful collection.
6. DataMartGH webhooks update order status in Convex.
7. Web and mobile clients subscribe to Convex status updates from the same deployment.

## Payment Boundary

Payments use one core intent model with purpose-specific completion. The first gateway is Paystack, and the supported purposes are data purchase, wallet top-up, and agent application fee.

Convex owns configurable amounts and payment state. Package prices come from `dataPackages` plus active `pricingRules`; platform payment config lives in `platformConfig` with keys for minimum wallet top-up, agent onboarding fee, first-purchase discount, and agent discount percentage. Client apps never provide trusted final amounts.

The API owns Paystack secrets, transaction initialization, webhook signature checks, transaction verification, and vendor fulfillment after verified payment. Webhook processing is idempotent by Paystack reference so retries cannot double-credit wallets, double-create agent applications, or double-submit vendor purchases.

Guest data purchases are the only unauthenticated Paystack payment flow. Wallet top-ups, agent application fees, and logged-in purchases require Firebase auth, and the API derives ownership from the verified token instead of request body IDs. Guest checkout uses a generated Paystack email and treats the recipient phone as the fallback support contact. Optional Paystack payer phone is stored only when the provider returns it.

Payment telemetry uses OpenTelemetry and Honeycomb only when configured outside development. Telemetry uses keyed HMAC hashes for user and phone correlation and never sends raw PII, secrets, tokens, auth headers, or full provider payloads. Convex stores sanitized payment facts and durable ops alerts. Cloudflare R2 is the preferred future option for encrypted, short-retention raw provider payload archives if the business later needs dispute evidence storage.

Payment failure recovery is alert-driven. `opsAlerts` records capture suspicious webhooks, config issues, and downstream failures after verified payments. Retry schedules are stored as metadata: data fulfillment retries use 1m, 5m, 15m, 30m, and 1h delays; wallet and agent completion retries use 30s, 2m, 5m, 15m, and 30m delays. Final retry failure escalates the alert to critical for manual admin handling.

## Environment Contract

- `NEXT_PUBLIC_API_BASE_URL` points the web app at the API service.
- `EXPO_PUBLIC_API_BASE_URL` points the Expo app at the API service.
- `NEXT_PUBLIC_CONVEX_URL` points the web app at Convex.
- `EXPO_PUBLIC_CONVEX_URL` points the Expo app at the same Convex deployment.
- `CONVEX_DEPLOYMENT` and server-side Convex variables are required for codegen, deploys, and service-side writes.
