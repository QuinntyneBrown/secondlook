#Requires -Version 7
# Stops only the API that Start-E2eApi.ps1 started (its pid file), nothing else.
$pidFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.run/e2e/api.pid'
if (Test-Path $pidFile) {
    $p = Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue
    if ($p) { Stop-Process -Id $p.Id -Force; Write-Host "Stopped API pid $($p.Id)." }
    Remove-Item $pidFile -Force
}
