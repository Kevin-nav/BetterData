# Agent Onboarding Flow Design

## Goal

Wire the complete Become an Agent journey from public landing entry points through signup, payment, acknowledgement, dashboard status, and admin approval, while keeping UI execution open for a dedicated UI/UX agent.

## Current State

The backend already supports the core payment and approval model:

- `agent_application_fee` exists as a payment intent purpose in `packages/contracts/src/payments.ts`.
- `apps/api/src/modules/payments/payments.routes.ts` requires an authenticated user for agent application payments.
- `convex/payments.ts` creates or updates an `agentApplications` record as `pending` after a successful agent application fee payment.
- `convex/admin.ts` can list, approve, and reject agent applications.
- Agent data pricing already applies in `convex/payments.ts` through `agentDiscountPercentage` when a buyer's user role is `agent`.

The public landing page currently links to `/agents/apply`, but that route does not exist. The footer also references `/agents`.

## Flow

### Public Visitor

1. Visitor clicks a Become an Agent link from the landing page.
2. The link should point to `/agents` or directly to `/agents/apply`; all public entry points must use real routes.
3. The public agent page explains the program at a high level and shows the current onboarding fee and agent discount.
4. When a logged-out visitor starts the application, collect a required phone number before signup or carry them into signup with an agent intent.
5. Signup must preserve the agent intent and route the new user back into the agent application flow.
6. After the user is authenticated, they confirm their phone number and pay the agent onboarding fee through Paystack.
7. After successful payment, the user sees an acknowledgement that their application was received and is pending review.

### Registered User

1. A registered non-agent user can start from the dashboard.
2. The dashboard should expose a Become an Agent entry point.
3. The dashboard agent page should require or confirm the user's phone number before payment.
4. The page should show the current onboarding fee and the better agent pricing benefit.
5. The user pays through Paystack.
6. The callback/return state should acknowledge payment and show pending review.

### Existing Agent

1. Existing agents should not be prompted to apply again.
2. Their dashboard agent page should confirm agent status and explain that better data pricing is active.

### Pending or Rejected Applicant

1. Pending applicants should see that their payment was received and the application is awaiting review.
2. Rejected applicants should see the current state and may be allowed to reapply only if the product owner wants that behavior. Default to no automatic reapply until admin policy is explicit.

## Data Requirements

The UI needs access to:

- Agent onboarding fee: `agentOnboardingFeeGhs`.
- Agent discount: `agentDiscountPercentage`.
- Current user role.
- Current user phone.
- Current user's agent application status, if any.

The implementation can satisfy this with API routes backed by Convex or direct app-client additions. Prefer existing API client patterns in `packages/api-client/src/index.ts`.

## Backend Wiring

Required backend work:

- Add a user phone update path so an authenticated user can provide or correct their phone before applying.
- Add a way for the web dashboard to fetch the current user's agent application status.
- Add a way for the web app to fetch public agent pricing configuration.
- Ensure Paystack callbacks for `agent_application_fee` land on an agent-specific acknowledgement route or dashboard route with enough reference data to reconcile status.

Payment should continue to create a pending application, not immediately upgrade the user. Admin approval remains the role-changing action.

## Signup Wiring

Signup should support an agent intent. Suggested query shape:

- `/signup?intent=agent`
- Optional carried phone: `/signup?intent=agent&phone=0541234567`

For `intent=agent`:

- Phone is required.
- After signup, route to `/agents/apply` or `/dashboard/agent`.
- The phone must be stored in the backend user record.

For normal signup:

- Keep the existing user flow intact.
- Phone can remain optional unless a broader product decision changes it.

## Pricing and Acknowledgement

The flow must show:

- The current onboarding fee before payment.
- The current agent discount or a clear description of better data pricing.
- A pre-payment acknowledgement that payment submits an application for review.
- A post-payment acknowledgement that payment was received and review is pending.
- A final approved-state acknowledgement that better agent pricing is now active.

Avoid hardcoding fee and discount copy in a way that can drift from platform config.

## UI/UX Scope

This document does not prescribe exact UI, layout, typography, color, component hierarchy, animation, or copy tone. The implementing UI/UX agent should design the experience around the existing Better Data product language and dashboard patterns.

High-level UX requirements:

- Public flow should make the agent value clear without feeling like a marketing detour.
- Dashboard flow should feel operational and concise.
- Payment and review states should be unmistakable.
- Phone collection should feel like a required business record, not an optional contact field.
- Edge cases should be visible in the interface rather than hidden behind generic errors.

## Verification

Minimum verification:

- Landing Become an Agent links resolve to existing routes.
- Logged-out user can enter agent flow, create an account, provide phone, and resume payment.
- Logged-in user without a phone must provide one before payment.
- Logged-in user with a phone can initiate Paystack agent payment.
- Successful agent payment creates a pending application.
- Pending state is shown in the dashboard.
- Existing agent sees active agent status and better-pricing acknowledgement.
- Normal signup and normal dashboard purchase flows still work.
