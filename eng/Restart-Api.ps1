<#
.SYNOPSIS
    Restart the SecondLook API against the LocalDB instance's current named pipe.

.DESCRIPTION
    LocalDB stops itself after a few idle minutes and comes back with a new
    pipe name, so an API process started earlier keeps a dead connection
    string and every request that touches SQL fails with a 500 after the
    login timeout. This script starts the instance if needed, resolves the
    pipe (ADR-001: the (localdb)\Instance shortcut is unreliable on this
    machine), stops any running API, and starts a fresh one on :5100 with
    logs under .run\logs. Run it before an e2e session; it does not touch the
    database contents (use Start-FreshStack.ps1 for a reset + reseed).

.PARAMETER Instance
    LocalDB instance name. Default MSSQLLocalDB.

.PARAMETER NoBuild
    Pass --no-build to dotnet run (default on; the solution is normally
    already built).
#>
param(
    [string]$Instance = "MSSQLLocalDB",
    [switch]$Build
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repoRoot ".run\logs"
New-Item -ItemType Directory -Force $logDir | Out-Null

$state = (sqllocaldb info $Instance | Select-String '^State:').ToString().Split(':', 2)[1].Trim()
if ($state -ne "Running") {
    Write-Host "LocalDB $Instance is $state; starting it."
    sqllocaldb start $Instance | Out-Host
}
$pipe = (sqllocaldb info $Instance | Select-String 'Instance pipe name:').ToString().Split(':', 2)[1].Trim()
if (-not $pipe) { throw "sqllocaldb info $Instance returned no pipe name." }
Write-Host "LocalDB pipe: $pipe"

$running = Get-CimInstance Win32_Process -Filter "name='dotnet.exe' or name='SecondLook.Api.exe'" |
    Where-Object { $_.CommandLine -like '*SecondLook.Api*' }
foreach ($p in $running) {
    Write-Host "Stopping API process $($p.ProcessId)."
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

$env:SECONDLOOK_CONNECTION = "Server=$pipe;Database=SecondLook;Trusted_Connection=True;TrustServerCertificate=True"
$env:ASPNETCORE_ENVIRONMENT = "Development"
$noBuild = if ($Build) { "" } else { "--no-build" }
$out = Join-Path $logDir "backend.out.log"
$err = Join-Path $logDir "backend.err.log"
$args = "/c dotnet run --project `"$repoRoot\backend\src\SecondLook.Api`" $noBuild --urls http://localhost:5100 > `"$out`" 2> `"$err`""
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList $args -WorkingDirectory "$repoRoot\backend" -WindowStyle Hidden -PassThru
Write-Host "API starting (launcher pid $($proc.Id)); logs in $logDir"

$deadline = (Get-Date).AddSeconds(60)
do {
    Start-Sleep -Seconds 3
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5100/swagger/index.html" -TimeoutSec 5 -UseBasicParsing
        if ($r.StatusCode -eq 200) { break }
    } catch { }
} while ((Get-Date) -lt $deadline)

try {
    $login = Invoke-WebRequest -Uri "http://localhost:5100/api/auth/login" -Method Post -ContentType "application/json" `
        -Body '{"email":"quinntynebrown@gmail.com","password":"password123"}' -TimeoutSec 40 -UseBasicParsing
    Write-Host "API is up: seeded login returned $($login.StatusCode)."
} catch {
    Write-Warning "API started but the seeded login failed: $($_.Exception.Message). Check $out."
    exit 1
}
