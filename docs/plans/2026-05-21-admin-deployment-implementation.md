# Admin Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the BetterData admin app through GitHub Actions, Kubernetes, and Cloudflare Tunnel.

**Architecture:** Add a dedicated admin container image, build workflow, Kubernetes deployment/service, and deploy workflow support. Keep admin independent from customer web while reusing the existing public Firebase, Convex, and API build-time configuration.

**Tech Stack:** Next.js 15, pnpm, Docker, GitHub Actions, GHCR, k3s, Kustomize, Cloudflare Tunnel.

---

### Task 1: Make Admin Container-Buildable

**Files:**

- Modify: `apps/admin/next.config.ts`
- Create: `Dockerfile.admin`

**Steps:**

1. Enable Next standalone output for `apps/admin`.
2. Add `Dockerfile.admin` based on `Dockerfile.web`, pruning `@betterdata/admin`.
3. Expose and run the admin server on port `3001`.
4. Build locally with public env values.

### Task 2: Add Admin CI Image Build

**Files:**

- Create: `.github/workflows/build-admin.yml`

**Steps:**

1. Add path filters for `apps/admin`, shared packages, Convex, admin Dockerfile, and workflow/deploy files.
2. Verify required public build env.
3. Run admin lint/typecheck and build.
4. Publish `ghcr.io/kevin-nav/betterdata-admin:sha-<commit>` on `master` pushes.

### Task 3: Add Kubernetes Admin Resources

**Files:**

- Create: `deploy/k8s/base/admin-deployment.yaml`
- Create: `deploy/k8s/base/admin-service.yaml`
- Modify: `deploy/k8s/base/kustomization.yaml`

**Steps:**

1. Add a one-replica admin deployment with rolling replacement settings matching web/API.
2. Load runtime public config from `betterdata-admin-env`.
3. Add readiness/liveness checks against `/login`.
4. Add a ClusterIP service on port `3001`.

### Task 4: Extend Platform Deploy

**Files:**

- Modify: `.github/workflows/deploy-platform.yml`

**Steps:**

1. Add admin workflow trigger, input, image env, and change detection.
2. Capture current admin image if the deployment exists.
3. Resolve target admin image from SHA tag or current deployment.
4. Sync `betterdata-admin-env`.
5. Replace the admin image placeholder in rendered manifests.
6. Roll out and smoke-test admin through Kubernetes port-forward.

### Task 5: Verify And Deploy

**Commands:**

- `pnpm --filter @betterdata/admin typecheck`
- Admin production build with public env values.
- `kubectl kustomize deploy/k8s/base`
- Commit, push to `master`, watch admin build and platform deploy.
- Configure Cloudflare route: `admin.betterdatagh.com -> http://betterdata-admin.betterdata.svc.cluster.local:3001`.
