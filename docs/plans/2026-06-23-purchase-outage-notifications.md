# Purchase Outage Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Temporarily pause data purchases, collect guest notification emails, and provide an internal way to email guests and existing users when purchases resume.

**Architecture:** Use a Convex-backed outage state and subscriber table as the source of truth. The API exposes public status/subscribe endpoints, blocks new purchase/payment creation while active, and exposes an internal service-secret endpoint to send restoration emails. The web buy experience renders a disabled outage panel and subscription form while keeping existing logged-in users informed that account emails are already covered.

**Tech Stack:** Next.js app router, Fastify API, Convex, Resend, TypeScript, pnpm checks.

---

### Task 1: Convex Data Model

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/purchaseOutage.ts`
- Modify generated Convex API types after code changes.

**Steps:**
1. Add `purchaseOutageSubscribers` with `email`, `normalizedEmail`, `notifiedAt`, `createdAt`, and `updatedAt` plus indexes by normalized email and notification status.
2. Add service/public Convex functions for reading outage status, subscribing an email idempotently, listing notification recipients, and marking subscribers notified.
3. Keep outage active by default for this temporary deploy.

### Task 2: API Routes and Client Contract

**Files:**
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/src/modules/purchase-outage/purchaseOutage.routes.ts`
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Modify: `apps/api/src/modules/payments/payments.routes.ts`
- Modify: `apps/api/src/integrations/resend/templates.ts`
- Modify: `apps/api/src/integrations/resend/client.ts`
- Modify: `packages/api-client/src/index.ts`

**Steps:**
1. Add public `GET /purchase-outage` and `POST /purchase-outage/subscribers`.
2. Add internal `POST /internal/purchase-outage/notify-restored`.
3. Block `/orders` and data-purchase `/payments/intents` while outage is active.
4. Add a restoration email template and send helper.
5. Add API client methods and response types for the web app.

### Task 3: Web Buy Experience

**Files:**
- Modify: `apps/web/app/buy/BuyContent.tsx`
- Modify: `apps/web/app/globals.css`

**Steps:**
1. Load outage status on mount.
2. If active, render an outage notice and email subscription form instead of package selection and checkout controls.
3. For authenticated users, state that their account email will be notified automatically.
4. For guests, validate email lightly and show success/error states.
5. Ensure mobile and desktop layouts remain stable.

### Task 4: Verification and Delivery

**Files:**
- Generated: `convex/_generated/api.d.ts`

**Steps:**
1. Run targeted type/check commands available in the repo.
2. Regenerate Convex types if the repo command supports it.
3. Commit all changes, including the pre-existing generated file.
4. Push `master` to `origin/master`.
