[CmdletBinding()]
param(
    [int]$FrontendPort = 4200,
    [int]$BackendPort = 5100,
    [string]$Configuration = "Debug",
    [string]$ConnectionString = "Server=(localdb)\MSSQLLocalDB;Database=SecondLook;Trusted_Connection=True;TrustServerCertificate=True",
    [string]$SeedDir,
    [switch]$OpenBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-FirstExistingPath {
    param([string[]]$Candidates, [string]$Description)

    foreach ($candidate in $Candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw "Could not find $Description. Checked: $($Candidates -join ', ')"
}

function Invoke-Step {
    param(
        [Parameter(Mandatory)] [string]$Title,
        [Parameter(Mandatory)] [string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = $repoRoot
    )

    Write-Host ""
    Write-Host $Title
    Write-Host "> $FilePath $($Arguments -join ' ')"

    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Title failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Test-PortAvailable {
    param([int]$Port)

    $getNetTcpConnection = Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue
    if ($null -ne $getNetTcpConnection) {
        $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
        return $listeners.Count -eq 0
    }

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try {
        $listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        $listener.Stop()
    }
}

function Find-AvailablePort {
    param([Parameter(Mandatory)] [int]$StartingAt)

    for ($port = $StartingAt; $port -le ($StartingAt + 99); $port++) {
        if (Test-PortAvailable -Port $port) {
            return $port
        }
    }

    throw "Could not find an available port between $StartingAt and $($StartingAt + 99)."
}

function Resolve-NativeCommand {
    param([string[]]$Candidates)

    foreach ($candidate in $Candidates) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($null -ne $command) {
            return $command.Source
        }
    }

    throw "Could not find command. Checked: $($Candidates -join ', ')"
}

function Resolve-LocalDbConnectionString {
    param([Parameter(Mandatory)] [string]$ConnectionString)

    $parts = $ConnectionString -split ';'
    $usesLocalDbShortcut = $false

    for ($i = 0; $i -lt $parts.Count; $i++) {
        $part = $parts[$i]
        $eq = $part.IndexOf('=')
        if ($eq -lt 0) {
            continue
        }

        $key = $part.Substring(0, $eq).Trim()
        $value = $part.Substring($eq + 1).Trim()
        if (($key -ieq "Server" -or $key -ieq "Data Source") -and $value -ieq "(localdb)\MSSQLLocalDB") {
            $usesLocalDbShortcut = $true
            break
        }
    }

    if (-not $usesLocalDbShortcut) {
        return $ConnectionString
    }

    $sqllocaldb = Resolve-NativeCommand -Candidates @("sqllocaldb.exe", "sqllocaldb")
    $instance = "MSSQLLocalDB"

    function Get-LocalDbPipe {
        param([Parameter(Mandatory)] [string]$CommandPath, [Parameter(Mandatory)] [string]$InstanceName)

        $output = & $CommandPath info $InstanceName
        if ($LASTEXITCODE -ne 0) {
            throw "sqllocaldb info $InstanceName failed with exit code $LASTEXITCODE."
        }

        foreach ($line in $output) {
            if ($line -match '^Instance pipe name:\s*(.+)$') {
                $pipe = $Matches[1].Trim()
                if (-not [string]::IsNullOrWhiteSpace($pipe)) {
                    return $pipe
                }
            }
        }

        return $null
    }

    $pipe = Get-LocalDbPipe -CommandPath $sqllocaldb -InstanceName $instance
    if ([string]::IsNullOrWhiteSpace($pipe)) {
        & $sqllocaldb start $instance | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "sqllocaldb start $instance failed with exit code $LASTEXITCODE."
        }

        $pipe = Get-LocalDbPipe -CommandPath $sqllocaldb -InstanceName $instance
    }

    if ([string]::IsNullOrWhiteSpace($pipe)) {
        throw "Could not resolve LocalDB named pipe for $instance."
    }

    Write-Host "Resolved LocalDB shortcut to named pipe: $pipe"

    $hasMinPoolSize = $false

    for ($i = 0; $i -lt $parts.Count; $i++) {
        $part = $parts[$i]
        $eq = $part.IndexOf('=')
        if ($eq -lt 0) {
            continue
        }

        $key = $part.Substring(0, $eq).Trim()
        $value = $part.Substring($eq + 1).Trim()
        if ($key -ieq "Min Pool Size") {
            $hasMinPoolSize = $true
        }
        if (($key -ieq "Server" -or $key -ieq "Data Source") -and $value -ieq "(localdb)\MSSQLLocalDB") {
            $parts[$i] = "$key=$pipe"
        }
    }

    if (-not $hasMinPoolSize) {
        $parts += "Min Pool Size=1"
    }

    return ($parts -join ';')
}

function Reset-RunDirectory {
    param([Parameter(Mandatory)] [string]$Path)

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $runBoundary = $runRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) +
        [System.IO.Path]::DirectorySeparatorChar
    if ($fullPath -ne $runRoot -and -not $fullPath.StartsWith($runBoundary, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to reset directory outside run root: $fullPath"
    }

    if (Test-Path -LiteralPath $fullPath) {
        Remove-Item -LiteralPath $fullPath -Recurse -Force
    }

    New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
}

function Start-LoggedProcess {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [string]$FilePath,
        [string[]]$Arguments = @(),
        [Parameter(Mandatory)] [string]$WorkingDirectory,
        [Parameter(Mandatory)] [string]$StdOutPath,
        [Parameter(Mandatory)] [string]$StdErrPath,
        [hashtable]$Environment = @{}
    )

    $prior = @{}
    foreach ($key in $Environment.Keys) {
        $prior[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
        [Environment]::SetEnvironmentVariable($key, [string]$Environment[$key], "Process")
    }

    try {
        Write-Host ""
        Write-Host "Starting $Name"
        Write-Host "> $FilePath $($Arguments -join ' ')"
        return Start-Process `
            -FilePath $FilePath `
            -ArgumentList $Arguments `
            -WorkingDirectory $WorkingDirectory `
            -RedirectStandardOutput $StdOutPath `
            -RedirectStandardError $StdErrPath `
            -WindowStyle Hidden `
            -PassThru
    }
    finally {
        foreach ($key in $Environment.Keys) {
            [Environment]::SetEnvironmentVariable($key, $prior[$key], "Process")
        }
    }
}

function Wait-ForHttp {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [string]$Uri,
        [Parameter(Mandatory)] [System.Diagnostics.Process]$Process,
        [int]$TimeoutSeconds = 45
    )

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)

    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        if ($Process.HasExited) {
            throw "$Name exited before it was ready. Exit code: $($Process.ExitCode)"
        }

        try {
            Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 2 | Out-Null
            return
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }

    throw "$Name did not respond at $Uri within $TimeoutSeconds seconds."
}

function Stop-StartedProcess {
    param([System.Diagnostics.Process]$Process, [string]$Name)

    if ($null -eq $Process -or $Process.HasExited) {
        return
    }

    Write-Host "Stopping $Name (PID $($Process.Id))"
    Stop-Process -Id $Process.Id -Force
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$backendRoot = Join-Path $repoRoot "backend"
$frontendRoot = Join-Path $repoRoot "frontend"
$e2eRoot = Join-Path $repoRoot "e2e"
$runRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ".run"))

$cliProject = Resolve-FirstExistingPath `
    -Description "SecondLook CLI project" `
    -Candidates @((Join-Path $backendRoot "src\SecondLook.Cli\SecondLook.Cli.csproj"))

$apiProject = Resolve-FirstExistingPath `
    -Description "SecondLook API project" `
    -Candidates @((Join-Path $backendRoot "src\SecondLook.Api\SecondLook.Api.csproj"))

if ([string]::IsNullOrWhiteSpace($SeedDir)) {
    $SeedDir = Join-Path (Split-Path -Parent $cliProject) "Seed\Data"
}
$SeedDir = (Resolve-Path -LiteralPath $SeedDir).Path

if ($BackendPort -ne 5100) {
    throw "BackendPort must be 5100 because the Angular environment currently compiles API calls to http://localhost:5100."
}

if ($FrontendPort -eq $BackendPort) {
    throw "FrontendPort and BackendPort must be different."
}

$dotnet = Resolve-NativeCommand -Candidates @("dotnet.exe", "dotnet")
$npm = Resolve-NativeCommand -Candidates @("npm.cmd", "npm")
$node = Resolve-NativeCommand -Candidates @("node.exe", "node")
$ConnectionString = Resolve-LocalDbConnectionString -ConnectionString $ConnectionString

if (-not (Test-PortAvailable -Port $BackendPort)) {
    throw "Backend port $BackendPort is already in use."
}

if (-not (Test-PortAvailable -Port $FrontendPort)) {
    if ($PSBoundParameters.ContainsKey("FrontendPort")) {
        throw "Frontend port $FrontendPort is already in use."
    }

    $requestedFrontendPort = $FrontendPort
    $FrontendPort = Find-AvailablePort -StartingAt ($FrontendPort + 1)
    Write-Host "Frontend port $requestedFrontendPort is already in use; using $FrontendPort."
}

New-Item -ItemType Directory -Path $runRoot -Force | Out-Null
$runRoot = (Resolve-Path -LiteralPath $runRoot).Path

$packageSource = Join-Path $runRoot "tool-packages"
$toolPath = Join-Path $runRoot "tools\secondlook"
$apiOutput = Join-Path $runRoot "api"
$logsRoot = Join-Path $runRoot "logs"

Reset-RunDirectory -Path $packageSource
Reset-RunDirectory -Path $toolPath
Reset-RunDirectory -Path $apiOutput
Reset-RunDirectory -Path $logsRoot

if (-not (Test-Path -LiteralPath (Join-Path $frontendRoot "node_modules"))) {
    Invoke-Step `
        -Title "Installing frontend dependencies" `
        -FilePath $npm `
        -Arguments @("ci") `
        -WorkingDirectory $frontendRoot
}

if (-not (Test-Path -LiteralPath (Join-Path $e2eRoot "node_modules\http-server"))) {
    Invoke-Step `
        -Title "Installing e2e dependencies for the static frontend server" `
        -FilePath $npm `
        -Arguments @("ci") `
        -WorkingDirectory $e2eRoot
}

$toolVersion = "0.1.0-local.$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
Invoke-Step `
    -Title "Packing SecondLook CLI" `
    -FilePath $dotnet `
    -Arguments @("pack", $cliProject, "-c", $Configuration, "-o", $packageSource, "/p:PackageVersion=$toolVersion") `
    -WorkingDirectory $repoRoot

Invoke-Step `
    -Title "Installing freshly packed SecondLook CLI tool" `
    -FilePath $dotnet `
    -Arguments @("tool", "install", "SecondLook.Cli", "--tool-path", $toolPath, "--add-source", $packageSource, "--version", $toolVersion) `
    -WorkingDirectory $repoRoot

$toolAssembly = Get-ChildItem -LiteralPath (Join-Path $toolPath ".store") -Recurse -Filter "secondlook.dll" |
    Where-Object { $_.FullName -like "*$toolVersion*" } |
    Select-Object -First 1
if ($null -eq $toolAssembly) {
    throw "Could not find installed SecondLook CLI assembly under $toolPath."
}

Invoke-Step `
    -Title "Resetting database through freshly installed SecondLook CLI" `
    -FilePath $dotnet `
    -Arguments @($toolAssembly.FullName, "--connection", $ConnectionString, "--seed-dir", $SeedDir, "reset", "--yes") `
    -WorkingDirectory $repoRoot

Invoke-Step `
    -Title "Publishing backend API" `
    -FilePath $dotnet `
    -Arguments @("publish", $apiProject, "-c", $Configuration, "-o", $apiOutput) `
    -WorkingDirectory $repoRoot

Invoke-Step `
    -Title "Building frontend" `
    -FilePath $npm `
    -Arguments @("run", "build", "--", "secondlook", "--configuration", "development") `
    -WorkingDirectory $frontendRoot

$frontendDist = Join-Path $frontendRoot "dist\secondlook\browser"
if (-not (Test-Path -LiteralPath (Join-Path $frontendDist "index.html"))) {
    throw "Frontend build did not produce $frontendDist\index.html."
}

$httpServer = Resolve-FirstExistingPath `
    -Description "http-server binary" `
    -Candidates @(
        (Join-Path $e2eRoot "node_modules\http-server\bin\http-server"),
        (Join-Path $e2eRoot "node_modules\http-server\bin\http-server.js")
    )

$backendUrl = "http://localhost:$BackendPort"
$frontendUrl = "http://127.0.0.1:$FrontendPort/"
$apiProcess = $null
$frontendProcess = $null

try {
    $apiProcess = Start-LoggedProcess `
        -Name "backend API" `
        -FilePath $dotnet `
        -Arguments @("SecondLook.Api.dll") `
        -WorkingDirectory $apiOutput `
        -StdOutPath (Join-Path $logsRoot "backend.out.log") `
        -StdErrPath (Join-Path $logsRoot "backend.err.log") `
        -Environment @{
            "ASPNETCORE_ENVIRONMENT" = "Development"
            "ASPNETCORE_URLS" = $backendUrl
            "SECONDLOOK_CONNECTION" = $ConnectionString
        }

    $frontendProcess = Start-LoggedProcess `
        -Name "built frontend" `
        -FilePath $node `
        -Arguments @($httpServer, $frontendDist, "-a", "127.0.0.1", "-p", "$FrontendPort", "-c-1", "--silent", "-P", "${frontendUrl}?") `
        -WorkingDirectory $frontendRoot `
        -StdOutPath (Join-Path $logsRoot "frontend.out.log") `
        -StdErrPath (Join-Path $logsRoot "frontend.err.log")

    Wait-ForHttp -Name "Backend API" -Uri "$backendUrl/api/family" -Process $apiProcess
    Wait-ForHttp -Name "Built frontend" -Uri $frontendUrl -Process $frontendProcess

    Write-Host ""
    Write-Host "Frontend URL: $frontendUrl"
    Write-Host "Backend Swagger: $backendUrl/swagger"
    Write-Host "Logs: $logsRoot"
    Write-Host "Press Ctrl+C to stop both processes."

    if ($OpenBrowser) {
        Start-Process -FilePath $frontendUrl | Out-Null
    }

    while ($true) {
        if ($apiProcess.HasExited) {
            throw "Backend API exited. Exit code: $($apiProcess.ExitCode)"
        }

        if ($frontendProcess.HasExited) {
            throw "Frontend server exited. Exit code: $($frontendProcess.ExitCode)"
        }

        Start-Sleep -Seconds 2
    }
}
finally {
    Stop-StartedProcess -Process $frontendProcess -Name "built frontend"
    Stop-StartedProcess -Process $apiProcess -Name "backend API"
}
