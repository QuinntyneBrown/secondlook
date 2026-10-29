# 0017. Continuous deployment to Azure on every push to main

Status: accepted

## Context

SecondLook is in early testing with a handful of users. It needs a live stack
(buyer app, admin app, API, database) that tracks `main` without manual steps,
at the lowest cost that still runs the app.

## Decision

`.github/workflows/deploy.yml` runs on every push to `main` (and manually):

1. Backend and frontend test gates.
2. `eng/infra/main.bicep` converges `secondlook-rg`: Linux App Service plan and
   web app for `SecondLook.Api`, Azure SQL, and two Static Web Apps
   (`frontend/projects/secondlook`, `frontend/projects/admin`).
3. `secondlook migrate` against Azure SQL, before the API deploy, because the
   API never migrates on startup.
4. API zip deploy; each Angular app is built with the API origin written into
   `environment.prod.ts` and uploaded with its deployment token.
5. Smoke test of `/health/ready` and each app's deep route.

Azure sign-in is OpenID Connect with a federated credential for `refs/heads/main`;
`eng/Bootstrap-Azure.ps1` creates it once and sets the repository secrets.

### Custom domains

The repository variables `APP_CUSTOM_DOMAIN` and `ADMIN_CUSTOM_DOMAIN` hold the
hostnames each app is served from, comma-separated (`app.secondlook.care,www.secondlook.care`).
Bicep adds each one to its Static Web App, validated through a CNAME that must
already point at the app's `*.azurestaticapps.net` hostname, and adds
`https://<hostname>` to the API's CORS origins. The bare domain `secondlook.care`
cannot carry a CNAME, so the registrar redirects it (301) to `www.secondlook.care`.
Hostnames are never added in the portal: a hostname the API does not know as a
CORS origin makes the app show its 500 page on first load, and the smoke test
now checks every listed hostname for both the SPA shell and the CORS header.

Cheapest tiers: App Service **Linux F1 (free)**, SQL **Basic**, Static Web Apps
**Standard** (the subscription has no Free slots left, about US$9 each). F1 has no Always On, so the API sleeps when idle and the first request
is slow; WebSockets stay enabled for live calls.

## Consequences

- Migrations must stay additive: the previous API build runs against the new
  schema until the deploy lands.
- Move `apiSkuName` to `B1` when traffic needs Always On or more than F1's
  60 CPU minutes a day.
- Rotating `SECONDLOOK_JWT_SIGNING_KEY` signs everyone out.
