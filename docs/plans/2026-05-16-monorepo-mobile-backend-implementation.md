# Monorepo Mobile Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure Better Data so web and mobile share app-facing Convex functions, shared API endpoint clients, and one backend boundary.

**Architecture:** Convex becomes the shared app backend for client workflows and real-time updates. The Fastify API remains the private integration service for vendor, payment, email, webhook, and operational side effects, with typed REST helpers shared through a package.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Convex, Fastify, Next.js, Expo React Native.

---

### Task 1: Add Shared API Client Package

**Files:**
- Create: `packages/api-client/package.json`
- Create: `packages/api-client/tsconfig.json`
- Create: `packages/api-client/src/index.ts`
- Modify: `tsconfig.base.json`

**Step 1: Create the package skeleton**

Add `@betterdata/api-client` with `build`, `lint`, `typecheck`, and `test` scripts matching the existing package style.

**Step 2: Implement the client**

Export:

- `createBetterDataApiClient({ baseUrl, fetch })`
- `BetterDataApiClient`
- `BetterDataApiClientOptions`
- `ApiClientError`

Include methods for current public-safe routes:

- `listDataPackages()`
- `createOrder(body)`
- `getOrderStatus(reference)`

Use contract types from `@betterdata/contracts`.

**Step 3: Add the path alias**

Add `@betterdata/api-client` to `tsconfig.base.json`.

**Step 4: Run checks**

Run:

```bash
pnpm --filter @betterdata/api-client typecheck
pnpm typecheck
```

Expected: both pass.

**Step 5: Commit**

```bash
git add packages/api-client tsconfig.base.json
git commit -m "feat: add shared api client package"
```

### Task 2: Add Shared App API Package

**Files:**
- Create: `packages/app-api/package.json`
- Create: `packages/app-api/tsconfig.json`
- Create: `packages/app-api/src/index.ts`
- Modify: `tsconfig.base.json`

**Step 1: Create the package skeleton**

Add `@betterdata/app-api` with the same TypeScript package conventions as `contracts` and `config`.

**Step 2: Export Convex references**

Export generated Convex references from the root `convex/_generated/api` through stable names:

- `convexApi`
- `orderFunctions`
- `packageFunctions`
- `walletFunctions`

Keep this package free of React hooks so it remains usable from web, mobile, admin, and service-side code.

**Step 3: Add the path alias**

Add `@betterdata/app-api` to `tsconfig.base.json`.

**Step 4: Run checks**

Run:

```bash
pnpm --filter @betterdata/app-api typecheck
pnpm typecheck
```

Expected: both pass.

**Step 5: Commit**

```bash
git add packages/app-api tsconfig.base.json
git commit -m "feat: add shared convex app api package"
```

### Task 3: Add Missing Convex App Queries

**Files:**
- Modify: `convex/packages.ts`
- Modify: `convex/orders.ts`

**Step 1: Review existing functions**

Confirm existing package/order functions and generated names.

**Step 2: Add package list query**

Expose an app-facing query for available packages, optionally filtered by network.

**Step 3: Add order status query**

Expose an app-facing query for looking up an order by reference or id, suitable for real-time subscription.

**Step 4: Run Convex codegen and typecheck**

Run:

```bash
pnpm convex:codegen
pnpm typecheck
```

Expected: generated Convex types update and typecheck passes.

**Step 5: Commit**

```bash
git add convex
git commit -m "feat: add shared convex app queries"
```

### Task 4: Move Web HTTP Calls To Shared API Client

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/app/page.tsx`

**Step 1: Add dependency**

Add `@betterdata/api-client` as a workspace dependency in `apps/web/package.json`.

**Step 2: Replace inline fetch behavior**

Use `createBetterDataApiClient` for package loading, order creation, and status refresh.

**Step 3: Preserve UI behavior**

Keep existing messages, loading state, and quick purchase behavior unchanged.

**Step 4: Run checks**

Run:

```bash
pnpm --filter @betterdata/web typecheck
pnpm test
```

Expected: both pass.

**Step 5: Commit**

```bash
git add apps/web/package.json apps/web/app/page.tsx pnpm-lock.yaml
git commit -m "refactor: use shared api client in web"
```

### Task 5: Prepare Mobile For Shared Backend Clients

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/App.tsx`

**Step 1: Add dependencies**

Add `@betterdata/api-client` and `@betterdata/app-api` as workspace dependencies in `apps/mobile/package.json`.

**Step 2: Add shared-client usage**

Create a client from `EXPO_PUBLIC_API_BASE_URL` and use shared contract/client types in the mobile app entry. Keep the UI minimal, but make the backend wiring real and typechecked.

**Step 3: Run checks**

Run:

```bash
pnpm --filter @betterdata/mobile typecheck
pnpm typecheck
```

Expected: both pass.

**Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/App.tsx pnpm-lock.yaml
git commit -m "feat: wire mobile to shared backend clients"
```

### Task 6: Update Backend Documentation And Environment Contracts

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `.env.example`

**Step 1: Document the shared backend boundary**

Update docs to state that clients use Convex for app state and real-time updates, while the API owns private integrations.

**Step 2: Document shared URLs**

Ensure these variables are documented:

- `NEXT_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- `EXPO_PUBLIC_CONVEX_URL`
- server-side Convex/API variables needed by the integration service

**Step 3: Run checks**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: tests and typecheck pass. Build should pass unless blocked by an existing environment requirement; document any blocker.

**Step 4: Commit**

```bash
git add README.md docs/architecture.md .env.example
git commit -m "docs: document shared web mobile backend architecture"
```
