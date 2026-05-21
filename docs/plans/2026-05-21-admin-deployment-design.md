# Admin Deployment Design

## Goal

Deploy `apps/admin` as its own production service at `admin.betterdatagh.com`, built and rolled out through GitHub Actions alongside the API and customer web app.

## Approach

- Build a dedicated `betterdata-admin` Next.js container from `apps/admin`.
- Publish immutable `ghcr.io/kevin-nav/betterdata-admin:sha-<commit>` images from a new admin build workflow.
- Add Kubernetes `Deployment` and `Service` resources for `betterdata-admin` on port `3001`.
- Extend the platform deploy workflow to resolve, apply, roll out, and smoke-test the admin image independently from web and API.
- Route Cloudflare Tunnel traffic for `admin.betterdatagh.com` to `http://betterdata-admin.betterdata.svc.cluster.local:3001`.

## Security

- The admin app remains a separate deployment and subdomain.
- Browser admin access uses Firebase ID tokens and Convex role checks.
- The first bootstrap superadmin is `nchorkevin@gmail.com` through `ADMIN_SUPERADMIN_EMAILS`.
- The admin API key remains server-side only and is not used by browser flows.
