# SecondLook Backend

.NET 10 Clean Architecture backend for the SecondLook family weekend planner. See `docs/backend-plan.md` for the design and `docs/adr/` for decisions that deviated from the plan.

## Layout

```
backend/
  SecondLook.sln
  Directory.Build.props          # shared compile settings (net10.0, nullable, warnings-as-errors)
  Directory.Packages.props       # central package management
  global.json                    # pins SDK to 10.0.x
  src/
    SecondLook.Domain/            # entities, enums  (no dependencies)
    SecondLook.Application/       # MediatR handlers, IAppDbContext, planner, DTOs
    SecondLook.Infrastructure/    # AppDbContext, EF migrations, Open-Meteo client, seeder
    SecondLook.Api/               # Controllers, Program.cs, DI composition
    SecondLook.Cli/               # `secondlook migrate` / `secondlook seed`
                                 # (packaged dotnet tool — replaces the old
                                 # MigrationRunner + Seeder consoles)
  tests/
    SecondLook.Application.Tests/   # pure unit tests (planner, handlers, validators)
    SecondLook.Infrastructure.Tests/# persistence on SQLite (SQL Server opt-in) + weather contract
    SecondLook.Api.Tests/           # WebApplicationFactory end-to-end on in-memory SQLite
    SecondLook.Cli.Tests/           # migrate / seed / reset commands
```

## Local quickstart

```powershell
# 1. Restore + build
dotnet build backend/SecondLook.sln

# 2. Apply migrations (set connection string via env var or appsettings)
$env:SECONDLOOK_CONNECTION = "Server=(localdb)\MSSQLLocalDB;Database=SecondLook;Trusted_Connection=True;TrustServerCertificate=True"
dotnet run --project backend/src/SecondLook.Cli -- migrate

# 3. Seed catalog and the Brown family profile (idempotent)
dotnet run --project backend/src/SecondLook.Cli -- seed

# 4. Run the API
dotnet run --project backend/src/SecondLook.Api
```

Swagger UI is served at `/swagger` in every environment (the Angular frontend uses the spec to generate its client).

Account email (verification and reset links, L2-142) is sent after each response by a hosted dispatcher. With `SecondLook:Email:SmtpHost` empty, as in Development, each message is written as an `.eml` file to `SecondLook:Email:PickupDirectory` (default `App_Data/mail`); set `SecondLook__Email__SmtpHost`, `__SmtpUsername` and `__SmtpPassword` to send over SMTP. In production the template writes those for the Azure Communication Services relay once the domain is verified (ADR-021, `eng/Setup-Email.ps1`). Links point at `SecondLook:Email:AppOrigin`, falling back to `SecondLook:Share:AppOrigin`.

## Test the whole stack

```powershell
dotnet test backend/SecondLook.sln
```

Four test projects, about 590 tests, and no database server (ADR-020): the API and Infrastructure tests run on a per-fixture in-memory SQLite database, the Application and CLI tests on EF Core InMemory. The three tests of SQL Server-only behaviour (migration upgrade, `sp_getapplock`) are skipped unless `SECONDLOOK_TEST_SQLSERVER` is `localdb` or a server connection string; run them with `dotnet test backend/SecondLook.sln --filter Category=SqlServer`. `pwsh eng/Test-Backend.ps1` runs the suite as CI does.

## API surface

| Method | Route | Purpose |
| --- | --- | --- |
| GET / PUT | `/api/family` | Read / upsert the household profile |
| GET | `/api/activities` | Filtered activity suggestions |
| GET | `/api/restaurants` | Wife-approved meal picks |
| GET | `/api/events` | Local events overlapping the weekend |
| GET | `/api/weather` | Open-Meteo forecast for the weekend, with neutral fallback |
| POST | `/api/weekends/plan` | Plan a Saturday (idempotent — see ADR-003) |
| GET | `/api/weekends/current` | Upcoming Sat's weekend |
| GET | `/api/weekends/{id}` | Read a specific weekend |
| GET | `/api/weekends/history` | Recent planned weekends |
| POST | `/api/weekends/{id}/regenerate` | Re-plan, preserving locked blocks |
| PUT | `/api/weekends/{id}/favourite` | Toggle favourite flag |
| POST | `/api/blocks/{id}/swap` | Replace one activity with the next-best alternative |
| PUT | `/api/blocks/{id}/lock` | Lock / unlock a block |
| POST | `/api/weekends/{id}/errands` | Add a shopping errand |
| PUT | `/api/errands/{id}/done` | Mark an errand done |
| POST | `/api/_ping` | Pipeline smoke endpoint (used by tests) |
```
