# Admin Overview Financial Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Build a clearer admin overview with truthful revenue/profit calculations and trend charts.

**Architecture:** Convex owns order financial snapshots and aggregated dashboard metrics. The Next admin page consumes the richer query shape and renders scanable cards plus Recharts visualizations. Existing operational widgets remain in place.

**Tech Stack:** Convex, Next.js App Router, React 19, Recharts, TypeScript, CSS modules via global app CSS.

---

### Task 1: Snapshot Order Financials

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/orders.ts`
- Modify: `convex/payments.ts`

**Steps:**
1. Add optional `costGhsAtPurchase` and `markupGhsAtPurchase` fields to `orders`.
2. In wallet/direct order creation, look up the selected `dataPackages` record and store cost plus `amountGhs - cost`.
3. In Paystack data-purchase completion, do the same before inserting the order.

### Task 2: Upgrade Dashboard Financial Query

**Files:**
- Modify: `convex/admin.ts`

**Steps:**
1. Replace simple revenue totals with summary windows for daily, weekly, monthly, previous week, and previous month.
2. Return revenue, profit, order count, and margin percent.
3. Return `dailyTrend` for the last 90 days.
4. Add `backfillOrdersFinancials` for old orders missing snapshots.

### Task 3: Add Chart Components

**Files:**
- Modify: `apps/admin/package.json`
- Create: `apps/admin/app/components/FinancialTrendChart.tsx`
- Create: `apps/admin/app/components/OrderVolumeChart.tsx`

**Steps:**
1. Add `recharts`.
2. Build responsive client chart components with tooltips and empty states.
3. Keep chart data transformation inside the components where it is display-only.

### Task 4: Redesign Overview Page

**Files:**
- Modify: `apps/admin/app/components/MetricCard.tsx`
- Modify: `apps/admin/app/(dashboard)/page.tsx`
- Modify: `apps/admin/app/globals.css`

**Steps:**
1. Update KPI cards to avoid inline overlap and support deltas/tone.
2. Wire richer `revenueOverview` data into cards.
3. Render financial and order charts above operational panels.
4. Add responsive CSS for readable desktop and mobile layouts.

### Task 5: Verify

**Commands:**
- `pnpm install`
- `pnpm --filter @betterdata/admin typecheck`
- `pnpm --filter @betterdata/admin build`

**Expected:** Typecheck and build complete without errors.
