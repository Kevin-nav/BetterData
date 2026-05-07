# BetterData CI/CD on k3s Design

## Goal

Deploy BetterData's customer landing page from the `master` branch to the existing k3s VPS without storing unencrypted `.env` files on the server.

## Recommended Approach

Use two workflows:

- `Build and Push Web` runs on GitHub-hosted runners when `master` receives a push. It validates the monorepo, builds the `apps/web` Docker image, and pushes immutable SHA and branch tags to GHCR.
- `Deploy Web` runs on the VPS self-hosted runner. It can be started manually or by schedule. It applies Kubernetes manifests, syncs GitHub Actions secrets into Kubernetes Secrets, updates the image, and waits for rollout.

This keeps cloud build work off the VPS, while all cluster-changing actions happen locally inside the VPS runner.

## Kubernetes Layout

BetterData gets its own namespace: `betterdata`.

The first deployment includes:

- `betterdata-web` Deployment for the Next.js landing page.
- `betterdata-web` Service exposing the app inside the cluster on port `3000`.
- `betterdata-cloudflared` Deployment using a dedicated `CLOUDFLARED_TOKEN` Kubernetes Secret.

Existing namespaces and tunnel Deployments are left untouched. Cloudflare routing should point the BetterData tunnel to:

```text
http://betterdata-web.betterdata.svc.cluster.local:3000
```

## Secrets

Source of truth for now is GitHub Actions Secrets.

The deploy workflow runs on the dedicated `vps-149-56-140-212-betterdata` self-hosted runner and writes required runtime values into Kubernetes Secrets at deploy time:

- `betterdata-web-env`
- `betterdata-cloudflared`
- `ghcr-auth`

No `.env` file is written to the VPS. Because native Kubernetes Secrets are not encrypted by default, the VPS should also have k3s secret encryption enabled.

## Notifications

Build failures create or update a GitHub Issue using the repo `GITHUB_TOKEN`. This gives the team a visible failure record without introducing Slack, Discord, or email webhook secrets yet.

## Future Extensions

When the API and admin app are ready, add separate Dockerfiles, Deployments, Services, and GHCR images:

- `betterdata-api`
- `betterdata-admin`

The existing workflow structure can stay the same.
