<#
.SYNOPSIS
    One-time setup so every push to main deploys SecondLook to Azure (ADR-0017).

.DESCRIPTION
    Run once from a machine where `az login` and `gh auth login` have succeeded.
    Re-running is safe: every step converges.

      1. Creates the resource group if it is missing.
      2. Creates (or reuses) the Entra app registration GitHub Actions signs in
         with via OpenID Connect (no client secret), adds the federated credential
         for pushes to main, and grants it Contributor on the resource group.
      3. Sets the GitHub repository secrets the deploy workflow reads. The SQL
         password and JWT signing key are generated on the first run and kept
         afterwards, so nobody is signed out by a re-run.

    Nothing is printed that is secret. Generated values are stored only in GitHub.

.PARAMETER Repo
    GitHub repository as owner/name.
#>
[CmdletBinding()]
param(
    [string]$Repo = 'QuinntyneBrown/secondlook',
    [string]$ResourceGroup = 'secondlook-rg',
    [string]$Location = 'canadacentral',
    [string]$AppName = 'secondlook-github-deploy'
)

$ErrorActionPreference = 'Stop'

function New-Secret([int]$Bytes) {
    $b = [byte[]]::new($Bytes)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($b)
    [Convert]::ToBase64String($b)
}

$account = az account show --output json | ConvertFrom-Json
$subscriptionId = $account.id
$tenantId = $account.tenantId
Write-Host "Subscription $($account.name) ($subscriptionId)"

az group create --name $ResourceGroup --location $Location --tags app=secondlook managedBy=bicep --output none

$clientId = az ad app list --display-name $AppName --query '[0].appId' --output tsv
if (-not $clientId) {
    $clientId = az ad app create --display-name $AppName --query appId --output tsv
    az ad sp create --id $clientId --output none
}

$credential = @{
    name      = 'github-main'
    issuer    = 'https://token.actions.githubusercontent.com'
    subject   = "repo:${Repo}:ref:refs/heads/main"
    audiences = @('api://AzureADTokenExchange')
} | ConvertTo-Json -Compress
$existing = az ad app federated-credential list --id $clientId --query "[?name=='github-main'] | length(@)" --output tsv
if ($existing -eq '0') {
    $file = New-TemporaryFile
    Set-Content -Path $file -Value $credential
    az ad app federated-credential create --id $clientId --parameters "@$file" --output none
    Remove-Item $file
}

$scope = "/subscriptions/$subscriptionId/resourceGroups/$ResourceGroup"
az role assignment create --assignee $clientId --role Contributor --scope $scope --output none 2>$null

$have = gh secret list --repo $Repo --json name --jq '.[].name'
gh secret set AZURE_CLIENT_ID --repo $Repo --body $clientId
gh secret set AZURE_TENANT_ID --repo $Repo --body $tenantId
gh secret set AZURE_SUBSCRIPTION_ID --repo $Repo --body $subscriptionId
if ($have -notcontains 'SQL_ADMIN_LOGIN') { gh secret set SQL_ADMIN_LOGIN --repo $Repo --body 'slsqladmin' }
if ($have -notcontains 'SQL_ADMIN_PASSWORD') { gh secret set SQL_ADMIN_PASSWORD --repo $Repo --body ("Aa1!" + (New-Secret 24)) }
if ($have -notcontains 'SECONDLOOK_JWT_SIGNING_KEY') { gh secret set SECONDLOOK_JWT_SIGNING_KEY --repo $Repo --body (New-Secret 48) }

Write-Host 'Done. The next push to main provisions and deploys the stack.'
