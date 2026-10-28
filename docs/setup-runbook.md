# Setup runbook

From a clean checkout to a running, tested platform. Prerequisites: .NET 10 SDK (see `backend/global.json`), Node 22.12+ in the 22 line, PowerShell 7, Git. Run commands from the repository root unless stated. Satisfies L2-066 to L2-073; design in `docs/detailed-designs/platform/initial-setup-and-platform/README.md`.

## 1. Restore

```powershell
dotnet restore backend/SecondLook.sln
npm ci --prefix frontend
npm ci --prefix e2e
npx --prefix e2e playwright install chromium
```

## 2. Configure (no secrets in git)

The JWT signing key comes from the environment (the CLI) or user-secrets (the API) and is never committed. Use the same key for both.

```powershell
$key = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
$env:SecondLook__Jwt__SigningKey = $key                       # CLI `token` command; this shell only
dotnet user-secrets set "SecondLook:Jwt:SigningKey" $key --project backend/src/SecondLook.Api
dotnet user-secrets set "SecondLook:Database:Provider" "Sqlite" --project backend/src/SecondLook.Api
dotnet user-secrets set "SecondLook:Database:ConnectionString" "Data Source=$PWD/.run/local/secondlook.db" --project backend/src/SecondLook.Api
```

Issuer and audience have non-secret defaults in `appsettings.json`. The CLI reads `SecondLook__Jwt__Issuer` and `SecondLook__Jwt__Audience` from the environment too; set them to `secondlook` and `secondlook-api` before running `token`.

## 3. Migrate and seed

The API never migrates on startup. The local database is `.run/local/secondlook.db` (git-ignored).

```powershell
New-Item -ItemType Directory -Force .run/local | Out-Null
dotnet run --project backend/src/SecondLook.Cli -- migrate --provider Sqlite --connection "Data Source=.run/local/secondlook.db"
dotnet run --project backend/src/SecondLook.Cli -- seed --provider Sqlite --connection "Data Source=.run/local/secondlook.db"
dotnet run --project backend/src/SecondLook.Cli -- seed --provider Sqlite --connection "Data Source=.run/local/secondlook.db"
```

The second `seed` must exit 0 and change nothing. Seeded identities: `buyer@example.test`, `mechanic@example.test`, `bodyshop@example.test`, `admin@example.test`. To start over:

```powershell
dotnet run --project backend/src/SecondLook.Cli -- reset --provider Sqlite --connection "Data Source=.run/local/secondlook.db"
```

## 4. Start the hosts

Use one terminal each.

```powershell
dotnet run --project backend/src/SecondLook.Api --urls http://localhost:5100
npm start --prefix frontend            # buyer app, http://localhost:4200
npm run start:admin --prefix frontend  # admin app, http://localhost:4300
npm run storybook --prefix frontend    # component docs
```

Check the API: `curl http://localhost:5100/health/live` and `curl http://localhost:5100/health/ready` return 200.

## 5. Try authentication

```powershell
$t = dotnet run --project backend/src/SecondLook.Cli -- token --email buyer@example.test --provider Sqlite --connection "Data Source=.run/local/secondlook.db"
curl http://localhost:5100/api/platform/me                                            # 401
curl -H "Authorization: Bearer $t" http://localhost:5100/api/platform/me              # 200
curl -H "Authorization: Bearer $t" http://localhost:5100/api/platform/access/admin    # 403
```

Do not paste tokens into issues, logs or recordings.

## 6. Run the tests

```powershell
dotnet build backend/SecondLook.sln
dotnet test backend/SecondLook.sln
npm run lint --prefix frontend
npm run format:check --prefix frontend
npm run tokens:check --prefix frontend
npm run build --prefix frontend
npm run build:admin --prefix frontend
npm test --prefix frontend -- --watch=false
npm run typecheck --prefix e2e
pwsh eng/Start-E2eApi.ps1 -Build      # API on :5100, fresh SQLite under .run/e2e, seeded
cd e2e; npx playwright test --project=desktop --project=admin tests/platform tests/admin; cd ..
pwsh eng/Stop-E2eApi.ps1              # stops only the API the start script launched
```

Tests never need a database server. Playwright runs Chromium only (the `desktop` and `admin` projects use Chromium at different viewports).

## 7. CI

`.github/workflows/ci.yml` runs the backend build and test, the frontend lint, format check, tokens check, builds and tests, and the Chromium E2E run on every pull request. All must be green before merge. Reproduce a failure locally with the matching command from section 6.

## Troubleshooting

- API exits naming `SecondLook:Jwt:SigningKey`: repeat section 2.
- `no such table`: run `migrate` (section 3).
- Port 5100 busy: `pwsh eng/Stop-E2eApi.ps1`, or stop the API you started by hand.
