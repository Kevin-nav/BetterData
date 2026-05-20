# Production Platform Handoff

This document is the handoff for wiring BetterData production after the initial
secret setup. It covers what exists now, which secrets belong where, what code
and deployment changes still need to land, and how to verify the full production
path.

## Current State

- GitHub repository secrets have been imported from `.env.github`.
- Infisical CLI is installed locally.
- The main branch accepts DataMart's documented `X-DataMart-Signature` webhook
  header.
- Main branch contains the production web, API, worker, KEDA, and deploy
  workflow wiring.
- API production runtime is bundled to `apps/api/dist/index.js` and
  `apps/api/dist/worker.js`; containers should run these emitted files with
  `node`, not `tsx` source files.
- The design and implementation plans live in:
  - `docs/plans/2026-05-19-platform-integration-design.md`
  - `docs/plans/2026-05-19-platform-integration-implementation.md`

## Production URLs

Use these provider dashboard URLs:

```text
DataMart webhook endpoint:
https://api.betterdatagh.com/webhooks/data-vendor

Paystack webhook endpoint:
https://api.betterdatagh.com/webhooks/paystack

Paystack callback URL:
https://betterdatagh.com/payments
```

The API builds per-payment callback URLs from:

```env
PUBLIC_APP_URL=https://betterdatagh.com
```

## Secret Stores

### GitHub Repository Secrets

GitHub should contain only deployment bootstrap values and public build-time
values:

```env
INFISICAL_CLIENT_ID=
INFISICAL_CLIENT_SECRET=
INFISICAL_PROJECT_ID=
INFISICAL_ENVIRONMENT=prod
INFISICAL_SECRET_PATH=/

PUBLIC_APP_URL=https://betterdatagh.com
PUBLIC_ADMIN_URL=https://admin.betterdatagh.com
API_BASE_URL=https://api.betterdatagh.com

NEXT_PUBLIC_API_BASE_URL=https://api.betterdatagh.com
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=

CLOUDFLARED_TOKEN=
GHCR_READ_USERNAME=
GHCR_READ_TOKEN=
```

`NEXT_PUBLIC_*` values are not secret, but Next and Expo need them at build time.

### Infisical Runtime Secrets

Infisical should contain API and worker runtime values:

```env
NODE_ENV=production
PUBLIC_APP_URL=https://betterdatagh.com
PUBLIC_ADMIN_URL=https://admin.betterdatagh.com
API_BASE_URL=https://api.betterdatagh.com

ENABLE_DEV_VENDOR_ROUTES=false

API_RATE_LIMIT_GLOBAL_MAX=300
API_RATE_LIMIT_GLOBAL_WINDOW=1 minute
API_RATE_LIMIT_ORDERS_CREATE_MAX=20
API_RATE_LIMIT_ORDERS_CREATE_WINDOW=1 minute
API_RATE_LIMIT_ORDER_STATUS_MAX=60
API_RATE_LIMIT_ORDER_STATUS_WINDOW=1 minute
API_RATE_LIMIT_ADMIN_MAX=120
API_RATE_LIMIT_ADMIN_WINDOW=1 minute
API_RATE_LIMIT_WEBHOOK_MAX=120
API_RATE_LIMIT_WEBHOOK_WINDOW=1 minute

QUEUE_PROVIDER=amqp
CLOUDAMQP_URL=amqps://<user>:<password>@<host>/<vhost>
QUEUE_PREFETCH=5

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
UPSTASH_REDIS_KEY_PREFIX=betterdatagh
UPSTASH_REDIS_REQUEST_TIMEOUT_MS=5000

WEBHOOK_SECRET=
WEBHOOK_HMAC_SECRET=<datamart-generated-webhook-secret>
WEBHOOK_ALLOW_INSECURE=false

BETTERDATA_ACTIVE_DATA_VENDOR=datamart
BETTERDATA_SERVICE_SECRET=

CONVEX_URL=
CONVEX_API_SECRET=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

ADMIN_FIREBASE_UIDS=
ADMIN_EMAILS=
ADMIN_API_KEY=

PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_REQUEST_TIMEOUT_MS=15000
ALLOW_UNVERIFIED_PAYSTACK_ORDERS=false
ALLOW_UNVERIFIED_WALLET_ORDERS=false

RESEND_API_KEY=
SUPPORT_EMAIL=

HONEYCOMB_API_KEY=
HONEYCOMB_DATASET=betterdata-api
HONEYCOMB_OTLP_ENDPOINT=https://api.honeycomb.io/v1/traces
TELEMETRY_HASH_SECRET=

DATAMART_BASE_URL=https://api.datamartgh.shop/api/developer
DATAMART_API_KEY=
DATAMART_REQUEST_TIMEOUT_MS=15000
DATAMART_RETRY_COUNT=1
DATAMART_PURCHASE_BATCH_WINDOW_MS=5000
DATAMART_PURCHASE_BURST_WINDOW_MS=30000
DATAMART_PURCHASE_BURST_THRESHOLD=20
DATAMART_LOW_RATE_LIMIT_REMAINING_THRESHOLD=20
DATAMART_PACKAGES_CACHE_TTL_SECONDS=300
DATAMART_BALANCE_CACHE_TTL_SECONDS=30
DATAMART_DELIVERY_TRACKER_CACHE_TTL_SECONDS=60
VENDOR_BALANCE_LOW_GHS=200
VENDOR_BALANCE_CRITICAL_GHS=50

DATABASE_URL=
```

Do not put raw `.env.local` files in GitHub.

## Convex Environment

Convex also needs the same service secrets used by the API:

```env
BETTERDATA_SERVICE_SECRET=<same as Infisical>
CONVEX_API_SECRET=<same as Infisical>
```

Set these in the Convex dashboard or through Convex CLI deployment environment
configuration. The API passes these values into Convex functions; Convex checks
them against its own environment.

## Infisical Deploy Integration

The deploy workflow should:

1. Authenticate to Infisical using GitHub bootstrap secrets.
2. Export runtime secrets as JSON.
3. Filter invalid Kubernetes env key names and fail if required production keys
   are missing. Generate the Kubernetes env file from JSON so multiline values
   such as `FIREBASE_PRIVATE_KEY` are escaped as `\n`.
4. Create or update the Kubernetes secret `betterdata-api-env`.
5. Render Kubernetes manifests with exact target image refs.
6. Apply API, worker, web, KEDA, and Cloudflare tunnel manifests.
7. Roll out API, web, and Cloudflare tunnel.

Recommended workflow commands:

```bash
token="$(infisical login \
  --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --silent \
  --plain)"

export INFISICAL_TOKEN="$token"

infisical export \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENVIRONMENT" \
  --path="$INFISICAL_SECRET_PATH" \
  --format=json \
  --output-file=api.json

kubectl -n betterdata create secret generic betterdata-api-env \
  --from-env-file=api.clean.env \
  --dry-run=client -o yaml | kubectl apply -f -
```

Delete `api.json` and `api.clean.env` after the Kubernetes secret is applied.

## Required Code Changes

Before production rollout, the following implementation needs to be merged or
ported:

1. Paystack webhook should verify payment, complete the Convex payment intent,
   create or link the order, then enqueue `orders.purchase.requested`.
2. Purchase workers should be the only path that calls DataMart for purchase
   fulfillment.
3. Purchase worker should skip already-fulfilled orders with a vendor reference.
4. Redis should provide single-flight locks for DataMart package refreshes.
5. DataMart package listing should use Redis cache and avoid stampedes.
6. Public package route should fall back to Convex packages if DataMart fails.
7. Wallet/user routes should require Firebase bearer tokens.
8. Admin routes should reject non-admin users and support Convex/Firebase admin
   role checks.
9. Web app should have a Firebase auth foundation for ID token access.
10. API and worker Kubernetes manifests should be added.
11. KEDA worker scaling should be added.
12. Infisical deploy workflow should be added.

Most of this exists in the local `feature/platform-integration` worktree branch.

## Required Deployment Changes

Added or ported in the production deployment implementation:

- `Dockerfile.api`
- `deploy/k8s/base/api-deployment.yaml`
- `deploy/k8s/base/api-service.yaml`
- `deploy/k8s/base/worker-deployment.yaml`
- `deploy/k8s/base/worker-scaledobject.yaml`
- updated `deploy/k8s/base/kustomization.yaml`
- `.github/workflows/deploy-platform.yml`

The deploy workflow expects:

```text
ghcr.io/kevin-nav/betterdata-api:<tag>
ghcr.io/kevin-nav/betterdata-web:<tag>
```

The API build workflow publishes the API image. The web build workflow publishes
the web image with the public build-time Firebase, Convex, and API variables.

## Auto-Deploy Strategy

Pushes to `master` should build and publish web/API images. The platform deploy
workflow then runs on the self-hosted k3s runner and deploys the matching image
tags.

Build workflows are path-aware:

- API builds run for `apps/api`, `packages`, `convex`, API Dockerfile, lockfile,
  and shared repo build config changes.
- Web builds run for `apps/web`, `packages`, `convex`, web Dockerfile, lockfile,
  and shared repo build config changes.
- Docs-only and unrelated deployment-doc changes do not build images.
- If only one service changes, deploy uses that service's SHA image and keeps
  the other service on its currently deployed image.
- If shared code changes, both service images are built and the deploy workflow
  waits for both SHA tags before rollout.
- The deploy workflow captures the previously deployed API and web image refs
  before rollout. Rollback sets deployments back to those exact refs rather than
  relying on mutable tags or Kubernetes revision history.
- Runtime manifests are rendered with the target images before `kubectl apply`.
  This prevents the base manifest placeholders from briefly resetting workloads
  back to `:master`.

The first production strategy uses Kubernetes rolling updates rather than a
separate canary controller:

- Web and API run with one replica on the current single-node VPS.
- Rolling updates use `maxSurge: 0` and `maxUnavailable: 1` to avoid rollouts
  hanging on unschedulable surge pods.
- Readiness probes gate traffic to new pods.
- `minReadySeconds` keeps a new pod ready for a short period before Kubernetes
  treats it as available.
- If smoke checks fail, the workflow rolls back web and API deployments.

This gives controlled replacement without adding Argo Rollouts or a service
mesh. It can have a brief service interruption while the single replacement pod
starts. If exact weighted traffic shifts or zero-downtime replacement are later
required, add VPS/cluster capacity, set web/API replicas to at least two, and
then migrate to Argo Rollouts or another compatible traffic provider.

Manual deploy remains available from GitHub Actions. Use it to deploy a specific
image tag or rerun production after a transient runner or cluster failure. Leave
an image tag blank to preserve that service's currently deployed image.

## Permanent Fixes For The Current Failure Cases

Use these as the operating rules for future deployment work:

- Firebase public config: `NEXT_PUBLIC_FIREBASE_API_KEY`,
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
  `NEXT_PUBLIC_CONVEX_URL`, and `NEXT_PUBLIC_API_BASE_URL` are build-time web
  inputs. A bad web image cannot be fixed by changing only Kubernetes runtime
  secrets; rebuild and redeploy the web image.
- API runtime: do not run `tsx` in production containers. The API image should
  build with `tsup` and run `node apps/api/dist/index.js`; the worker should run
  `node apps/api/dist/worker.js`.
- Image tags: deploy immutable `sha-<commit>` tags. The mutable `master` tag is
  only a registry convenience and should not be used as the desired production
  state.
- Infisical export: invalid keys are ignored by name only, multiline values are
  escaped before creating the Kubernetes env file, and missing required
  production keys fail before workload rollout begins.
- Rollback: only run after workload rollout starts, and roll back to captured
  previous image refs.
- Capacity: the current single-node VPS cannot provide true zero-downtime
  rolling updates or weighted traffic shifting. Keep single-replica replacement
  until there is enough capacity for at least two web pods and two API pods.

## KEDA And Scaling Policy

Production scaling policy:

- Web: keep `replicas: 1`.
- API: keep `replicas: 1` for webhook reliability.
- Worker: keep `replicas: 0`; KEDA scales by AMQP queue depth.
- No cron package refresh by default.
- No scheduled DataMart polling by default.

Install KEDA on the k3s cluster before applying KEDA resources:

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm repo update
helm install keda kedacore/keda --namespace keda --create-namespace
```

On the current single-node VPS, the default chart CPU requests were too high and
anonymous GHCR pulls for KEDA images returned `403`. Use the GitHub package read
token from `.env.local` or GitHub secrets to create a pull secret in the `keda`
namespace, then install with lower resource requests:

```bash
kubectl -n keda create secret docker-registry ghcr-auth \
  --docker-server=ghcr.io \
  --docker-username="$GHCR_READ_USERNAME" \
  --docker-password="$GHCR_READ_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install keda kedacore/keda \
  --namespace keda \
  --create-namespace \
  --set imagePullSecrets[0].name=ghcr-auth \
  --set resources.operator.requests.cpu=10m \
  --set resources.operator.requests.memory=64Mi \
  --set resources.operator.limits.cpu=200m \
  --set resources.operator.limits.memory=256Mi \
  --set resources.metricServer.requests.cpu=10m \
  --set resources.metricServer.requests.memory=64Mi \
  --set resources.metricServer.limits.cpu=200m \
  --set resources.metricServer.limits.memory=256Mi \
  --set resources.webhooks.requests.cpu=10m \
  --set resources.webhooks.requests.memory=64Mi \
  --set resources.webhooks.limits.cpu=200m \
  --set resources.webhooks.limits.memory=256Mi
```

Worker scaler target:

```text
orders.purchase.requested
```

The KEDA `TriggerAuthentication` should read `CLOUDAMQP_URL` from
`betterdata-api-env`.

## CloudAMQP

Store the full CloudAMQP connection URL in Infisical:

```env
CLOUDAMQP_URL=amqps://<user>:<password>@<host>/<vhost>
```

Do not store a separate CloudAMQP password unless the code is later changed to
split the URL into parts.

## DataMart Setup

In DataMart Developer API:

- Endpoint URL: `https://api.betterdatagh.com/webhooks/data-vendor`
- Active: enabled
- Events: `order.completed`, `order.failed`, `order.refunded`
- Generate webhook secret and store it as `WEBHOOK_HMAC_SECRET`

For the IP allow list, add the production API server's outbound public IP. Check
from the VPS:

```bash
curl -4 https://ifconfig.me
curl -6 https://ifconfig.me
```

Use IPv4 if DataMart only accepts IPv4.

## Paystack Setup

In Paystack live mode:

- Webhook URL: `https://api.betterdatagh.com/webhooks/paystack`
- Callback URL: `https://betterdatagh.com/payments`

Store in Infisical:

```env
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_REQUEST_TIMEOUT_MS=15000
```

Paystack webhooks are signed with `PAYSTACK_SECRET_KEY`; no separate Paystack
webhook secret is required.

## Cloudflare Tunnel

Ensure Cloudflare routes point to Kubernetes services:

```text
betterdatagh.com        -> http://betterdata-web:3000
admin.betterdatagh.com  -> admin service once deployed
api.betterdatagh.com    -> http://betterdata-api:4000
```

The current Kubernetes base has `betterdata-web`, `betterdata-api`, and the
Cloudflare tunnel deployment. Confirm the Cloudflare tunnel token can route the
API hostname.

## Production Rollout Order

1. Move runtime secrets into Infisical.
2. Set required GitHub bootstrap/public secrets.
3. Set Convex environment variables.
4. Install KEDA in k3s.
5. Build and push API image.
6. Build and push web image.
7. Apply Kubernetes base manifests.
8. Sync Infisical secrets to `betterdata-api-env`.
9. Sync web runtime public config to `betterdata-web-env`.
10. Roll out web and API.
11. Confirm worker stays at zero with empty queue.
12. Run provider dashboard webhook tests.
13. Run payment intent smoke test in staging mode first.
14. Switch DataMart mode to production only after smoke tests pass.

## Verification Commands

Local:

```bash
pnpm lint
pnpm typecheck
pnpm --filter @betterdata/api test
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 pnpm --filter @betterdata/web build
kubectl kustomize deploy/k8s/base
```

Cluster:

```bash
kubectl -n betterdata get pods
kubectl -n betterdata get secret betterdata-api-env
kubectl -n betterdata get deployment betterdata-api
kubectl -n betterdata get deployment betterdata-worker
kubectl -n betterdata get scaledobject
kubectl -n betterdata get hpa
```

API:

```bash
curl -i https://api.betterdatagh.com/health
curl -i https://api.betterdatagh.com/data-packages
```

KEDA:

```bash
kubectl -n betterdata describe scaledobject betterdata-worker
kubectl -n betterdata logs deployment/betterdata-worker
```

Rollback:

```bash
kubectl -n betterdata set image deployment/betterdata-web web=<previous-web-image-ref>
kubectl -n betterdata set image deployment/betterdata-api api=<previous-api-image-ref>
kubectl -n betterdata set image deployment/betterdata-worker worker=<previous-api-image-ref>
kubectl -n betterdata rollout status deployment/betterdata-web --timeout=180s
kubectl -n betterdata rollout status deployment/betterdata-api --timeout=180s
```

## Known Gaps For The Next Agent

- Convex codegen/deploy needs a configured `CONVEX_DEPLOYMENT`.
- DataMart webhook route currently normalizes the webhook payload. Confirm the
  final implementation persists status updates to Convex orders.
- Production deployment should be tested in staging or a controlled production
  window before enabling real DataMart fulfillment.
