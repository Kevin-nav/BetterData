# Agent Onboarding UI/UX Agent Prompt

Use this prompt to hand the work to another agent:

```text
You are working in C:\Users\Kevin\Projects\BetterData.

Read docs/plans/2026-05-21-agent-onboarding-flow-design.md first. Implement the Become an Agent flow described there.

Important: you own the UI and UX design. Do not treat the design doc as a visual spec. It defines the required routes, states, data needs, edge cases, and business rules only. Choose the exact page structure, component design, hierarchy, interaction model, and copy polish yourself, while staying consistent with the existing Better Data web and dashboard experience.

Primary outcomes:
- Fix all public Become an Agent links so they point to real routes.
- Add a public agent program route and an authenticated application/payment route.
- Support logged-out applicants by carrying them through signup and back into the agent application flow.
- Require phone number for agent applicants and persist it in the user record.
- Add a dashboard Become an Agent flow for registered users.
- Show current onboarding fee and agent discount from backend/config data, not hardcoded stale values.
- Create clear acknowledgement states for payment initialized, payment succeeded, pending review, approved agent, and blocked edge cases.
- Keep admin approval as the only action that upgrades a user to role=agent.

Relevant files and areas to inspect:
- apps/web/app/page.tsx
- apps/web/app/signup/page.tsx
- apps/web/app/dashboard/layout.tsx
- apps/web/app/dashboard/page.tsx
- apps/web/app/lib/AuthContext.tsx
- apps/web/app/lib/firebase.ts
- packages/api-client/src/index.ts
- packages/contracts/src/payments.ts
- packages/contracts/src/pricing.ts
- apps/api/src/modules/auth/auth.routes.ts
- apps/api/src/modules/payments/payments.routes.ts
- convex/schema.ts
- convex/users.ts
- convex/payments.ts
- convex/platformConfig.ts
- convex/admin.ts

Suggested implementation shape:
- Add API/client support for public agent pricing config, updating authenticated user phone, and reading current user's application status.
- Add or update web routes for /agents, /agents/apply, and /dashboard/agent as appropriate.
- Update signup to understand intent=agent and require phone only for that path.
- Update payment callback/reconciliation so agent application payments return to an agent-specific acknowledgement/status page.
- Add focused tests/checks for request validation and payment/application edge cases where the repo already has check files.

Verification:
- Run the relevant typecheck/build commands for the web app and any package/API checks you touch.
- Manually verify the route map and user states.
- Preserve existing normal signup, data purchase, wallet top-up, and admin approval behavior.
```
