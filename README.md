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

Copy `.env.example` to `.env` and fill in Firebase, Paystack, Resend, DataMartGH, and database credentials before integrating live services.

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

The PRD calls for web, mobile, and admin clients sharing one backend. Convex owns the real-time database and app-facing functions, while the Node API remains the integration boundary for Paystack, Resend, Firebase Admin, and DataMartGH provider calls. Shared packages keep network codes, order statuses, user roles, and provider-facing contracts consistent across all apps.
