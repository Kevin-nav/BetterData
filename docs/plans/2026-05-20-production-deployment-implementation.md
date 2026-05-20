# Production Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production deployment path where pushes to `master` build web/API images, sync Infisical secrets, roll out web/API/worker to k3s, and verify health before old pods are removed.

**Architecture:** Use GitHub Actions for CI and image publishing, a self-hosted VPS runner for cluster mutation, Infisical for runtime secrets, Kubernetes rolling deployments for web/API, and KEDA for AMQP-driven worker scaling. Keep the implementation compatible with a future Argo Rollouts migration but do not add that complexity now.

**Tech Stack:** TypeScript, Next.js, Fastify, Convex, Firebase, GHCR, GitHub Actions, k3s, Kubernetes, Kustomize, KEDA, Infisical CLI, CloudAMQP, Upstash Redis.

---

### Task 1: Preserve Current Main-Tree Context

**Files:**
- Inspect only: all current modified files

**Step 1: Check status**

Run:

```bash
git status --short
```

Expected: existing user/agent changes are visible. Do not reset or discard them.

**Step 2: Compare platform worktree**

Run:

```bash
git -C .worktrees/platform-integration log --oneline -12
```

Expected: the feature worktree contains port candidates for API/worker manifests, KEDA, Infisical sync, and auth/API changes.

### Task 2: Add API Docker Image

**Files:**
- Create: `Dockerfile.api`

**Step 1: Create Dockerfile**

Add a multi-stage Dockerfile that prunes `@betterdata/api`, installs with pnpm, builds TypeScript, and runs `node apps/api/dist/index.js` by default.

**Step 2: Include worker support**

The same image must also support the worker by overriding the command in Kubernetes to:

```bash
node apps/api/dist/worker.js
```

**Step 3: Verify image build syntax**

Run:

```bash
docker build -f Dockerfile.api .
```

Expected: image builds if Docker is available. If Docker is unavailable locally, continue and note the blocker.

### Task 3: Add API Image Build Workflow

**Files:**
- Create: `.github/workflows/build-api.yml`

**Step 1: Add workflow**

Trigger on push and pull request to `master`, plus manual dispatch.

**Step 2: Validate before publish**

Run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/api... build
```

**Step 3: Publish on master**

Publish `ghcr.io/kevin-nav/betterdata-api` with short SHA and `master` tags when the event is a push to `master`.

### Task 4: Update Web Build Workflow

**Files:**
- Modify: `.github/workflows/build-web.yml`
- Modify: `Dockerfile.web`

**Step 1: Add missing public env**

Add build env/build args for:

```env
NEXT_PUBLIC_CONVEX_URL
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
```

**Step 2: Keep existing API base URL**

Keep `NEXT_PUBLIC_API_BASE_URL` as a required build-time value.

**Step 3: Verify web build**

Run:

```bash
pnpm --filter @betterdata/web build
```

Expected: passes when public env values are available.

### Task 5: Add API And Worker Manifests

**Files:**
- Create: `deploy/k8s/base/api-deployment.yaml`
- Create: `deploy/k8s/base/api-service.yaml`
- Create: `deploy/k8s/base/worker-deployment.yaml`
- Modify: `deploy/k8s/base/kustomization.yaml`
- Modify: `deploy/k8s/base/web-deployment.yaml`

**Step 1: Add API deployment**

Use image `ghcr.io/kevin-nav/betterdata-api:master`, port `4000`, `betterdata-api-env`, readiness/liveness `/health`, `replicas: 2`, `maxSurge: 1`, and `maxUnavailable: 0`.

**Step 2: Add API service**

Expose the API deployment on port `4000` as `betterdata-api`.

**Step 3: Add worker deployment**

Use the API image with command `node apps/api/dist/worker.js`, `replicas: 0`, and `betterdata-api-env`.

**Step 4: Harden web deployment**

Set web `replicas: 2`, rolling update settings, and `minReadySeconds`.

**Step 5: Validate manifests**

Run:

```bash
kubectl kustomize deploy/k8s/base
```

Expected: rendered YAML includes web, API, worker, service, cloudflared, and namespace resources.

### Task 6: Add KEDA Worker Scaling

**Files:**
- Create: `deploy/k8s/base/worker-scaledobject.yaml`
- Modify: `deploy/k8s/base/kustomization.yaml`

**Step 1: Add TriggerAuthentication**

Read `CLOUDAMQP_URL` from `betterdata-api-env`.

**Step 2: Add ScaledObject**

Scale `betterdata-worker` from queue `orders.purchase.requested` with min `0` and max `5`.

**Step 3: Validate manifests**

Run:

```bash
kubectl kustomize deploy/k8s/base
```

Expected: KEDA resources render.

### Task 7: Add Platform Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy-platform.yml`

**Step 1: Add triggers**

Run on manual dispatch and automatically after successful web/API build workflows on `master`.

**Step 2: Run on self-hosted k3s runner**

Use labels:

```yaml
self-hosted, linux, x64, betterdata, k3s
```

**Step 3: Authenticate to Infisical**

Use:

```bash
infisical login --method=universal-auth --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" --silent --plain
```

**Step 4: Sync API runtime secrets**

Export Infisical production secrets as `api.env`, create/update `betterdata-api-env`, then delete `api.env`.

**Step 5: Sync web runtime public config**

Create/update `betterdata-web-env`.

**Step 6: Apply manifests and image pull secret**

Apply `deploy/k8s/base`, sync Cloudflare token, and sync GHCR pull secret.

**Step 7: Roll out selected images**

Set images for web, API, and worker. Wait for web/API/cloudflared rollout status.

**Step 8: Smoke test and rollback**

Run cluster and HTTPS smoke checks. If smoke checks fail, undo web and API rollouts and fail the workflow.

### Task 8: Update Production Operations Docs

**Files:**
- Modify: `docs/operations/production-platform-handoff.md`
- Modify: `docs/operations/production-smoke-tests.md`

**Step 1: Document auto-deploy**

Explain push-to-master build and deploy behavior.

**Step 2: Document KEDA install**

Keep Helm commands for installing KEDA on the VPS.

**Step 3: Document rollback**

Add `kubectl rollout undo` commands for web and API.

### Task 9: Verify Auth/API Integration

**Files:**
- Review: `apps/web/app/login/page.tsx`
- Review: `apps/web/app/signup/page.tsx`
- Review: `apps/web/app/lib/AuthContext.tsx`
- Review: `apps/api/src/modules/auth/auth.routes.ts`
- Review: `apps/api/src/modules/wallet/wallet.routes.ts`
- Review: `apps/api/src/modules/admin/admin.routes.ts`

**Step 1: Confirm session path**

Ensure web Firebase sign-in triggers API `POST /auth/session`, then `GET /auth/me`.

**Step 2: Confirm protected routes**

Ensure wallet/history/profile/admin routes use Firebase bearer tokens and API-side role checks.

**Step 3: Run API tests**

Run:

```bash
pnpm --filter @betterdata/api test
```

Expected: auth and route tests pass.

### Task 10: Final Local Verification

**Files:**
- All touched files

**Step 1: Run repo checks**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm --filter @betterdata/api test
pnpm --filter @betterdata/web build
kubectl kustomize deploy/k8s/base
```

**Step 2: Inspect diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intended files changed; no secrets are committed.

### Task 11: VPS Deployment Readiness

**Files:**
- No repo edits unless blockers are discovered

**Step 1: Confirm runner and tools**

If SSH works, verify:

```bash
ssh ubuntu@149.56.140.212 'kubectl version --client && helm version && uname -a'
```

**Step 2: Confirm KEDA**

Run:

```bash
ssh ubuntu@149.56.140.212 'kubectl get ns keda && kubectl get crd scaledobjects.keda.sh'
```

Expected: KEDA exists. If not, install KEDA after confirming with the operator.

**Step 3: Confirm self-hosted runner**

Use GitHub CLI or repo settings to confirm a runner with labels `betterdata` and `k3s`.

**Step 4: Confirm required GitHub secrets**

Use GitHub CLI where possible to list configured secret names. Ask the user only for missing values that cannot be retrieved safely.

