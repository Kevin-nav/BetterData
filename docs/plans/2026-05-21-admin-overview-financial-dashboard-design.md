# Admin Overview Financial Dashboard Design

## Goal

Improve the admin overview so operators can quickly understand sales, profit, order volume, and vendor risk without guessing from raw revenue totals.

## Approach

Orders will snapshot vendor cost and markup at purchase time. That keeps profit reporting stable even when package prices change later. Older orders will still be reportable by falling back to their current package cost until the backfill mutation is run.

The overview page will use a dense operational dashboard layout: readable KPI cards at the top, revenue/profit and order-volume charts beneath them, and existing operational panels below. The design avoids marketing-style hero sections and focuses on scanability, comparison, and repeated admin use.

## Components

- `MetricCard` becomes a structured card with label, primary value, optional secondary value, delta, caption, and tone.
- `FinancialTrendChart` renders revenue and profit over time with a 7D/30D/90D selector.
- `OrderVolumeChart` renders daily completed order counts.
- `revenueOverview` returns financial summaries, deltas, daily trend data, and snapshot quality counts.

## Financial Rules

- Revenue is the amount paid by the customer for completed orders.
- Cost is `costGhsAtPurchase` when present; otherwise, it is resolved from the current `dataPackages.providerCostGhs`.
- Profit is `markupGhsAtPurchase` when present; otherwise, it is `amountGhs - resolvedCost`.
- Missing package data falls back to zero profit and is counted so admins can audit old or orphaned orders without overstating margin.

## Verification

- Run `pnpm install` after adding Recharts.
- Run `pnpm --filter @betterdata/admin typecheck`.
- Run `pnpm --filter @betterdata/admin build`.
