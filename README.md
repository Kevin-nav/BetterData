# Better Data

Better Data is a Ghana-focused data bundle reselling platform for MTN, Telecel, and AirtelTigo. This repository is structured as a TypeScript monorepo with customer web, admin web, Expo mobile, API, and shared packages.

## Workspace

- `apps/web` - customer-facing Next.js app for `betterdatagh.com`
- `apps/admin` - secured Next.js admin app for `admin.betterdatagh.com`
- `apps/mobile` - Expo React Native app for Android and iOS
- `apps/api` - Node.js TypeScript backend API
- `convex` - Convex schema, queries, mutations, and HTTP functions
- `packages/api-client` - shared typed client for public-safe API endpoints
- `packages/app-api` - shared Convex function references for web, mobile, admin, and services
- `packages/contracts` - shared domain types and API contracts
- `packages/config` - shared runtime constants and environment helpers
- `packages/database` - database schema and persistence boundary
- `packages/ui` - shared UI primitives and design tokens

## Getting Started

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Fill in Firebase, Paystack, Resend, data vendor, and database credentials in `.env.local` before integrating live services.

For admin development with Convex running beside Next.js:

```bash
pnpm dev:admin
```

This runs `pnpm convex:dev` and `pnpm --filter @betterdata/admin dev` together. The admin app loads local env from the workspace root and exposes `CONVEX_URL` to the browser as `NEXT_PUBLIC_CONVEX_URL`, so keep only `CONVEX_URL` in the root `.env.local` for Convex.

## Data Vendor Modes

Local development can run without real vendor API calls:

- `sandbox-fast` completes purchases immediately.
- `sandbox-delayed` keeps purchases processing for 30 minutes, or 60 minutes when the recipient phone ends in `60`.
- `sandbox-flaky` fails purchases after about 2 minutes when the recipient phone ends in `99`.
- `datamart` calls the real DataMartGH API and requires `DATAMART_API_KEY`.

Set `BETTERDATA_ACTIVE_DATA_VENDOR` in `.env`. Keep a sandbox vendor for local development, and use `datamart` in staging or production after configuring DataMart credentials.

The real DataMart mode uses immediate single purchases at low traffic and switches to bulk purchase batches during bursts or when DataMart reports low rate-limit headroom. See `docs/operations/datamart-rollout.md` for rollout settings and smoke tests.

## Shared Backend Boundary

Web, mobile, and admin should share one app-facing backend contract:

- Use `packages/app-api` for Convex function references.
- Use Convex for app state, app workflows, and real-time subscriptions.
- Use `packages/api-client` when a client must call a public-safe HTTP endpoint.
- Keep private integrations in `apps/api`: Paystack, Resend, Firebase Admin, data vendors, webhooks, and operational jobs.
- Have API side effects write state back to the same Convex deployment so clients receive real-time updates.

Client apps should point to the same Convex deployment for a given environment. In local Next.js development, derive public client values from the root `CONVEX_URL` instead of adding extra root keys ending in `CONVEX_URL`, because the Convex CLI expects to manage a single root deployment URL.

## Paystack Payments

The API exposes a unified payment intent flow for Paystack Mobile Money:

- `POST /payments/intents` initializes checkout for data purchases, wallet top-ups, and agent application fees.
- `GET /payments/intents/:reference` returns public-safe payment status.
- `POST /webhooks/paystack` receives Paystack webhooks.

Configure the Paystack dashboard webhook URL as:

```text
https://<api-domain>/webhooks/paystack
```

The API verifies the Paystack webhook signature with `PAYSTACK_SECRET_KEY` and then verifies the transaction by reference before any Convex state changes. Convex owns configurable amounts through `platformConfig`: `minimumWalletTopUpGhs`, `agentOnboardingFeeGhs`, and `agentDiscountPercentage`.

Guest data purchases do not require Firebase auth and do not ask for guest email. The API generates a placeholder Paystack email and uses the recipient phone as the guest fallback support contact. Wallet top-ups, agent application payments, and logged-in purchases require Firebase auth; the API derives payment ownership from the verified Firebase token.

Payment operations create durable `opsAlerts` records for suspicious webhooks and post-payment failures. Retry metadata is stored with the alert so fulfillment, wallet credit, and agent completion retries can be automated and escalated to admins.

Production telemetry can be sent to Honeycomb through OpenTelemetry. Set `HONEYCOMB_API_KEY` and `TELEMETRY_HASH_SECRET` outside development to enable it. Telemetry sends keyed hashes for user and phone correlation, not raw PII, secrets, auth headers, or full provider payloads.

Full raw Paystack payload archiving is intentionally out of scope for now. If dispute or compliance needs require it later, use an encrypted short-retention store such as Cloudflare R2 rather than Convex or Honeycomb.

## Landing Quick Purchase

The homepage quick purchase widget uses `@betterdata/api-client` for the guest purchase simulation:

- `GET /data-packages` loads packages from the active data vendor.
- `POST /orders` places a simulated guest order.
- `GET /orders/:reference/status` refreshes the returned order status.

Set `NEXT_PUBLIC_API_BASE_URL` for the web app and `EXPO_PUBLIC_API_BASE_URL` for the mobile app. For local development these usually point at `http://localhost:4000`. For Docker and production builds, public variables must be available at build time because Next.js and Expo inline their public environment variables into client bundles.

## Convex

This repo includes a root-level `convex/` backend scaffold. Since you already have a remote Convex project, link this repo to it from the repository root:

```bash
pnpm install
pnpm convex:dev
```

When prompted, choose the existing Convex project. The CLI writes `CONVEX_DEPLOYMENT` and the deployment URL into `.env.local`, and generates `convex/_generated`. Keep `CONVEX_URL` as the single root Convex URL; app-specific configs can map it to public client env names when needed.

`convex/auth.config.ts` also needs `FIREBASE_PROJECT_ID` available in the Convex deployment environment. Set it in the Convex dashboard for the active deployment before running `pnpm convex:dev`; otherwise Convex will stop before bundling functions.

Admin authorization is role-based. Set `ADMIN_SUPERADMIN_EMAILS` in local/API/Convex environments to bootstrap the first superadmin accounts; after those users sign in, their Convex user records are upgraded to `superadmin`. Promoted `admin` and `superadmin` roles are then honored by both Convex functions and API-backed admin routes.

For production:

```bash
pnpm convex:deploy
```

## Architecture Notes

The PRD calls for web, mobile, and admin clients sharing one backend. Convex owns the real-time database and app-facing functions, while the Node API remains the integration boundary for Paystack, Resend, Firebase Admin, and data vendor calls. Shared packages keep network codes, order statuses, user roles, and provider-facing contracts consistent across all apps.
