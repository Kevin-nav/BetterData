# Better Data Architecture

## Applications

The codebase is a pnpm/Turborepo monorepo with four application surfaces:

- Customer web app in `apps/web`
- Admin web app in `apps/admin`
- Expo mobile app in `apps/mobile`
- Backend API in `apps/api`
- Convex backend functions in `convex`

## Shared Packages

- `packages/contracts` contains user roles, network codes, order statuses, and request/response contracts.
- `packages/config` contains shared constants and environment access helpers.
- `convex/schema.ts` owns the operational data model.
- `packages/database` keeps repository contracts for service code that should not depend directly on storage implementation details.
- `packages/ui` contains shared design tokens and web UI primitives.

## Integration Boundaries

Convex owns app-facing data reads, writes, and real-time updates. The Node API owns direct calls to Paystack, Resend, Firebase Admin, and DataMartGH. Client apps should use Better Data-owned endpoints/functions only, so customers and agents never interact directly with DataMartGH.

## Data Flow

1. Client selects a network, package, and recipient number.
2. Client creates an order intent through Convex.
3. API initializes payment through Paystack or debits wallet balance.
4. API places fulfillment requests with DataMartGH using idempotency keys.
5. DataMartGH webhooks update order status in Convex.
6. Clients subscribe to Convex status updates.
