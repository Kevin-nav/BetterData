# Monorepo Mobile Backend Design

## Goal

Better Data should support customer web, admin web, and mobile apps from one shared backend shape. Web and mobile must not drift into separate API implementations, and real-time order/package/wallet updates should come from the same Convex deployment.

## Recommended Architecture

Use Convex as the app-facing backend for shared product workflows. Web, mobile, and admin clients call shared Convex queries and mutations for app state, and subscribe to those same queries for real-time updates.

Keep the Node API as a private integration service. It owns external side effects and secrets: Paystack, data vendor calls, Resend, Firebase Admin, webhook normalization, and operational jobs. When those side effects change app state, the API writes back to Convex so clients see updates in real time.

## Repository Shape

```text
apps/
  web/              Next.js customer app
  mobile/           Expo app
  admin/            Next.js admin app
  api/              Fastify private integration service

convex/             Shared Convex schema, queries, mutations, HTTP/actions

packages/
  api-client/       Shared typed client for public-safe REST API endpoints
  app-api/          Shared Convex API references and app-facing helpers
  contracts/        Domain types and request/response contracts
  config/           Runtime constants and environment helpers
  database/         Persistence boundary contracts used by services
  ui/               Shared tokens and platform-specific UI primitives
```

## Data Flow

1. Web/mobile/admin import shared helpers from `packages/app-api`.
2. App-facing reads and writes go through Convex functions.
3. Clients subscribe to Convex queries for order status, package availability, wallet balance, and notifications.
4. Convex creates durable order/payment intent records before private side effects occur.
5. Node API performs private side effects through vendor/payment/email integrations.
6. API writes final or intermediate state back to Convex through a service-safe boundary.
7. Clients receive real-time updates from Convex without polling the API.

## API Boundary

The API remains useful, but it should not become the primary app data layer. Its public-safe endpoints should be limited to endpoints that must be HTTP-based or integration-facing, such as health checks, payment callbacks, vendor webhooks, and selected development endpoints.

Where a web or mobile app does need HTTP, it should use `packages/api-client`, not inline `fetch` calls. That keeps endpoint paths, payloads, and response types shared across platforms.

## Convex Boundary

Convex owns the operational app model:

- users and roles
- data packages
- order intents and order status
- wallet balances and transactions
- agent applications
- announcements and notifications
- audit logs

The first implementation should add reusable package-level imports for generated Convex API references and shared query/mutation helpers. It should also add missing app-facing queries needed by both web and mobile.

## Initial Implementation Scope

The first restructure is foundation work, not a full product rewrite:

- Add `packages/app-api`.
- Add `packages/api-client`.
- Point TypeScript path aliases and workspace dependencies at those packages.
- Move the web quick-purchase HTTP calls into the shared API client.
- Prepare the mobile app to consume the same shared clients.
- Add Convex query/mutation coverage for app-facing packages and order status.
- Update docs and environment examples to make the shared Convex deployment explicit.

## Testing

Run these checks after implementation:

```bash
pnpm test
pnpm typecheck
pnpm build
```

At minimum, the work should preserve the existing API vendor checks, web typecheck, mobile typecheck, and package typechecks. Where shared clients contain real behavior, add focused tests before wiring them into apps.
