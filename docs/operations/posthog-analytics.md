# PostHog Analytics Operations

## Production Filters

All production dashboards must filter `environment = production`.

## Required Dashboards

- Customer purchase funnel
- Guest-to-registered conversion
- Registered user repeat behavior
- Package and network performance
- Wallet usage and wallet friction
- Saved-number adoption
- Bulk purchase and agent behavior
- Agent application funnel
- Payment and fulfillment outcomes
- Session replay review queue

## Privacy QA

Before enabling production analytics:

- Confirm no raw phone numbers appear in events.
- Confirm no emails or names appear in events.
- Confirm no raw Paystack references appear in events.
- Confirm no vendor references appear in events.
- Confirm all input values are masked in replay.
- Confirm admin/internal/test traffic is excluded from customer dashboards.

## Retention Windows

Use 7, 14, 30, 60, and 90-day windows. Do not use daily purchase retention as the primary success metric.

## Follow-Up Event Sources

Agent approval and rejection currently happen in Convex admin mutations. Add `agent_application_approved` and `agent_application_rejected` capture when those actions move through the Node API analytics helper or a Convex-safe PostHog capture path.
