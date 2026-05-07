# Codebase Structure Design

## Goal

Create a full TypeScript monorepo skeleton for Better Data covering customer web, admin web, mobile, API, Convex, and shared platform packages.

## Recommended Approach

Use pnpm workspaces with Turborepo and a root-level Convex backend. This keeps apps independently deployable while allowing shared contracts, config, database boundaries, and UI foundations to evolve in one repository.

## Alternatives Considered

- Separate repositories per app: clearer deployment ownership, but too much duplication for a young product with shared contracts.
- Single Next.js app with admin routes: faster first scaffold, but weaker security and deployment separation than the PRD requests.
- Full monorepo: slightly more setup, but best match for the PRD's shared backend and multi-client roadmap.

## Structure

- `apps/web` for the public customer flow and public pages.
- `apps/admin` for the secured admin panel on its own subdomain.
- `apps/mobile` for the Expo app.
- `apps/api` for backend orchestration and third-party integrations.
- `convex` for schema, app-facing queries, mutations, and real-time data.
- `packages/contracts` for role, order, network, package, and API types.
- `packages/config` for shared constants and environment helpers.
- `packages/database` for schema and repository boundaries.
- `packages/ui` for reusable UI primitives and design tokens.

## Implementation Notes

The first scaffold intentionally avoids implementing live payment, auth, wallet, and DataMart fulfillment behavior. Those require credentials, Convex deployment linking, and provider webhook details. The initial structure creates typed boundaries for those modules so each can be implemented without reshaping the repository.
