# Better Data

Better Data is a Ghana-focused data bundle reselling platform for MTN, Telecel, and AirtelTigo. This repository is structured as a TypeScript monorepo with customer web, admin web, Expo mobile, API, and shared packages.

## Workspace

- `apps/web` - customer-facing Next.js app for `betterdatagh.com`
- `apps/admin` - secured Next.js admin app for `admin.betterdatagh.com`
- `apps/mobile` - Expo React Native app for Android and iOS
- `apps/api` - Node.js TypeScript backend API
- `convex` - Convex schema, queries, mutations, and HTTP functions
- `packages/contracts` - shared domain types and API contracts
- `packages/config` - shared runtime constants and environment helpers
- `packages/database` - database schema and persistence boundary
- `packages/ui` - shared UI primitives and design tokens

## Getting Started

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env` and fill in Firebase, Paystack, Resend, data vendor, and database credentials before integrating live services.

## Data Vendor Simulation

Local development can run without real vendor API calls:

- `sandbox-fast` completes purchases immediately.
- `sandbox-delayed` keeps purchases processing for 30 minutes, or 60 minutes when the recipient phone ends in `60`.
- `sandbox-flaky` fails purchases after about 2 minutes when the recipient phone ends in `99`.
- `datamart` uses DataMart-shaped fake responses for now; real HTTP is intentionally disabled until credentials and production readiness are confirmed.

Set `BETTERDATA_ACTIVE_DATA_VENDOR` in `.env`.

## Landing Quick Purchase

The homepage quick purchase widget talks to the API directly during the guest purchase simulation:

- `GET /data-packages` loads packages from the active data vendor.
- `POST /orders` places a simulated guest order.
- `GET /orders/:reference/status` refreshes the returned order status.

Set `NEXT_PUBLIC_API_BASE_URL` for the web app. For local development this is usually `http://localhost:4000`. For Docker and production builds it must be available at build time because Next.js inlines `NEXT_PUBLIC_*` values into the client bundle.

## Convex

This repo includes a root-level `convex/` backend scaffold. Since you already have a remote Convex project, link this repo to it from the repository root:

```bash
pnpm install
pnpm convex:dev
```

When prompted, choose the existing Convex project. The CLI writes `CONVEX_DEPLOYMENT` and the deployment URL into `.env.local`, and generates `convex/_generated`. Use the generated URL for `NEXT_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CONVEX_URL` in your app environments.

For production:

```bash
pnpm convex:deploy
```

## Architecture Notes

The PRD calls for web, mobile, and admin clients sharing one backend. Convex owns the real-time database and app-facing functions, while the Node API remains the integration boundary for Paystack, Resend, Firebase Admin, and data vendor calls. Shared packages keep network codes, order statuses, user roles, and provider-facing contracts consistent across all apps.
