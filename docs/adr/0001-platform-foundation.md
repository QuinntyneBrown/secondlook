# ADR-0001: Platform foundation

- Status: Accepted
- Date: 2026-10-28
- Category: general
- Journey: J00

## Context

The repository is a scaffold with no entities or tests. Every journey needs the same base: configuration, storage, authentication, errors, logging and a proven test route. `AGENTS.md` already fixes the layer direction, explicit migrations, idempotent seeds and default authentication.

## Decision

1. Layers stay Domain, Application, Infrastructure, Api and Cli. Business rules live in handlers, never in controllers.
2. `SecondLook:Database:Provider` selects SQLite or SQL Server. Local, test, E2E and demo hosts use SQLite files under `.run/`. LocalDB is not used.
3. The API never applies migrations. `secondlook migrate`, `seed`, `reset` and `token` are explicit CLI commands. Seeding is idempotent and keyed by email.
4. A fallback authorization policy makes every endpoint authenticated. Anonymous access is limited to `/health/live`, `/health/ready` and Swagger in Development.
5. Policies `Buyer`, `Mechanic`, `BodyShop` and `Admin` map to the `Role` enum. Handlers read `ICurrentUser`.
6. Errors are RFC 7807 `problem+json` with a `traceId` and no stack trace.
7. Serilog request logging is registered before exception handling so the handled status is logged. Tokens, keys and email addresses are not logged.
8. Health is split into liveness (no dependencies) and readiness (database check).
9. Diagnostic endpoints under `/api/platform` exist to prove behaviour end to end; the fault endpoint exists only in Development and E2E.
10. Angular pages depend on API contracts through injection tokens.

## Consequences

- A developer must run `migrate` and `seed` before the first start; the runbook documents this.
- The fault endpoint and its environment gate must be tested so it never reaches Production.
- Later journeys add resources to the scoping primitives and must not bypass `ICurrentUser`.
- SQL Server behaviour is covered only by opt-in tests.

## Alternatives considered

- Migrate on API startup: rejected by `AGENTS.md`; hides schema changes and races on scale-out.
- LocalDB for E2E: rejected; Windows-only and slow to reset.
- Anonymous-by-default with an authorize attribute: rejected; one missed attribute exposes data.
