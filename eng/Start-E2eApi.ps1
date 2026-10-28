#Requires -Version 7
<#
.SYNOPSIS
  Starts the SecondLook API on :5100 for Playwright on a fresh, seeded SQLite file.

.DESCRIPTION
  Stops any API this script started earlier, deletes the e2e database under .run/e2e, runs the explicit
  `secondlook migrate` and `secondlook seed` commands against it, starts the API with a hidden window and
  waits for /health/ready. No LocalDB and no real secrets: the JWT signing key is a throwaway development
  value. Logs go to .run/logs. The API pid is written to .run/e2e/api.pid so Stop-E2eApi can stop only it.

.PARAMETER Build
  Build the solution first (by default it is assumed built).

.PARAMETER Port
  The API port. Default 5100, which the Angular environment compiles in.
#>
param(
    [switch]$Build,
    [int]$Port = 5100
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repoRoot 'backend'
$dataDir = Join-Path $repoRoot '.run/e2e'
$logDir = Join-Path $repoRoot '.run/logs'
$pidFile = Join-Path $dataDir 'api.pid'
$database = Join-Path $dataDir 'secondlook-e2e.db'
$connection = "Data Source=$database"
New-Item -ItemType Directory -Force $dataDir, $logDir | Out-Null

if (Test-Path $pidFile) {
    $old = Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue
    if ($old) { Write-Host "Stopping earlier API (pid $($old.Id))."; Stop-Process -Id $old.Id -Force; Start-Sleep -Seconds 1 }
    Remove-Item $pidFile -Force
}
Get-ChildItem $dataDir -Filter 'secondlook-e2e.db*' | Remove-Item -Force

if ($Build) {
    dotnet build (Join-Path $backend 'SecondLook.sln') --nologo
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:SecondLook__Database__Provider = 'Sqlite'
$env:SecondLook__Database__ConnectionString = $connection
$env:SecondLook__Jwt__Issuer = 'secondlook'
$env:SecondLook__Jwt__Audience = 'secondlook-api'
$env:SecondLook__Jwt__SigningKey = 'e2e-only-signing-key-not-a-secret-0123456789abcdef'
$env:SecondLook__Diagnostics__EnableFaultEndpoint = 'true'

$cli = Join-Path $backend 'src/SecondLook.Cli'
foreach ($command in 'migrate', 'seed') {
    dotnet run --project $cli --no-build -- $command --provider Sqlite --connection $connection
    if ($LASTEXITCODE -ne 0) { throw "secondlook $command failed with exit code $LASTEXITCODE." }
}

$out = Join-Path $logDir 'e2e-api.out.log'
$err = Join-Path $logDir 'e2e-api.err.log'
$api = Start-Process -FilePath 'dotnet' -PassThru -WindowStyle Hidden -WorkingDirectory $backend `
    -RedirectStandardOutput $out -RedirectStandardError $err `
    -ArgumentList 'run', '--project', (Join-Path $backend 'src/SecondLook.Api'), '--no-build', '--urls', "http://localhost:$Port"
$api.Id | Set-Content $pidFile
Write-Host "API starting on SQLite (pid $($api.Id)); database $database; logs in $logDir"

$deadline = (Get-Date).AddSeconds(60)
$ready = $false
do {
    Start-Sleep -Seconds 1
    if ($api.HasExited) { throw "The API exited with code $($api.ExitCode). Check $err and $out." }
    try { $ready = (Invoke-WebRequest -Uri "http://localhost:$Port/health/ready" -TimeoutSec 5 -UseBasicParsing).StatusCode -eq 200 } catch { }
} while (-not $ready -and (Get-Date) -lt $deadline)
if (-not $ready) { Stop-Process -Id $api.Id -Force; throw "The API was not ready on :$Port within 60 s. Check $out." }
Write-Host "API is ready on http://localhost:$Port (SQLite, seeded)."
