# Initial setup and platform

## Overview

SecondLook is a used-car safety app for buyers purchasing a vehicle "as is" who cannot get a mechanic to the car in person. This feature is the platform foundation that every product journey depends on: a clean checkout that restores, configures, migrates, seeds and runs, with authentication, role policies, error handling, health checks and request logging already in place. It contains no product workflow. Sign-in and registration screens belong to journey J01.

A *synthetic identity* is a seeded user on the reserved domain `example.test` that exists only for local, test and demo use. A *policy* is a named ASP.NET Core authorization rule tied to a user role. A *scoping primitive* is a reusable query constraint that limits a resource to its owner or its assigned provider. A *dev token* is a JWT issued by the CLI for a seeded identity.

The platform sits under every other subsystem. The sibling designs `buyer-data-scoping` (L2-057), `assigned-work-scoping` (L2-058), `forbidden-pages` (L2-059), `system-pages` (L2-060) and `dialog-behaviour` (L2-065) describe behaviour on top of it. The repository is currently a bare scaffold, so every component below is introduced by this design (see `docs/estimates/platform.md`). Decisions are recorded in `docs/adr/0001-platform-foundation.md` and `docs/adr/0002-local-jwt-and-dev-token-cli.md`. The commands are in `docs/setup-runbook.md`.

## Description

Backend, with the layer direction Domain, Application, Infrastructure and Api, Cli:

- **`User`** (`SecondLook.Domain`) — entity with `Id` (Guid), `Email`, `DisplayName`, `Role` and `IsActive`. `Role` is an enum with the values `Buyer`, `Mechanic`, `BodyShop` and `Admin`.
- **`IAppDbContext`** (`SecondLook.Application`) — the persistence abstraction exposing `Users` and `SaveChangesAsync`. Handlers depend on it, never on EF types.
- **`ICurrentUser`** (`SecondLook.Application`) — the caller's `Id` and `Role`, read from the validated token. Handlers never accept a client-supplied user id.
- **`AppDbContext`** (`SecondLook.Infrastructure`) — implements `IAppDbContext`. The setting `SecondLook:Database:Provider` selects `Sqlite` or `SqlServer`; any other value fails at startup. Migrations live here and are applied only by the CLI.
- **`JwtOptions` and `JwtTokenService`** (`SecondLook.Infrastructure`) — options bound from `SecondLook:Jwt:{Issuer,Audience,SigningKey}` and the service that signs tokens. The signing key comes from user-secrets or the environment variable `SecondLook__Jwt__SigningKey` and is never committed. The API validates signature, issuer, audience and expiry, and rejects tokens of inactive or missing users.
- **Policies** — `Buyer`, `Mechanic`, `BodyShop` and `Admin`, each requiring the matching role claim. A fallback policy requires an authenticated user, so endpoints are authenticated by default. `[AllowAnonymous]` appears only on the health endpoints; Swagger is reachable anonymously only in Development.
- **Scoping primitives** (`SecondLook.Application`) — an extension for buyer-owned queries (`OwnedBy(ICurrentUser)`) and one for provider-assigned queries (`AssignedTo(ICurrentUser)`). They have no resources to apply to until later journeys; they are proven here against a test-only entity. Not-found is returned for another buyer's resource (L2-057).
- **`PlatformController`** (`SecondLook.Api`) — `GET /api/platform/me` (any authenticated user), `GET /api/platform/access/{buyer|mechanic|body-shop|admin}` (gated by the matching policy) and `GET /api/platform/diagnostics/fault` (registered only in Development and E2E; elsewhere 404).
- **Health endpoints** — `GET /health/live` always answers 200 without touching the database. `GET /health/ready` runs a database connectivity check and answers 503 `problem+json` without connection details when it fails. Both are anonymous.
- **Exception handling and `ProblemDetails`** — unhandled exceptions become 500 `application/problem+json` with a `traceId` and no stack trace; validation failures become 400; 401 and 403 are also `problem+json`.
- **Serilog request logging** — registered before the exception handler so it logs the handled status. Entries carry method, path, status, elapsed time and `traceId`. Authorization headers, the signing key and email addresses are not logged.
- **`Program.cs`** — the composition root in `SecondLook.Api`. The middleware order is request logging, exception handling, Swagger (Development), authentication, authorization, endpoints.
- **`SecondLook.Cli`** — commands `migrate`, `seed`, `reset` and `token`, each taking `--provider` and `--connection`. `seed` inserts the four synthetic identities by email and is idempotent. `reset` drops and recreates the database. `token --email <e>` prints a dev token through `JwtTokenService`.

Frontend:

- **Buyer app shell** (`projects/secondlook`, :4200) and **admin app shell** (`projects/admin`, :4300) — routing, shared tokens from `projects/components`, and the system pages at `/404`, `/403`, `/500`, `/offline` and `/maintenance` described in `system-pages` and `forbidden-pages`. A wildcard route activates the 404 page.
- **API contracts** (`projects/api`) — each service is an interface with an `InjectionToken`; pages depend on the token. The platform contract is `PlatformApi` with `me()` and `readiness()`.
- **`SystemErrorInterceptor`** — maps 500 to `/500`, 503 to `/maintenance` and an offline failure to `/offline`.

Verification:

- **Integration tests** on per-fixture in-memory SQLite, run sequentially, cover the criteria of L2-068 to L2-071.
- **Playwright smoke flow** in Chromium only, using a `PlatformPage` page object that owns every selector, runs against `eng/Start-E2eApi.ps1` (API on :5100, fresh SQLite, seeded).

### API contracts

| Method and path | Auth | Success | Failure |
|---|---|---|---|
| `GET /health/live` | anonymous | 200 | none |
| `GET /health/ready` | anonymous | 200 | 503 `problem+json` |
| `GET /api/platform/me` | any authenticated | 200 `{id, email, displayName, role}` | 401 |
| `GET /api/platform/access/{role}` | matching policy | 200 `{role}` | 401, 403 `problem+json` |
| `GET /api/platform/diagnostics/fault` | authenticated, Development or E2E | none | 500 `problem+json`; 404 elsewhere |

### State transitions

| Subject | From | Event | To |
|---|---|---|---|
| Database | absent | `secondlook migrate` | migrated, empty |
| Database | migrated | `secondlook seed` | seeded (repeat is a no-op) |
| Database | any | `secondlook reset` | absent, then recreated empty |
| Request | received | token missing, invalid or expired | 401 |
| Request | authenticated | role differs from policy | 403 |
| Request | authorized | handler throws | 500 |
| Readiness | ready | database unreachable | not ready (503) |

### Persistence

One table, `Users`, with a unique index on `Email`. Local hosts use SQLite files under `.run/local/` and `.run/e2e/`; the E2E host never uses LocalDB. SQL Server is supported through the provider setting and tested only by opt-in `[SqlServerFact]` tests.

### Security

Local JWTs only. The key is never committed and startup fails when it is missing outside the test hosts. The policy fallback makes authentication the default. Error bodies and logs never carry stack traces, tokens, the signing key, connection strings or email addresses. Seed identities use `example.test` and carry no real data.

### Integration boundaries

The platform has no external services. Payment, video and mail adapters, and the sign-in endpoint that issues tokens to real users, belong to their own journeys. The CLI `token` command is the only token issuer here and is a development tool.

## Requirements

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-066` | `L1-021` | Local configuration and clean restore. The platform shall restore from a clean checkout and take its JWT signing key from user-secrets or the environment, never from tracked files. |
| `L2-067` | `L1-021` | Explicit migration, idempotent seed and reset. The CLI shall migrate, seed idempotently and reset isolated SQLite storage, and the API shall not migrate on startup. |
| `L2-068` | `L1-021` | Health checks. The API shall expose anonymous liveness and readiness endpoints, with readiness answering 503 `problem+json` when the database is down. |
| `L2-069` | `L1-021`, `L1-014` | Authentication by default. The API shall require a valid JWT on every endpoint except the health endpoints and, in Development, Swagger. |
| `L2-070` | `L1-021`, `L1-014` | Role policies and data scoping primitives. The API shall enforce the Buyer, Mechanic, BodyShop and Admin policies and provide the owner and assignment scoping primitives. |
| `L2-071` | `L1-021`, `L1-015` | Error responses and request logging. The API shall return `problem+json` with a `traceId` and no stack trace, and log the handled status without secrets. |
| `L2-072` | `L1-021`, `L1-015` | Application shells, system states and API contracts. The buyer and admin apps shall render shells with the system pages and depend on injected API contracts. |
| `L2-073` | `L1-021` | SQLite end-to-end route and CI. The Chromium smoke flow shall pass against the SQLite E2E API, and CI shall be green. |
| `L2-074` | `L1-021` | Reproducible setup demo. A documented command set shall regenerate the narrated setup demo. |

## Diagrams

Rendering of the PNG files is pending: PlantUML and Graphviz were not installed when this design was written. The `.puml` sources are in `diagrams/`; run `python .claude/skills/writing-software-design-documents/scripts/render_puml.py docs/detailed-designs/platform/initial-setup-and-platform` to produce the images the links below expect.

### System context

A developer runs the platform locally and in CI, and users reach it over HTTPS.

![C4 system context for the platform](diagrams/c4-context.png)

### Containers

Two Angular apps call one API; the API and the CLI share the database.

![C4 container view for the platform](diagrams/c4-container.png)

### Components

A request passes through logging, exception handling and authentication before it reaches a controller; readiness probes the database directly.

![C4 component view for the API pipeline](diagrams/c4-component.png)

### Class structure

Domain types are consumed through Application interfaces and implemented in Infrastructure.

![Class structure for the platform](diagrams/class-structure.png)

### Behaviour — migrate and seed

The CLI migrates once and seeds the same four identities on every run.

![Sequence diagram for migrate and seed](diagrams/sequence-migrate-seed.png)

### Behaviour — authenticated and forbidden requests

The JWT and policy checks yield 401, 403 or success.

![Sequence diagram for authenticated and forbidden requests](diagrams/sequence-authenticated-request.png)

### Behaviour — unhandled fault

Exception handling converts the fault, and request logging records the handled status.

![Sequence diagram for an unhandled fault](diagrams/sequence-fault-logging.png)

### Behaviour — liveness and readiness

Liveness never touches the database; readiness does.

![Sequence diagram for health checks](diagrams/sequence-readiness.png)
