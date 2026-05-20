# Production Deployment Design

## Goal

Wire BetterData production so pushes to `master` build, publish, deploy, and verify the web, API, and worker services on the VPS-hosted k3s cluster.

## Recommended Approach

Use Kubernetes-native rolling deployments now, with the manifests structured so the platform can move to Argo Rollouts later if weighted canaries become necessary.

This keeps the first production path small and operable:

- GitHub Actions builds immutable web and API images.
- A self-hosted runner on the VPS applies manifests and updates images.
- Infisical remains the source of truth for runtime secrets.
- Kubernetes readiness gates traffic to new pods.
- Failed rollouts are stopped and reverted by the deploy workflow.

## Deployment Flow

1. A push to `master` runs validation and builds web and API images.
2. Images are pushed to GHCR with both the short commit SHA and `master` tags.
3. A platform deploy workflow runs after successful builds or by manual dispatch.
4. The deploy workflow runs on the self-hosted k3s runner.
5. The workflow logs into Infisical with GitHub bootstrap secrets.
6. Infisical production runtime secrets are exported and synced into `betterdata-api-env`.
7. Web public/runtime settings are synced into `betterdata-web-env`.
8. Kubernetes base manifests are applied.
9. The web, API, and worker deployments are updated to the selected image tags.
10. Kubernetes performs rolling updates and sends traffic only to ready pods.
11. The workflow runs smoke checks and rolls back web/API deployments if checks fail.

## Progressive Rollout Behavior

The first version uses `Deployment` rolling update settings:

- Web replicas: `2`
- API replicas: `2`
- Worker replicas: `0`, scaled by KEDA
- `maxSurge: 1`
- `maxUnavailable: 0`
- readiness probes required before traffic
- `minReadySeconds` to prevent immediate promotion of unstable pods
- rollout status checks with explicit timeouts

This does not provide exact weighted traffic percentages. It does keep old pods serving until new pods are proven ready and removes old pods only after successful replacement. If exact 10/25/50/100 percent shifts are needed later, add Argo Rollouts with an ingress or mesh traffic provider.

## Secret Ownership

GitHub repository or environment secrets should hold only deployment bootstrap and public build-time values:

- `INFISICAL_CLIENT_ID`
- `INFISICAL_CLIENT_SECRET`
- `INFISICAL_PROJECT_ID`
- `INFISICAL_ENVIRONMENT`
- `INFISICAL_SECRET_PATH`
- `PUBLIC_APP_URL`
- `PUBLIC_ADMIN_URL`
- `API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `CLOUDFLARED_TOKEN`
- GHCR read credentials if the default token is not enough

Infisical production stores server runtime values:

- Firebase Admin credentials
- Convex URL and service/API secrets
- Paystack keys
- DataMart keys and webhook HMAC secret
- CloudAMQP URL
- Upstash Redis credentials
- Resend, Honeycomb, telemetry, rate-limit, and vendor configuration

The deploy workflow must delete temporary exported dotenv files after syncing them into Kubernetes.

## Auth And API Wiring

Firebase remains the identity provider. The web app signs users in with the Firebase client SDK, obtains ID tokens, and passes those tokens as `Authorization: Bearer <token>` to protected API routes.

The API verifies tokens with Firebase Admin, derives the Firebase UID server-side, and syncs users into Convex with `BETTERDATA_SERVICE_SECRET`. Convex remains the user, role, wallet, payment, and order source of truth.

Production must not trust user IDs from request bodies.

## Worker And Queue Policy

The API owns Paystack, DataMart, Firebase Admin, Redis, Resend, and webhook handling. Purchase workers are the only process that calls DataMart for fulfillment after a payment/order is ready.

Production uses AMQP with `QUEUE_PROVIDER=amqp`. The worker deployment starts at zero replicas and KEDA scales it from `orders.purchase.requested` queue depth.

## VPS And Cluster Strategy

The VPS at `149.56.140.212` hosts the self-hosted runner and k3s cluster. The runner should have non-interactive access to:

- `kubectl`
- `helm`
- Docker/GHCR pull access through Kubernetes image pull secrets
- Infisical CLI installation during workflow, or a preinstalled Infisical CLI

KEDA must be installed before applying the `ScaledObject` resources.

## Verification

Local verification:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @betterdata/api test`
- `pnpm --filter @betterdata/web build`
- `kubectl kustomize deploy/k8s/base`

Cluster verification:

- `kubectl -n betterdata get pods`
- `kubectl -n betterdata get deployment betterdata-web betterdata-api betterdata-worker`
- `kubectl -n betterdata get secret betterdata-api-env betterdata-web-env`
- `kubectl -n betterdata get scaledobject`
- `curl -fsS https://api.betterdatagh.com/health`
- `curl -fsS https://api.betterdatagh.com/data-packages`

