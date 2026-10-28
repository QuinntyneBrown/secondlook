## Project overview

SecondLook is a used-car safety app for people buying a vehicle "as is" who cannot get a mechanic out to see it in person. A local mechanic inspects the vehicle over live video and gives the buyer an estimate of what it will cost to get the car safety certified (the Ontario term; "pass a safety inspection" is the wider-market wording). The buyer can add a body shop review, or both, for a small additional fee. With a clear number in hand, the buyer decides whether the deal is worth it before committing.

Pricing: the first inspection is $50, and every additional vehicle within the same window is $25, so buyers can compare a few options without the cost adding up.

The .NET backend owns scheduling, inspections, estimates, pricing, persistence, and authentication; the Angular frontend provides the app, and Playwright covers behavior and visual parity with the design reference.

## Repository layout

- `backend/` — .NET solution
- `frontend/` — Angular workspace (`secondlook`, `admin`, `api`, `components`, and `perf-test`)
- `e2e/` — Playwright suite
- `frontend/projects/components/.storybook` + `stories/` — the design system: a Storybook docsite for the `components` library, laid out like the Fluent UI v9 docsite
- `frontend/projects/perf-test` + `e2e/perf-test/` — component perf test modelled on Fluent UI's `apps/perf-test`: scenario app and its Chromium profiling runner
- `docs/` — requirements (`specs/`), detailed designs, mocks, and the design system; all start empty
- `docs/mocks/` — static design reference
- `docs/adr/` — architecture decisions (starts empty); read relevant ADRs before changing the areas they cover

See `README.md` for setup and development commands.

## Backend architecture

Layer dependency direction (strict):

- `SecondLook.Domain` — entities + enums, zero deps
- `SecondLook.Application` — MediatR handlers, validators, DTO contracts, `IAppDbContext`
- `SecondLook.Infrastructure` — `AppDbContext`, EF migrations, SQL Server, auth services
- `SecondLook.Api` — controllers, `Program.cs`, DI composition, Swagger, middleware
- `SecondLook.Cli` — database migration, seeding, and reset commands

Non-obvious rules:

- Business rules live in handlers/domain services, not controllers.
- The API does **not** apply EF migrations on startup. Run `secondlook migrate` explicitly.
- Seed data is idempotent and safe to re-run.
- Write endpoints that create bookings or payments must be idempotent: re-posting returns the existing resource rather than throwing or duplicating it.
- Authentication uses local JWTs; see the relevant ADR before changing the auth flow.
- Endpoints require authentication by default. Preserve intentional anonymous access and Swagger middleware ordering when changing API auth.
- Keep request logging outside the exception-handling middleware so handled response statuses are logged correctly.
- Buyer-owned data (vehicles, inspections, estimates) must remain scoped to the current user; other users' resources must not be exposed. Mechanics and body shops see only the inspections assigned to them.

### Tests

Tests never need a database server: API and Infrastructure tests run on a per-fixture in-memory SQLite database, and Application and CLI tests on EF Core InMemory. Tests of SQL Server-only behaviour use `[SqlServerFact]` with `[Trait("Category", "SqlServer")]` and are skipped unless `SECONDLOOK_TEST_SQLSERVER` is set. API tests still run sequentially. Follow the existing test-project patterns when adding coverage.

Playwright runs against the API started by `eng/Start-E2eApi.ps1` (SQLite, seeded; no LocalDB).

## Frontend architecture

Workspace has five projects under `frontend/projects/`:

### Conventions enforced across the codebase

- Prettier (`frontend/.prettierrc`) owns formatting and angular-eslint (`frontend/eslint.config.js`) owns lint; CI fails on either. Run `npm run lint` and `npm run format:check` in `frontend/`. The husky pre-commit hook fixes staged frontend files.

- Component selectors use `sl-*`; TypeScript class, file, and folder names omit the `Sl` prefix.
- Components should preserve the mock design's BEM classes and accessible state semantics; e2e locators depend on that parity.
- Keep component styles encapsulated and global styles limited to shared foundations and utilities.
- **Design tokens follow Fluent UI v9.** The TypeScript theme in `frontend/projects/components/src/lib/tokens/` is the source; `styles/_tokens.scss` and `tokens/tokens.ts` are generated — run `npm run tokens` in `frontend/` after changing it (CI runs `tokens:check`). Read tokens by role (`var(--colorBrandForeground1)` for text, `--colorBrandBackground` for fills, `--colorBrandStroke1` for borders), never hex values; component-scoped knobs keep the `--sl-` prefix.
- **Declare each `ng-content` slot once.** A component that renders `<a>` or `<button>` by condition puts its slots in one `<ng-template>` and renders it with `ngTemplateOutlet` in both branches (`sl-button`, `sl-ghost-row`, `sl-list-item`); slots repeated per `@if` branch project into one branch only. On the consumer side, a `@if` wrapping several `[slot=…]` nodes loses the slot (NG8011) — one `@if` per node.
- API services have a contract and injection token; app pages depend on the token, not the concrete implementation.
- **No inline forms in pages**. Button-triggered editing always opens a CDK Dialog (`frontend/projects/secondlook/src/app/dialogs/`) or navigates to a screen.
- Use Angular CDK Dialog/Overlay for modal behavior; don't hand-roll modals.
- Every component has a story folder `frontend/projects/components/stories/src/<Name>/`: `index.stories.ts` (meta + re-exports; the only file Storybook globs), one `<Name><Story>.stories.ts` per example (`Default` first), and `<Name>Description.md` + `<Name>BestPractices.md`. Run `npm run build-storybook` from `frontend/` after changing a component's API; CI builds it on every PR.
- New components also get a perf-test scenario in `frontend/projects/perf-test/src/scenarios/`; see that project's README for running it.

### Bottom-nav iOS chrome handling

Read the relevant ADR (once written) before changing bottom navigation or its safe-area/chrome behavior, and run the corresponding regression test.

## E2E architecture (Playwright)

- Read the relevant ADR (once written) before changing visual regression coverage or snapshot policy. Run the relevant Playwright tests for UI changes; update baselines only for intentional design changes.

## Incremental Implementation and ATDD - mandatory

Mocks and the design system are design artifacts. ATDD does not apply to their
development. Do not write tests for mocks or the design system.

Every new feature or change to production behavior MUST have a requirement, a
detailed design, and a mock before implementation begins. This includes
behavioral changes to existing features, such as changing how a page behaves.
This requirement applies to production-code changes only; documentation-only,
design-system-only, mock-only, and test-only changes are out of scope unless
they are part of implementing a production behavior change.

Every production behavior implementation MUST invoke and follow the
`implementing-incrementally` skill (`.claude/skills/implementing-incrementally`
and `.agents/skills/implementing-incrementally`) before any code is written,
combined with acceptance test-driven development (ATDD). Plan small,
reviewable slices, then complete one slice at a time: write Given-When-Then
acceptance criteria, write the acceptance test, and run it to prove it fails for
the expected reason BEFORE writing production code. Implement only what satisfies
that slice, refactor with tests green, and run the relevant regression checks.
Do not move to the next slice until those checks pass. No bulk implementation,
no tests added afterward, and no weakening tests to manufacture a pass. Keep
the requirement, detailed design, mock, criteria, tests, and implementation
aligned until the entire feature or behavior change is complete.

Back end: integration tests against the API. Front end: Playwright, using the
Page Object Model - one page object per screen, owning the selectors and the
interactions. Tests state intent; page objects know the DOM. Never put a
selector in a test.

Run frontend tests in Chromium only. Do not configure or run Firefox, WebKit,
or any other browser for frontend testing.

### Never write architecture tests

Never add a test that asserts the shape of the codebase rather than its behavior:
no structure, layout, or naming tests; no banned-API scans; no traceability tests
that parse the specifications. Those constraints belong to the compiler, the
formatter, and review. A test suite exists to prove behavior.