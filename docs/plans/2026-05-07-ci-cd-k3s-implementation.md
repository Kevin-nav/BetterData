# CI/CD k3s Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build and deploy the BetterData web app to the existing k3s VPS through GHCR, GitHub Actions, and a self-hosted runner.

**Architecture:** GitHub-hosted runners build and push immutable web images to GHCR on `master`. The VPS self-hosted runner applies namespaced Kubernetes manifests, syncs GitHub Actions Secrets into Kubernetes Secrets, updates the image, and waits for rollout.

**Tech Stack:** GitHub Actions, GHCR, pnpm, Turbo, Docker, Next.js standalone output, k3s, Cloudflare Tunnel.

---

### Task 1: Containerize the web app

**Files:**

- Create: `Dockerfile.web`
- Create: `.dockerignore`
- Modify: `apps/web/next.config.ts`

**Steps:**

1. Enable Next.js standalone output in `apps/web/next.config.ts`.
2. Add a Dockerfile that uses `turbo prune @betterdata/web --docker`, installs with pnpm, builds the web app, and runs `apps/web/server.js`.
3. Add `.dockerignore` to keep local build output, dependencies, git metadata, and local env files out of Docker context.
4. Run `docker build -f Dockerfile.web -t betterdata-web:test .`.

### Task 2: Add Kubernetes manifests

**Files:**

- Create: `deploy/k8s/base/namespace.yaml`
- Create: `deploy/k8s/base/web-deployment.yaml`
- Create: `deploy/k8s/base/web-service.yaml`
- Create: `deploy/k8s/base/cloudflared-deployment.yaml`
- Create: `deploy/k8s/base/kustomization.yaml`

**Steps:**

1. Create a dedicated `betterdata` namespace.
2. Add the web Deployment with conservative resource requests and a runtime env Secret reference.
3. Add the ClusterIP Service on port `3000`.
4. Add a dedicated Cloudflare Tunnel Deployment using the `betterdata-cloudflared` Secret.
5. Validate with `kubectl apply --dry-run=client -k deploy/k8s/base`.

### Task 3: Add build workflow

**Files:**

- Create: `.github/workflows/build-web.yml`

**Steps:**

1. Trigger on pushes to `master`, PRs to `master`, and manual dispatch.
2. Run pnpm install, lint, typecheck, and a web-scoped build.
3. Log into GHCR on `master` pushes.
4. Build and push `ghcr.io/kevin-nav/betterdata-web:<sha>` and `ghcr.io/kevin-nav/betterdata-web:master`.
5. Create or update a GitHub issue when the workflow fails.

### Task 4: Add deploy workflow

**Files:**

- Create: `.github/workflows/deploy-web.yml`

**Steps:**

1. Trigger manually and on a cron schedule.
2. Run only on the VPS self-hosted runner.
3. Apply Kubernetes manifests.
4. Create/update Kubernetes Secrets from GitHub Actions Secrets.
5. Patch the web Deployment image to the selected tag.
6. Wait for web and cloudflared rollouts.

### Task 5: Configure GitHub secrets

**Files:**

- No repo file changes.

**Steps:**

1. Add `CLOUDFLARED_TOKEN`.
2. Add runtime public values: `PUBLIC_APP_URL`, `PUBLIC_ADMIN_URL`, `API_BASE_URL`, `NEXT_PUBLIC_CONVEX_URL`.
3. Add `GHCR_READ_USERNAME` and `GHCR_READ_TOKEN` if the cluster should pull private GHCR images with a dedicated token.
4. Keep provider secrets ready for future API deployment: Firebase, Paystack, Resend, DataMartGH.

### Task 6: Verify VPS deployment

**Files:**

- No repo file changes.

**Steps:**

1. Confirm the self-hosted runner has `kubectl`, `docker` is not required, and access to `/etc/rancher/k3s/k3s.yaml`.
2. Run deploy manually with `image_tag=master` or a commit SHA.
3. Verify `kubectl -n betterdata get pods,svc`.
4. Verify Cloudflare tunnel routing externally.
