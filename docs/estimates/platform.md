# Estimates: platform

| Design | Effort | Complete |
|---|---|---|
| assigned-work-scoping | 3 days | 20% |
| buyer-data-scoping | 3 days | 20% |
| dialog-behaviour | 4 days | 0% |
| forbidden-pages | 2 days | 0% |
| initial-setup-and-platform | 12 days | 85% |
| system-pages | 4 days | 40% |

## Evidence after J00

- **initial-setup-and-platform (85%)**: delivered and tested: health and readiness, JWT validation, default authentication, role policies, problem details, request logging, CORS, `secondlook migrate/seed/reset/token`, SQLite E2E startup, buyer and admin shells, CI smoke job, narrated demo. Remaining: rendered design diagrams, SQL Server migration verification against a real server, request-validation problem details (J01).
- **system-pages (40%)**: 404, 403, 500, offline and maintenance render from one component and are reachable by route; the 500, 503 and offline mapping is unit-tested. Remaining: visual parity baselines against the mocks and the full forbidden-page variants of L2-059.
- **buyer-data-scoping and assigned-work-scoping (20%)**: the query primitives `ForBuyer` and `ForCaller` and `ICurrentUser` exist and are tested on a stand-in entity; they have no real entities to scope until vehicles and inspections arrive (J04, J06).
