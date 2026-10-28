# Contributing to SecondLook

Thank you for your interest in improving SecondLook. This project is a
full-stack family weekend planner with a .NET backend, Angular frontend,
Playwright test suite, and static mock reference application.

## Before You Start

- Check existing issues and pull requests to avoid duplicate work.
- Open an issue first for user-visible behavior changes, larger refactors, or
  changes that affect API contracts.
- Keep pull requests focused on one fix, feature, or documentation update.
- Include screenshots or Playwright evidence for visible UI changes.

## Development Setup

From the repository root, the fastest way to verify the full stack is:

```powershell
powershell .\eng\Start-FreshStack.ps1
```

The script packs and installs the local `SecondLook.Cli` tool, resets and seeds
the database, publishes the backend API, builds the Angular frontend, starts
both processes, and prints the frontend URL.

Manual setup:

```powershell
cd frontend
npm ci

cd ..\e2e
npm ci

cd ..\backend
dotnet restore .\SecondLook.sln
```

## Project Layout

| Path | Purpose |
| --- | --- |
| `backend/` | .NET solution, Clean Architecture layers, EF Core, API, CLI, tests |
| `frontend/` | Angular app plus `api` and `components` libraries |
| `e2e/` | Playwright behavior and visual tests |
| `design-system/` | Standalone design-system catalog (own `npm test`, own SWA deployment) |
| `docs/mocks-v2/` | Static HTML/CSS design — the source of truth for the app and the visual baselines |
| `docs/adr/` | Architecture decision records |
| `eng/` | Local engineering automation scripts |

## Coding Guidelines

- Follow existing patterns in the layer you are changing.
- Keep backend business rules in application handlers and domain services, not
  controllers.
- Keep EF migrations explicit. The API must not apply migrations on startup.
- Keep seed data idempotent and safe to rerun.
- Keep Angular component hosts and inner elements on the mocks' BEM class
  names (ADR-009); the e2e page objects locate by them.
- Keep visual changes consistent with `docs/mocks-v2/` unless the pull request
  is intentionally updating the design — then change the mock first, run
  `node docs/mocks-v2/.check.mjs`, and re-capture baselines (`npm run baseline`
  in `e2e/`).
- Frontend code is formatted with Prettier and linted with angular-eslint.
  The husky pre-commit hook (installed by `npm ci` in `frontend/`) fixes
  staged files automatically; run `npm run lint` and `npm run format:check`
  before opening a pull request.
- Avoid unrelated formatting churn and broad refactors in feature or bug-fix
  pull requests.

## Tests

Run the checks that match your change. For cross-stack changes, run all of
them.

```powershell
# Backend build and tests
dotnet build .\backend\SecondLook.sln
dotnet test .\backend\SecondLook.sln

# Frontend build and tests
cd frontend
npm run build -- secondlook --configuration development
npm run build -- components
npm run build -- api
npm test

# Playwright behavior and visual tests
cd ..\e2e
npm run test:behavior
npm run test:visual
```

Update visual baselines only when the design change is intentional:

```powershell
cd e2e
npm run baseline
```

## Pull Request Checklist

- The change has a clear issue, rationale, or user-facing reason.
- New or changed behavior has test coverage appropriate to the risk.
- Relevant documentation is updated.
- UI changes include screenshots or Playwright evidence.
- Database changes include explicit EF migrations and seed updates if needed.
- The pull request description lists the commands you ran.

## Reporting Bugs

When filing a bug, include:

- the route or command where the problem appears;
- expected behavior;
- actual behavior;
- reproduction steps;
- logs, screenshots, or terminal output;
- operating system, browser, and relevant tool versions.

## License

By contributing to this repository, you agree that your contributions are
licensed under the repository's MIT License.
