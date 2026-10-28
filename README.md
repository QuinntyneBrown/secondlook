<p align="center">
  <img src="docs/videos/assets/mark.svg" alt="SecondLook logo" width="96" height="96">
</p>
<h1 align="center">SecondLook</h1>
<p align="center">
  <strong>Know what an “as is” car could cost before you buy.</strong>
</p>
<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt=".NET 10" src="https://img.shields.io/badge/backend-.NET%2010-512BD4.svg">
  <img alt="Angular 21" src="https://img.shields.io/badge/frontend-Angular%2021-DD0031.svg">
  <a href="CONTRIBUTING.md"><img alt="Contributions welcome" src="https://img.shields.io/badge/contributions-welcome-blue.svg"></a>
</p>
<p align="center">
  <a href="#about">About</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#repository-layout">Repository layout</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#contributing">Contributing</a> ·
  <a href="#license">License</a>
</p>

---

## About

SecondLook helps used-car buyers evaluate a vehicle when they cannot bring a
mechanic to see it in person. A local mechanic inspects the car over live video
and estimates the work needed to get it safety certified in Ontario, or to pass
a safety inspection in other markets. Buyers can also add a body shop review.

With an estimate in hand, buyers can decide whether the deal is worth it before
committing. The first inspection is **$50**, and each additional vehicle within
the same window is **$25**. Optional reviews carry an additional fee.

**Project status:** early development. The repository contains static product
mocks, an Angular workspace and a .NET solution scaffold. The inspection service
is not yet implemented end to end. Some supporting scripts and documents still
contain material from an earlier project; the product overview and working
agreements in [AGENTS.md](AGENTS.md) describe SecondLook's intended direction.

## Getting started

### Prerequisites

- .NET 10 SDK; the SDK selection is defined in [backend/global.json](backend/global.json).
- Node.js 22.12 or newer in the Node.js 22 release line, with npm.
- PowerShell 7 for the scripts in `eng/`.

### Set up the workspace

Run these commands from a terminal:

```powershell
git clone https://github.com/QuinntyneBrown/secondlook.git
cd secondlook

dotnet restore backend/SecondLook.sln
npm ci --prefix frontend
npm ci --prefix e2e
```

### Explore the design reference

Open [docs/mocks/index.html](docs/mocks/index.html) in a browser to explore the
static screens, dialogs and states. These mocks are the visual reference for
implementation.

### Run the development scaffolds

Start the API from the repository root:

```powershell
dotnet run --project backend/src/SecondLook.Api --urls http://localhost:5100
```

In a second terminal, start Angular:

```powershell
cd frontend
npm start
```

The buyer app is served at <http://localhost:4200>. The current app has an empty
route outlet and the API has no product endpoints, so this starts the development
hosts rather than a usable inspection flow. No database is needed for these
scaffolds.

From `frontend/`, `npm run start:admin` starts the admin scaffold on port 4300,
and `npm run storybook` starts the component documentation host.

### Build and check

From the repository root:

```powershell
dotnet build backend/SecondLook.sln
dotnet test backend/SecondLook.sln

cd frontend
npm run lint
npm run format:check
npm run tokens:check
npm run build
npm test -- --watch=false
npm run build-storybook
```

The Playwright workspace lives in `e2e/`. Install its browser with
`npx playwright install chromium` from that directory. Its configuration and
API startup scripts still need to be aligned with the inspection implementation
before they provide an end-to-end product check. Frontend testing uses Chromium.

## Repository layout

```text
secondlook/
├── backend/                    .NET solution and test projects
│   └── src/
│       ├── SecondLook.Domain/          Entities and enums
│       ├── SecondLook.Application/     Use cases and API contracts
│       ├── SecondLook.Infrastructure/  Persistence and external services
│       ├── SecondLook.Api/             HTTP host and composition
│       ├── SecondLook.Cli/             Database command host
│       └── SecondLook.Worker/          Background worker scaffold
├── frontend/projects/
│   ├── secondlook/             Buyer application
│   ├── admin/                  Administration application
│   ├── api/                    API contracts and client library
│   ├── components/             Shared components, tokens and Storybook
│   └── perf-test/              Component performance scenarios
├── e2e/                        Playwright configuration, page objects and tests
├── docs/                       Product and engineering documentation
├── eng/                        Development and delivery scripts
├── marketing/                  Marketing site placeholder
└── tools/                      Video and screenshot tooling
```

The intended backend follows Clean Architecture: Domain has no dependencies;
Application defines use cases and contracts; Infrastructure implements persistence
and services; API composes the system. The frontend uses Angular standalone
components and a shared component library with Fluent UI v9 design tokens.
See [AGENTS.md](AGENTS.md) for the architectural rules and testing conventions.

## Documentation

| Resource                                           | Purpose                                                     |
| -------------------------------------------------- | ----------------------------------------------------------- |
| [Product mocks](docs/mocks/)                       | Static screens, dialogs and interaction states              |
| [Requirements](docs/specs/)                        | Home for high-level and detailed requirements               |
| [Detailed designs](docs/detailed-designs/)         | Home for implementation designs                             |
| [Design system](docs/design-system/)               | Home for design-system documentation                        |
| [Component library](frontend/projects/components/) | Shared components, theme tokens and Storybook sources       |
| [Architecture decisions](docs/adr/)                | Home for recorded architecture decisions                    |
| [Working agreements](AGENTS.md)                    | Architecture, code conventions and acceptance-test workflow |

Several documentation directories are placeholders while the product is being
specified and built.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before making
changes. Production behavior changes require a requirement, detailed design and
mock, followed by small implementation slices with acceptance tests written and
proved to fail before production code is added.

- Report bugs and request features through [GitHub Issues](https://github.com/QuinntyneBrown/secondlook/issues).
- See [SUPPORT.md](SUPPORT.md) for help and support channels.
- Follow [SECURITY.md](SECURITY.md) to report vulnerabilities privately.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md) when participating.

## License

SecondLook is available under the [MIT License](LICENSE).
