<#
.SYNOPSIS
    Provision the Microsoft Foundry account and Claude deployment that catalog
    ingestion calls, then store its key in .deploy\azure.env.

.DESCRIPTION
    Standalone deployment of the Foundry pieces only. In production the same
    template is a module of eng\infra\main.bicep, which deploy.yml applies on every
    push to main (ADR-017); use this script for a local-only Claude setup.

    Deploys eng\foundry\claude.bicep into the resource group (an AIServices
    account in eastus2 plus a Global Standard claude-sonnet-5 deployment, the
    Azure-hosted version 2). Re-running is safe: the deployment converges on the
    same state. Afterwards the account key is written to .deploy\azure.env as
    ANTHROPIC_FOUNDRY_API_KEY (the file is gitignored); the key is never printed.

    Deploying accepts the Anthropic Marketplace offer for the subscription via
    the organization, country and industry attestation (see ADR-011). Tokens
    are billed per use; the account itself has no monthly fee.

    Use the key for a local run:
        $env:ANTHROPIC_FOUNDRY_API_KEY = (Select-String '^ANTHROPIC_FOUNDRY_API_KEY=' .deploy\azure.env).Line.Split('=', 2)[1]
        dotnet run --project .\backend\src\SecondLook.Cli -- ingest --type events --dry-run

.PARAMETER OrganizationName
    Legal name of the organization using Claude (Marketplace attestation).

.PARAMETER CountryCode
    Two-letter country code for the attestation. Default CA.

.PARAMETER Industry
    Attestation industry. Default technology.

.PARAMETER NoKey
    Skip writing the key to .deploy\azure.env.
#>
param(
    [Parameter(Mandatory)][string]$OrganizationName,
    [string]$CountryCode = "CA",
    [string]$Industry = "technology",
    [string]$ResourceGroup = "secondlook-rg",
    [string]$AccountName = "sl-ai-uofnt2",
    [string]$Location = "eastus2",
    [int]$Capacity = 80,
    [switch]$NoKey
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$template = Join-Path $PSScriptRoot "foundry\claude.bicep"

Write-Host "Deploying $AccountName ($Location) into $ResourceGroup ..."
$outputs = az deployment group create `
    --resource-group $ResourceGroup `
    --name "foundry-claude" `
    --template-file $template `
    --parameters accountName=$AccountName location=$Location capacity=$Capacity `
                 organizationName=$OrganizationName countryCode=$CountryCode industry=$Industry `
    --query "properties.outputs" -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "az deployment group create failed (exit $LASTEXITCODE)." }

Write-Host "Endpoint:   $($outputs.baseUrl.value)"
Write-Host "Deployment: $($outputs.deploymentName.value)"

if ($NoKey) { return }

$key = az cognitiveservices account keys list -g $ResourceGroup -n $AccountName --query key1 -o tsv
if ($LASTEXITCODE -ne 0 -or -not $key) { throw "Could not read the account key for $AccountName." }

$envFile = Join-Path $repoRoot ".deploy\azure.env"
New-Item -ItemType Directory -Force (Split-Path $envFile) | Out-Null
$lines = @(if (Test-Path $envFile) { Get-Content $envFile | Where-Object { $_ -notmatch '^ANTHROPIC_FOUNDRY_API_KEY=' } })
$lines += "ANTHROPIC_FOUNDRY_API_KEY=$key"
[System.IO.File]::WriteAllLines($envFile, [string[]]$lines)  # UTF-8 without BOM on 5.1 and 7
Write-Host "Stored ANTHROPIC_FOUNDRY_API_KEY in .deploy\azure.env"
