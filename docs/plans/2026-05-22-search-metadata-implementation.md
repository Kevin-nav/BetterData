# Search Metadata Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve Better Data search snippets, crawler discovery, and social previews without changing visible landing page content.

**Architecture:** Use Next.js App Router metadata exports for page/search metadata, metadata route files for sitemap and robots, and JSON-LD on the landing page for structured entity data. Keep all changes inside the customer web app and docs.

**Tech Stack:** Next.js 15 App Router, TypeScript, `Metadata`, `MetadataRoute`, JSON-LD.

---

### Task 1: Update Global Metadata

**Files:**
- Modify: `apps/web/app/layout.tsx`

**Steps:**

1. Add a production `metadataBase` for `https://betterdatagh.com`.
2. Replace the global title and description with Better Data search positioning that avoids guaranteed delivery-speed claims.
3. Add `alternates.canonical`, `keywords`, `applicationName`, `openGraph`, `twitter`, and crawler-safe `robots` metadata.
4. Keep icons unchanged.

**Verification:**

Run: `pnpm --filter @betterdata/web typecheck`

Expected: TypeScript completes without errors.

### Task 2: Add Legal Metadata

**Files:**
- Modify: `apps/web/app/legal/page.tsx`
- Modify: `apps/web/app/privacy/page.tsx`
- Modify: `apps/web/app/terms/page.tsx`

**Steps:**

1. Expand `/legal` title, description, canonical URL, and social preview metadata.
2. Add metadata to `/privacy` and `/terms` redirect pages so route intent remains explicit in code.
3. Keep redirects and visible legal content unchanged.

**Verification:**

Run: `pnpm --filter @betterdata/web typecheck`

Expected: TypeScript completes without errors.

### Task 3: Add Sitemap and Robots

**Files:**
- Create: `apps/web/app/sitemap.ts`
- Create: `apps/web/app/robots.ts`

**Steps:**

1. Add a sitemap for canonical public pages: `/`, `/buy`, `/agents`, `/agents/apply`, and `/legal`.
2. Set useful priorities and change frequencies, with the landing page as highest priority.
3. Add robots rules allowing public crawling, excluding dashboard and payment/status routes, and referencing the sitemap.

**Verification:**

Run: `pnpm --filter @betterdata/web typecheck`

Expected: TypeScript completes without errors.

### Task 4: Add Structured Data

**Files:**
- Modify: `apps/web/app/page.tsx`

**Steps:**

1. Add JSON-LD describing Better Data as an online Ghana mobile data bundle service.
2. Include supported networks, area served, payment support, and key offer language.
3. Avoid any guaranteed or instant delivery promise.
4. Render the JSON-LD script inside the landing page `<main>`.

**Verification:**

Run: `pnpm --filter @betterdata/web typecheck`
Run: `pnpm --filter @betterdata/web build`

Expected: TypeScript and production build complete successfully.
