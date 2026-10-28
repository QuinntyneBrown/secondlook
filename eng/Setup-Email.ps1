<#
.SYNOPSIS
    Set up outbound email for the API: Azure Communication Services behind the
    sending domain, the SMTP identity, and the GitHub secrets that wire them in
    (ADR-021).

.DESCRIPTION
    Run this once from a machine where `az login` has succeeded, then once more
    with -Verify after the DNS records it prints are in place at the registrar.
    Re-running is safe: every step converges. The script:

      1. Creates — or reuses — the Entra app registration the API presents to
         the SMTP relay (smtp.azurecomm.net) and its service principal, and
         issues a client secret when .deploy\azure.env does not hold one.
      2. Deploys eng\infra\email.bicep into the resource group: the Email
         Communication Service, the customer-managed domain, the no-reply
         sender, the Communication Services resource, and the role that lets
         the identity send. The same file is a module of eng\infra\main.bicep,
         so the next push to main converges on the same state.
      3. Prints the four DNS records Azure wants at the registrar: a TXT that
         proves ownership, SPF, and two DKIM CNAMEs.
      4. Stores EMAIL_DOMAIN, EMAIL_SMTP_CLIENT_ID, EMAIL_SMTP_PRINCIPAL_ID and
         EMAIL_DOMAIN_VERIFIED as repository variables and
         EMAIL_SMTP_CLIENT_SECRET as a repository secret with `gh`, and writes
         them to .deploy\azure.env (gitignored). Nothing secret is printed.
      5. With -Verify: asks Azure to check the records, waits until the domain
         is verified, links it to the Communication Services resource, points
         the API's app settings at the relay, and sets EMAIL_DOMAIN_VERIFIED.

.PARAMETER Domain
    The sending domain. Mail goes out as no-reply@<Domain>.

.PARAMETER Verify
    The DNS records are in place: start verification, wait for it, link the
    domain and switch the API to SMTP.

.PARAMETER DataLocation
    Where Azure keeps the mail metadata at rest. Fixed once the resources exist.

.EXAMPLE
    pwsh ./eng/Setup-Email.ps1 -Domain secondlook.ca
    # add the printed records at Namecheap, then:
    pwsh ./eng/Setup-Email.ps1 -Domain secondlook.ca -Verify
#>
[CmdletBinding()]
param(
    [string]$Domain = "secondlook.ca",
    [string]$ResourceGroup = "secondlook-rg",
    [string]$Suffix = "uofnt2",
    [string]$GitHubRepo = "QuinntyneBrown/secondlook",
    [string]$AppRegistrationName = "secondlook-smtp",
    [string]$DataLocation = "Canada",
    [string]$SubscriptionId,
    [switch]$Verify,
    [switch]$SkipGitHub
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$template = Join-Path $PSScriptRoot "infra/email.bicep"
$envFile = Join-Path $repoRoot ".deploy/azure.env"
$apiVersion = "2023-04-01"
$emailServiceName = "sl-email-$Suffix"
$communicationServiceName = "sl-comms-$Suffix"
$apiName = "sl-api-$Suffix"

function Invoke-Az {
    $out = & az @args
    if ($LASTEXITCODE -ne 0) { throw "az $($args -join ' ') failed (exit $LASTEXITCODE)." }
    return $out
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

function Get-Domain {
    # $null when the domain does not exist yet.
    $out = & az rest --method GET --url "$script:domainId`?api-version=$apiVersion" -o json 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return $out | ConvertFrom-Json
}

# ───────────────────────────── 0. prerequisites ─────────────────────────────

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI not found. Install it (https://aka.ms/installazurecli) and run 'az login' first."
}
if ($SubscriptionId) { Invoke-Az account set --subscription $SubscriptionId | Out-Null }
$account = Invoke-Az account show -o json | ConvertFrom-Json
Write-Host "Subscription: $($account.name) ($($account.id))"
Write-Host "Tenant:       $($account.tenantId)"
Invoke-Az bicep build --file $template --stdout | Out-Null

$rgId = Invoke-Az group show --name $ResourceGroup --query id -o tsv
$script:domainId = "$rgId/providers/Microsoft.Communication/emailServices/$emailServiceName/domains/$Domain"
$env_ = Read-EnvFile $envFile

# ───────────────────────────── 1. SMTP identity ─────────────────────────────

$clientId = Invoke-Az ad app list --display-name $AppRegistrationName --query "[0].appId" -o tsv
if (-not $clientId) {
    $clientId = Invoke-Az ad app create --display-name $AppRegistrationName --sign-in-audience AzureADMyOrg --query appId -o tsv
    Write-Host "Created app registration $AppRegistrationName ($clientId)."
} else {
    Write-Host "Reusing app registration $AppRegistrationName ($clientId)."
}
$principalId = Invoke-Az ad sp list --filter "appId eq '$clientId'" --query "[0].id" -o tsv
if (-not $principalId) {
    $principalId = Invoke-Az ad sp create --id $clientId --query id -o tsv
    Write-Host "Created service principal for $clientId."
}

$clientSecret = $env_['EMAIL_SMTP_CLIENT_SECRET']
if (-not $clientSecret) {
    # --append keeps any credential already issued; this one is the relay's.
    $clientSecret = Invoke-Az ad app credential reset --id $clientId --append --display-name "smtp-relay" --years 2 --query password -o tsv
    Write-Host "Issued a client secret for $AppRegistrationName (valid two years)."
}

# ───────────────────────────── 2. resources ─────────────────────────────

$existing = Get-Domain
$verified = $existing -and $existing.properties.verificationStates.Domain.status -eq 'Verified'

function Deploy-Email([bool]$link) {
    $tags = '{"app":"secondlook","managedBy":"bicep","purpose":"account-mail"}'
    return Invoke-Az deployment group create --resource-group $ResourceGroup --name "secondlook-email" `
        --template-file $template `
        --parameters emailServiceName=$emailServiceName communicationServiceName=$communicationServiceName `
            domainName=$Domain dataLocation=$DataLocation domainVerified=$($link.ToString().ToLower()) `
            smtpPrincipalId=$principalId tags=$tags `
        --query properties.outputs -o json | ConvertFrom-Json
}

$outputs = Deploy-Email $verified
Write-Host "Deployed $emailServiceName / $communicationServiceName for $Domain."

# ───────────────────────────── 3. verification ─────────────────────────────

if ($Verify -and -not $verified) {
    foreach ($type in 'Domain', 'SPF', 'DKIM', 'DKIM2') {
        & az rest --method POST --url "$script:domainId/initiateVerification?api-version=$apiVersion" `
            --body "{`"verificationType`":`"$type`"}" -o none 2>$null
    }
    Write-Host "Verification requested; waiting for Azure to see the records..."
    $deadline = (Get-Date).AddMinutes(15)
    do {
        Start-Sleep -Seconds 20
        $states = (Get-Domain).properties.verificationStates
        $summary = ('Domain', 'SPF', 'DKIM', 'DKIM2' | ForEach-Object { "$_=$($states.$_.status)" }) -join ' '
        Write-Host "  $summary"
        $verified = $states.Domain.status -eq 'Verified'
    } until ($verified -or (Get-Date) -gt $deadline)
    if (-not $verified) {
        throw "The domain did not verify in 15 minutes. Check the records below at the registrar (TTL and propagation), then re-run with -Verify."
    }
    $outputs = Deploy-Email $true
    Write-Host "Domain verified and linked to $communicationServiceName."
}

$records = $outputs.verificationRecords.value
Write-Host ""
Write-Host "DNS records for ${Domain} (host names are relative to the zone):"
foreach ($name in 'Domain', 'SPF', 'DKIM', 'DKIM2') {
    $r = $records.$name
    if ($r) { Write-Host ("  {0,-6} {1,-5} {2,-40} {3}" -f $name, $r.type, $r.name, $r.value) }
}
Write-Host "  SPF merges into the existing record when the zone already has one: a domain may hold only one."
$states = $outputs.verificationStatus.value
Write-Host ("Status: " + (('Domain', 'SPF', 'DKIM', 'DKIM2' | ForEach-Object { "$_=$($states.$_.status)" }) -join ' '))

# ───────────────────────────── 4. API settings ─────────────────────────────

$smtpUsername = "$communicationServiceName.$clientId.$($account.tenantId)"
if ($verified) {
    # The same values main.bicep writes on the next push; setting them now
    # means mail flows without waiting for a deployment.
    Invoke-Az webapp config appsettings set -g $ResourceGroup -n $apiName -o none --settings `
        "SecondLook__Email__From=SecondLook <no-reply@$Domain>" `
        "SecondLook__Email__SmtpHost=smtp.azurecomm.net" `
        "SecondLook__Email__SmtpPort=587" `
        "SecondLook__Email__SmtpStartTls=true" `
        "SecondLook__Email__SmtpUsername=$smtpUsername" `
        "SecondLook__Email__SmtpPassword=$clientSecret"
    Write-Host "$apiName now sends through smtp.azurecomm.net as no-reply@$Domain."
}

# ───────────────────────────── 5. GitHub & env file ─────────────────────────────

$variables = [ordered]@{
    EMAIL_DOMAIN            = $Domain
    EMAIL_DOMAIN_VERIFIED   = $verified.ToString().ToLower()
    EMAIL_SMTP_CLIENT_ID    = $clientId
    EMAIL_SMTP_PRINCIPAL_ID = $principalId
}
$secrets = [ordered]@{ EMAIL_SMTP_CLIENT_SECRET = $clientSecret }

foreach ($k in $variables.Keys) { $env_[$k] = $variables[$k] }
foreach ($k in $secrets.Keys) { $env_[$k] = $secrets[$k] }
Write-EnvFile $envFile $env_
Write-Host "Wrote $envFile (gitignored)."

$gh = Get-Command gh -ErrorAction SilentlyContinue
$ghReady = $false
if ($gh -and -not $SkipGitHub) {
    & gh auth status 2>&1 | Out-Null
    $ghReady = ($LASTEXITCODE -eq 0)
}
if ($ghReady) {
    foreach ($k in $secrets.Keys) {
        & gh secret set $k --repo $GitHubRepo --body "$($secrets[$k])"
        if ($LASTEXITCODE -ne 0) { throw "gh secret set $k failed." }
    }
    foreach ($k in $variables.Keys) {
        & gh variable set $k --repo $GitHubRepo --body "$($variables[$k])"
        if ($LASTEXITCODE -ne 0) { throw "gh variable set $k failed." }
    }
    Write-Host "GitHub secrets and variables set on $GitHubRepo."
} else {
    Write-Host ""
    Write-Host "GitHub CLI not available or not signed in. In https://github.com/$GitHubRepo/settings/secrets/actions set:"
    Write-Host "  Secret:    $($secrets.Keys -join ', ')"
    Write-Host "  Variables: $($variables.Keys -join ', ')"
    Write-Host "  (values are in $envFile)"
}

Write-Host ""
if (-not $verified) {
    Write-Host "Next: add the records above at the registrar, then re-run with -Verify."
} else {
    Write-Host "Done. Sign up with a real address, or request a password reset, and the mail arrives from no-reply@$Domain."
}
