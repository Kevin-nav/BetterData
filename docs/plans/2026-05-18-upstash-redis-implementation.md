# Upstash Redis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace production in-memory/shared-state paths with Upstash Redis REST for metrics and DataMart read caching.

**Architecture:** Add a narrow Upstash REST client and use it from metrics plus DataMart cache helpers. Production startup must fail without Upstash credentials; tests and local development may still inject memory/fake adapters.

**Tech Stack:** TypeScript, Fastify API, Node `fetch`, Upstash Redis REST, existing API check scripts.

---

### Task 1: Add Upstash Client

**Files:**
- Create: `apps/api/src/redis/upstash.ts`
- Test: `apps/api/src/redis/upstash.check.ts`
- Modify: `apps/api/package.json`

**Steps:**
1. Add an Upstash REST client with env resolution, command execution, JSON helpers, and key prefixing.
2. Add tests using a fake fetch implementation to verify command payloads and response parsing.
3. Add the check script to the API test command.

### Task 2: Move Metrics to Upstash REST

**Files:**
- Modify: `apps/api/src/observability/metrics.ts`
- Modify: `apps/api/src/observability/observability.check.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/worker.ts`

**Steps:**
1. Replace TCP Redis code with an Upstash metrics backend.
2. Configure metrics at API and worker startup.
3. Keep memory backend only for local/tests.
4. Validate adapter delegation and production env failure behavior.

### Task 3: Add DataMart Redis Cache

**Files:**
- Modify: `apps/api/src/vendors/datamart/config.ts`
- Modify: `apps/api/src/vendors/datamart/config.check.ts`
- Modify: `apps/api/src/vendors/datamart/client.ts`
- Create: `apps/api/src/vendors/datamart/cache.ts`
- Test: `apps/api/src/vendors/datamart/cache.check.ts`

**Steps:**
1. Add TTL config for packages, balance, and delivery tracker.
2. Add cache helpers backed by Upstash when configured.
3. Cache mapped DataMart read responses with stable keys.
4. Add focused tests with fake cache adapters.

### Task 4: Production Guards

**Files:**
- Modify: `apps/api/src/queue/index.ts`
- Modify: `.env.example`
- Modify: docs under `docs/operations/`

**Steps:**
1. Ensure production does not silently use local memory queue.
2. Document Upstash and AMQP environment requirements.
3. Run `pnpm --filter @betterdata/api test` and `pnpm --filter @betterdata/api typecheck`.
