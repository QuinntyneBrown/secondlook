#Requires -Version 7
<#
.SYNOPSIS
  Builds the backend once, then runs every test project concurrently.

.DESCRIPTION
  `dotnet test SecondLook.sln` runs the test assemblies one after another, so
  the suite takes the sum of their run times. Each assembly is its own process
  and each fixture owns a uniquely named in-memory SQLite database (ADR-020),
  so the assemblies can run side by side with no database server; ADR-002's
  serialization applies within SecondLook.Api.Tests and is kept by its
  xunit.runner.json.
#>
param(
    [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'
$backend = Join-Path (Split-Path $PSScriptRoot -Parent) 'backend'

dotnet build (Join-Path $backend 'SecondLook.sln') --configuration $Configuration --nologo
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$projects = Get-ChildItem (Join-Path $backend 'tests') -Filter '*.Tests.csproj' -Recurse
$results = $projects | ForEach-Object -ThrottleLimit $projects.Count -Parallel {
    $output = dotnet test $_.FullName --no-build --configuration $using:Configuration --nologo 2>&1 | Out-String
    [pscustomobject]@{ Name = $_.BaseName; ExitCode = $LASTEXITCODE; Output = $output }
}

$inActions = [bool]$env:GITHUB_ACTIONS
foreach ($result in $results | Sort-Object Name) {
    if ($inActions) { Write-Host "::group::$($result.Name) (exit $($result.ExitCode))" }
    else { Write-Host "== $($result.Name) (exit $($result.ExitCode))" }
    Write-Host $result.Output
    if ($inActions) { Write-Host '::endgroup::' }
}

$failed = @($results | Where-Object ExitCode -ne 0)
foreach ($result in $failed) {
    if ($inActions) { Write-Host "::error::$($result.Name) failed (exit $($result.ExitCode))" }
    else { Write-Host "$($result.Name) failed (exit $($result.ExitCode))" }
}
exit $failed.Count
