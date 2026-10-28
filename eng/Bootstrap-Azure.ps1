<#
.SYNOPSIS
    One-time setup for continuous deployment of SecondLook to Azure (ADR-017).

.DESCRIPTION
    Run this once from a machine where `az login` has succeeded. Afterwards every
    push to main provisions and deploys the whole stack through
    .github/workflows/deploy.yml. The script:

      1. Creates the resource group (canadacentral) if it is missing.
      2. Creates — or reuses — the Entra app registration GitHub Actions signs in
         with (OpenID Connect, no client secret), adds the federated credential
         for pushes to main, and grants it Contributor on the resource group.
      3. Resolves the application secrets. Values already live in Azure (the API's
         JWT and photo signing keys, the SQL admin login) are kept so nobody is
         signed out and no photo link breaks; anything else is generated. All of
         it is written to .deploy\azure.env (gitignored) and never printed.
      4. Stores the secrets and variables in the GitHub repository with `gh`
         when it is installed and authenticated; otherwise tells you what to paste.
      5. Shows a what-if of eng\infra\main.bicep against the resource group and,
         on confirmation, runs the first deployment so the Static Web Apps,
         SQL server, App Service and Claude deployment exist before the first push.

    Re-running is safe: every step converges.

.PARAMETER OrganizationName
    Legal name of the organization using Claude — the Anthropic Marketplace
    attestation sent with the Foundry deployment (ADR-011).

.PARAMETER ClientId
    Reuse an existing app registration (the AZURE_CLIENT_ID GitHub already holds)
    instead of looking one up by display name.

.PARAMETER CustomDomain
    Family-app domain to bind to the Static Web App, e.g. app.secondlook.ca. Leave
    blank until its DNS TXT validation record exists.

.PARAMETER AdminDomain
    Admin-app domain to bind to its Static Web App, e.g. admin.secondlook.ca
    (ADR-014). Leave blank until its DNS TXT validation record exists.

.PARAMETER MarketingDomain
    Marketing-site domain to bind to its Static Web App, e.g. www.secondlook.ca
    (ADR-018). Leave blank until its DNS TXT validation record exists.

.PARAMETER MarketingApexDomain
    Apex domain to bind beside it, e.g. secondlook.ca, so it redirects to www.
    Leave blank to use the registrar's redirect instead (ADR-018).

.PARAMETER BudgetAlertEmail
    Where the monthly budget alerts go. Blank disables the budget.

.PARAMETER GoogleClientId
    The web OAuth client id for "Continue with Google" (ADR-019). Public.

.PARAMETER GoogleClientSecret
    That client's secret, for Google Calendar sync (ADR-022). Blank keeps the
    secret already deployed, or calendar sync off when there is none.

.PARAMETER Force
    Skip the what-if confirmation.

.EXAMPLE
    pwsh ./eng/Bootstrap-Azure.ps1 -OrganizationName "13556735 Canada Inc." -BudgetAlertEmail you@example.com
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$OrganizationName,
    [string]$CountryCode = "CA",
    [string]$GitHubRepo = "QuinntyneBrown/secondlook",
    [string]$ResourceGroup = "secondlook-rg",
    [string]$Location = "canadacentral",
    [string]$SubscriptionId,
    [string]$AppRegistrationName = "secondlook-github-actions",
    [string]$ClientId,
    [string]$CustomDomain = "",
    [string]$AdminDomain = "",
    [string]$MarketingDomain = "",
    [string]$MarketingApexDomain = "",
    [string]$BudgetAlertEmail = "",
    [string]$GoogleClientId = "",
    [string]$GoogleClientSecret = "",
    [string]$SqlAdminLogin = "secondlook_admin",
    [switch]$SkipGitHub,
    [switch]$SkipDeploy,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$template = Join-Path $PSScriptRoot "infra/main.bicep"
$parameters = Join-Path $PSScriptRoot "infra/main.bicepparam"
$envFile = Join-Path $repoRoot ".deploy/azure.env"
$deploymentName = "secondlook-infra"

function Invoke-Az {
    # stdout is the result; az's own warnings stay on stderr and reach the console.
    $out = & az @args
    if ($LASTEXITCODE -ne 0) { throw "az $($args -join ' ') failed (exit $LASTEXITCODE)." }
    return $out
}

function New-Secret([int]$bytes = 48) {
    $buffer = [byte[]]::new($bytes)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-SqlPassword {
    # 32+ chars with all four character classes, no quotes or semicolons
    # (it travels inside a connection string).
    return (New-Secret 24) + "Aa1!"
}

function Read-EnvFile([string]$path) {
    $map = @{}
    if (Test-Path $path) {
        foreach ($line in Get-Content $path) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $map[$Matches[1]] = $Matches[2] }
        }
    }
    return $map
}

function Write-EnvFile([string]$path, [hashtable]$map) {
    New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
    $lines = $map.Keys | Sort-Object | ForEach-Object { "$_=$($map[$_])" }
    [System.IO.File]::WriteAllLines($path, [string[]]$lines)  # UTF-8 without BOM
}

# ───────────────────────────── 0. prerequisites ─────────────────────────────

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI not found. Install it (https://aka.ms/installazurecli) and run 'az login' first."
}
if ($SubscriptionId) { Invoke-Az account set --subscription $SubscriptionId | Out-Null }
$account = Invoke-Az account show -o json | ConvertFrom-Json
Write-Host "Subscription: $($account.name) ($($account.id))"
Write-Host "Tenant:       $($account.tenantId)"

# The template compiles locally before anything is touched.
Invoke-Az bicep build --file $template --stdout | Out-Null

# ───────────────────────────── 1. resource group ─────────────────────────────

Invoke-Az group create --name $ResourceGroup --location $Location --tags app=secondlook managedBy=bicep -o none
$rgId = Invoke-Az group show --name $ResourceGroup --query id -o tsv
Write-Host "Resource group $ResourceGroup ready."

# ───────────────────────────── 2. GitHub → Azure identity (OIDC) ─────────────────────────────

if (-not $ClientId) {
    $ClientId = Invoke-Az ad app list --display-name $AppRegistrationName --query "[0].appId" -o tsv
    if (-not $ClientId) {
        $ClientId = Invoke-Az ad app create --display-name $AppRegistrationName --query appId -o tsv
        Write-Host "Created app registration $AppRegistrationName ($ClientId)."
    } else {
        Write-Host "Reusing app registration $AppRegistrationName ($ClientId)."
    }
}

$spObjectId = Invoke-Az ad sp list --filter "appId eq '$ClientId'" --query "[0].id" -o tsv
if (-not $spObjectId) {
    $spObjectId = Invoke-Az ad sp create --id $ClientId --query id -o tsv
    Write-Host "Created service principal for $ClientId."
}

$subject = "repo:${GitHubRepo}:ref:refs/heads/main"
$existingCreds = Invoke-Az ad app federated-credential list --id $ClientId -o json | ConvertFrom-Json
if (-not ($existingCreds | Where-Object { $_.subject -eq $subject })) {
    $cred = @{
        name        = "github-main"
        issuer      = "https://token.actions.githubusercontent.com"
        subject     = $subject
        description = "GitHub Actions: pushes to main in $GitHubRepo"
        audiences   = @("api://AzureADTokenExchange")
    } | ConvertTo-Json -Compress
    $credFile = New-TemporaryFile
    Set-Content -Path $credFile -Value $cred -NoNewline
    try { Invoke-Az ad app federated-credential create --id $ClientId --parameters "@$credFile" -o none }
    finally { Remove-Item $credFile -ErrorAction SilentlyContinue }
    Write-Host "Added federated credential for $subject."
}

# Contributor on the resource group covers every resource the template manages,
# reading Static Web App tokens and the Foundry key, and the SQL firewall rules
# the migration job opens and closes.
Invoke-Az role assignment create --assignee-object-id $spObjectId --assignee-principal-type ServicePrincipal `
    --role Contributor --scope $rgId -o none
Write-Host "Contributor on $ResourceGroup granted to $AppRegistrationName."

# ───────────────────────────── 3. application secrets ─────────────────────────────

$env_ = Read-EnvFile $envFile
$suffix = 'uofnt2'
$apiName = "sl-api-$suffix"
$sqlServerName = "sl-sql-$suffix"

# Live values win: rotating these would sign every family out / break photo links.
$liveSettings = @{}
if ((Invoke-Az webapp list -g $ResourceGroup --query "[?name=='$apiName'] | length(@)" -o tsv) -eq '1') {
    $raw = Invoke-Az webapp config appsettings list -g $ResourceGroup -n $apiName -o json | ConvertFrom-Json
    foreach ($s in $raw) { $liveSettings[$s.name] = $s.value }
    Write-Host "Found existing Web App $apiName; keeping its signing keys."
}
if ((Invoke-Az sql server list -g $ResourceGroup --query "[?name=='$sqlServerName'] | length(@)" -o tsv) -eq '1') {
    $liveLogin = Invoke-Az sql server show -g $ResourceGroup -n $sqlServerName --query administratorLogin -o tsv
    if ($liveLogin) {
        $SqlAdminLogin = $liveLogin
        Write-Host "Found existing SQL server $sqlServerName; keeping admin login '$SqlAdminLogin'."
    }
}

function Resolve-Secret([string]$name, [string]$live, [scriptblock]$generate) {
    if ($live) { return $live }
    if ($env_.ContainsKey($name) -and $env_[$name]) { return $env_[$name] }
    Write-Host "Generating $name."
    return & $generate
}

$secrets = [ordered]@{
    AZURE_CLIENT_ID              = $ClientId
    AZURE_TENANT_ID              = $account.tenantId
    AZURE_SUBSCRIPTION_ID        = $account.id
    SQL_ADMIN_LOGIN              = $SqlAdminLogin
    SQL_ADMIN_PASSWORD           = Resolve-Secret 'SQL_ADMIN_PASSWORD' $null { New-SqlPassword }
    SECONDLOOK_JWT_SIGNING_KEY    = Resolve-Secret 'SECONDLOOK_JWT_SIGNING_KEY' $liveSettings['SECONDLOOK_JWT_SIGNING_KEY'] { New-Secret 48 }
    SECONDLOOK_PHOTOS_SIGNING_KEY = Resolve-Secret 'SECONDLOOK_PHOTOS_SIGNING_KEY' $liveSettings['SecondLook__Photos__SigningKey'] { New-Secret 48 }
    # Google Calendar sync (ADR-022): optional; the one already deployed is kept.
    GOOGLE_CLIENT_SECRET         = if ($GoogleClientSecret) { $GoogleClientSecret } else { "$($liveSettings['SecondLook__Google__ClientSecret'])" }
}
$variables = [ordered]@{
    FOUNDRY_ORGANIZATION_NAME = $OrganizationName
    FOUNDRY_COUNTRY_CODE      = $CountryCode
    APP_CUSTOM_DOMAIN         = $CustomDomain
    ADMIN_CUSTOM_DOMAIN       = $AdminDomain
    MARKETING_CUSTOM_DOMAIN   = $MarketingDomain
    MARKETING_APEX_DOMAIN     = $MarketingApexDomain
    BUDGET_ALERT_EMAIL        = $BudgetAlertEmail
    GOOGLE_CLIENT_ID          = $GoogleClientId
}

foreach ($k in $secrets.Keys) { $env_[$k] = $secrets[$k] }
foreach ($k in $variables.Keys) { $env_[$k] = $variables[$k] }
if ($liveSettings['ANTHROPIC_FOUNDRY_API_KEY']) { $env_['ANTHROPIC_FOUNDRY_API_KEY'] = $liveSettings['ANTHROPIC_FOUNDRY_API_KEY'] }
Write-EnvFile $envFile $env_
Write-Host "Wrote $envFile (gitignored)."

# ───────────────────────────── 4. GitHub secrets & variables ─────────────────────────────

$gh = Get-Command gh -ErrorAction SilentlyContinue
$ghReady = $false
if ($gh -and -not $SkipGitHub) {
    & gh auth status 2>&1 | Out-Null
    $ghReady = ($LASTEXITCODE -eq 0)
}
if ($ghReady) {
    foreach ($k in $secrets.Keys) {
        # Optional secrets (GOOGLE_CLIENT_SECRET) stay unset until they have a value.
        if ("$($secrets[$k])" -eq '') { continue }
        & gh secret set $k --repo $GitHubRepo --body "$($secrets[$k])"
        if ($LASTEXITCODE -ne 0) { throw "gh secret set $k failed." }
    }
    foreach ($k in $variables.Keys) {
        if ("$($variables[$k])" -eq '') {
            # GitHub rejects an empty value; absent reads as '' in the workflow.
            & gh variable delete $k --repo $GitHubRepo 2>&1 | Out-Null
            continue
        }
        & gh variable set $k --repo $GitHubRepo --body "$($variables[$k])"
        if ($LASTEXITCODE -ne 0) { throw "gh variable set $k failed." }
    }
    Write-Host "GitHub secrets and variables set on $GitHubRepo."
} else {
    Write-Host ""
    Write-Host "GitHub CLI not available or not signed in. In https://github.com/$GitHubRepo/settings/secrets/actions set:"
    Write-Host "  Secrets:   $($secrets.Keys -join ', ')"
    Write-Host "  Variables: $($variables.Keys -join ', ')"
    Write-Host "  (values are in $envFile)"
    Write-Host ""
}

# ───────────────────────────── 5. first deployment ─────────────────────────────

if ($SkipDeploy) { Write-Host "Skipping deployment (-SkipDeploy)."; return }

foreach ($k in $secrets.Keys) { Set-Item -Path "Env:$k" -Value $secrets[$k] }
foreach ($k in $variables.Keys) { Set-Item -Path "Env:$k" -Value $variables[$k] }

Write-Host ""
Write-Host "Existing resources in ${ResourceGroup}:"
Invoke-Az resource list -g $ResourceGroup --query "[].{name:name,type:type,location:location}" -o table | Write-Host

Write-Host ""
Write-Host "What-if for ${template}:"
& az deployment group what-if --resource-group $ResourceGroup --name $deploymentName `
    --template-file $template --parameters $parameters
if ($LASTEXITCODE -ne 0) { throw "what-if failed." }

if (-not $Force) {
    $answer = Read-Host "Apply this deployment? [y/N]"
    if ($answer -notmatch '^[Yy]') { Write-Host "Stopped before deploying."; return }
}

$outputs = Invoke-Az deployment group create --resource-group $ResourceGroup --name $deploymentName `
    --template-file $template --parameters $parameters --query properties.outputs -o json | ConvertFrom-Json

Write-Host ""
Write-Host "Deployed."
Write-Host "  API:            $($outputs.apiOrigin.value)"
Write-Host "  Family app:     https://$($outputs.webSwaHostName.value)"
Write-Host "  Admin app:      https://$($outputs.adminSwaHostName.value)"
Write-Host "  Design system:  https://$($outputs.designSwaHostName.value)"
Write-Host "  Marketing site: https://$($outputs.marketingSwaHostName.value)"
Write-Host "  SQL:            $($outputs.sqlServerFqdn.value) / $($outputs.sqlDatabaseName.value)"
Write-Host "  Claude:         $($outputs.foundryBaseUrl.value) -> $($outputs.claudeDeploymentName.value)"
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Push to main — deploy.yml ships the API, WebJob, migrations, the SPAs and the marketing site."
Write-Host "  2. If the API host above differs from the one in frontend/projects/*/src/environments/environment.prod.ts, update it."
Write-Host "  3. Retire the old SECONDLOOK_CONNECTION and SWA_*_DEPLOYMENT_TOKEN secrets; the workflow no longer reads them."
if (-not $CustomDomain) {
    Write-Host "  4. When app.secondlook.ca's DNS points at the family app's Static Web App, re-run with -CustomDomain app.secondlook.ca."
}
if (-not $MarketingDomain) {
    Write-Host "  5. When www.secondlook.ca (and the apex) point at the marketing Static Web App, re-run with -MarketingDomain www.secondlook.ca -MarketingApexDomain secondlook.ca (ADR-018)."
}
if (-not $AdminDomain) {
    Write-Host "  6. When admin.secondlook.ca's DNS points at the admin Static Web App, re-run with -AdminDomain admin.secondlook.ca (ADR-014)."
}
Write-Host "  7. Outbound email: pwsh ./eng/Setup-Email.ps1 -Domain secondlook.ca, add its DNS records, then re-run with -Verify (ADR-021)."
