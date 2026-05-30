# PostHog Analytics Design

Date: 2026-05-30

## Goal

Add managed PostHog analytics to Better Data so the team can analyze detailed user behavior, purchase friction, repeat buying patterns, and agent activity without collecting names, raw phone numbers, raw payment references, or other unnecessary personal data.

The first implementation targets the customer web app. The event taxonomy should remain platform-neutral so the Expo mobile app can use the same analytics model later.

## Decisions

- Use managed PostHog, not self-hosted PostHog.
- Use explicit event capture. Do not enable broad autocapture.
- Track frontend interaction events from the web app.
- Track authoritative payment, wallet, order, and fulfillment outcomes from the backend.
- Connect anonymous visitor behavior to a later registered account using a stable hashed user identity.
- Track repeat recipient behavior with hashed recipient IDs, never raw phone numbers.
- Track hashed payment/order correlation IDs, never raw Paystack or vendor references.
- Send exact purchase amount, package size, network, payment method, purchase mode, and role because these are core behavior metrics and not direct personal identifiers.
- Use longer retention windows: 7, 14, 30, 60, and 90 days. Do not treat daily purchasing as the default success expectation.
- Create separate agent dashboards and cohorts so high-volume reseller behavior does not distort normal customer metrics.
- Enable privacy-hardened session replay for about 10% of purchase sessions.
- Label events by environment. Production dashboards must filter to production events.
- Exclude admin, internal, and test traffic from customer dashboards.

## Architecture

PostHog should be added as a product analytics layer beside the existing Honeycomb/OpenTelemetry telemetry.

Honeycomb remains the operational observability tool for traces, errors, retries, and backend service health. PostHog becomes the product analytics tool for behavior, funnels, cohorts, retention, feature usage, and purchase flow analysis.

The frontend records intent and friction:

- pages and purchase surfaces viewed
- network/package selection
- recipient entry and confirmation
- network mismatch prompts
- payment method selection
- wallet insufficiency messages
- saved-number interactions
- bulk entry interactions
- user-visible purchase errors
- payment redirect start

The backend records authoritative outcomes:

- payment intent creation
- payment success/failure
- wallet debit/top-up success
- order creation
- fulfillment completion/failure/refund
- agent application payment and approval
- completed agent purchases

This split keeps frontend analytics useful for product improvement while preventing browser-only events from being treated as financial truth.

## Identity Model

Before login or signup, PostHog should use its anonymous visitor identity.

After login or signup, the app should identify the person using a stable HMAC hash of the internal user ID. The hash secret must stay server-side or in a backend-controlled hashing path. Do not send raw Firebase UID, email, name, phone, or display name to PostHog.

Where possible, call PostHog alias/identify so pre-auth anonymous behavior can be connected to the later hashed user ID. This enables analysis such as:

- guest checked packages, then signed up later
- visitor abandoned purchase, then returned to buy
- registered user came back after a prior guest session

Allowed user properties:

- `role`: `guest`, `user`, `agent`, or safe equivalent
- `account_status`
- `agent_status`
- `has_purchased_before`
- `has_wallet`
- `signup_channel`
- `account_age_bucket`: for example `0-7d`, `8-30d`, `31-90d`, `90d_plus`
- `environment`
- `platform`: `web` now, `mobile` later

Do not store exact signup timestamps as user properties unless there is a clear analytics need.

## Privacy Rules

Never send these values to PostHog:

- names
- emails
- raw phone numbers
- raw recipient numbers
- raw payer numbers
- raw Paystack references
- raw vendor order references
- auth tokens
- request headers
- full provider payloads
- free-form support text
- admin notes

Use backend-created HMAC hashes for correlation fields:

- `user_hash`
- `recipient_hash`
- `payer_hash`, only if needed
- `order_hash`
- `payment_hash`

Safe derived fields are allowed:

- `network`
- `detected_network`
- `selected_network`
- `network_mismatch`
- `package_id`, if it is not sensitive
- `package_size_mb`
- `amount_ghs`
- `payment_method`
- `purchase_mode`: `single` or `bulk`
- `recipient_count`
- `saved_number_used`
- `recipient_previously_used`
- `agent_discount_applied`

## Session Replay

Enable PostHog session replay only in a privacy-hardened purchase-session mode.

Rules:

- Sample about 10% of purchase sessions.
- Mask all inputs.
- Mask or block typed text.
- Block sensitive request and response payload capture.
- Exclude admin, internal, and test traffic.
- Prefer triggering replay eligibility around purchase flow entry rather than across the full site.
- Keep replay sampling configurable by environment variable.

Session replay should be used to understand layout friction, validation confusion, disabled button behavior, and checkout hesitation. It should not be used to inspect private user-entered values.

## Event Naming

Use lowercase snake_case event names. Event names should describe the user action or backend outcome, not implementation details.

Every event should include common properties where available:

- `environment`
- `platform`
- `role`
- `is_authenticated`
- `is_agent`
- `purchase_mode`
- `network`
- `package_size_mb`
- `amount_ghs`
- `payment_method`
- `source_page`
- `session_replay_eligible`

Avoid sending empty strings for unknown values. Omit unknown optional properties.

## Frontend Events

Initial web events:

- `package_list_viewed`
- `package_selected`
- `network_selected`
- `network_mismatch_detected`
- `network_mismatch_switch_clicked`
- `recipient_entered`
- `recipient_confirmed`
- `payment_method_selected`
- `payment_started`
- `wallet_insufficient_balance_shown`
- `saved_number_selected`
- `saved_number_prompt_shown`
- `saved_number_prompt_saved`
- `saved_number_prompt_skipped`
- `bulk_recipient_added`
- `bulk_recipient_removed`
- `bulk_entry_error_shown`
- `bulk_file_upload_started`
- `bulk_file_upload_parsed`
- `purchase_error_shown`
- `agent_apply_viewed`
- `agent_application_payment_started`

Frontend events should not include raw phone input, typed labels, payment references, or authorization URLs.

## Backend Events

Initial backend events:

- `payment_intent_created`
- `payment_succeeded`
- `payment_failed`
- `wallet_debited`
- `wallet_topup_succeeded`
- `order_created`
- `order_completed`
- `order_failed`
- `order_refunded`
- `agent_application_started`
- `agent_application_paid`
- `agent_application_approved`
- `agent_application_rejected`
- `agent_purchase_completed`

Backend outcome events should include hashed correlation IDs so frontend intent can be joined to backend outcomes without exposing raw operational identifiers.

## Core Funnel

Primary customer purchase funnel:

1. `package_list_viewed` or `package_selected`
2. `recipient_entered`
3. `recipient_confirmed`
4. `payment_started`
5. `payment_succeeded` or wallet equivalent
6. `order_completed`

Segment this funnel by:

- guest vs registered vs agent
- single vs bulk
- mobile network
- package size
- purchase amount
- payment method
- wallet eligibility
- saved-number usage
- detected network mismatch
- platform
- environment

Wallet purchases should use the same funnel shape, replacing external payment success with `wallet_debited`.

## Retention And Repeat Behavior

Avoid daily purchase retention as a primary KPI. Data purchases are periodic, so daily retention will understate healthy customer behavior.

Recommended retention and repeat windows:

- 7 days
- 14 days
- 30 days
- 60 days
- 90 days

Track these return behaviors:

- returned to site
- returned to check packages
- returned to start purchase
- returned to complete purchase
- returned to buy for the same hashed recipient
- returned to buy the same package size
- returned to buy on the same network

Useful metrics:

- days between purchases by hashed user
- days between purchases by hashed recipient
- amount change between repeated recipient purchases
- package size change between repeated recipient purchases
- repeat purchase rate by network
- repeat purchase rate by package size

## Agent Analytics

Agents should have separate dashboards and cohorts.

Agent-specific analysis should include:

- single vs bulk purchase usage
- recipient count per order
- repeated recipient count
- new recipient count
- wallet usage rate
- wallet insufficiency rate
- network mix
- package size mix
- total spend by period
- order completion rate
- failure/refund rate
- purchase interval by hashed recipient
- saved-number usage
- bulk entry errors
- file upload usage for bulk purchases

Shared purchase events can still be used for agents, but dashboards must segment `role = agent` separately from normal users.

## Dashboards

Recommended production dashboards:

- Customer purchase funnel
- Guest-to-registered conversion
- Registered user repeat behavior
- Package and network performance
- Wallet usage and wallet friction
- Saved-number adoption
- Bulk purchase and agent behavior
- Agent application funnel
- Payment and fulfillment outcomes
- Privacy-safe session replay review queue

Production dashboards must filter `environment = production`.

## Environment Strategy

Every event must include an `environment` property.

Accepted values:

- `production`
- `staging`
- `development`

Staging and development may emit labeled events for UI checks and integration testing, but production dashboards should exclude them. If the PostHog account supports separate projects cleanly, production can be isolated into its own PostHog project. If not, environment filtering is required.

## Rollout Plan

1. Add PostHog configuration and environment variables.
2. Build a small analytics wrapper for frontend events.
3. Build a backend PostHog capture helper.
4. Add shared event/property naming conventions.
5. Add privacy-safe hashing helpers for PostHog correlation IDs.
6. Instrument the web purchase flow.
7. Instrument payment, wallet, order, and agent backend outcomes.
8. Configure 10% privacy-hardened session replay for purchase sessions.
9. Create production dashboards with environment filters.
10. Run staging/dev checks and verify no raw PII appears in PostHog.
11. Enable production tracking.

## Open Implementation Notes

- Decide whether hashed recipient IDs are generated only in the backend or through a public-safe endpoint for frontend events that need recipient correlation before payment starts.
- Prefer backend generation for hashes whenever possible.
- Ensure PostHog capture failures never block payment, wallet, or fulfillment flows.
- Add tests for analytics payload builders so forbidden fields cannot accidentally be added later.
- Update the privacy policy to describe anonymized product analytics and masked session replay.
