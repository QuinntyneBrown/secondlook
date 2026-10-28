// Microsoft Foundry account + one Claude deployment for catalog ingestion (ADR-011).
//
// Deploy into secondlook-rg with eng/Deploy-Foundry.ps1. The account lives in
// eastus2 (not the group's canadacentral) because Claude isn't offered in
// Canadian regions. Idempotent: re-running converges on the same state.
//
// Shape follows the Claude on Foundry starter kit
// (github.com/Azure-Samples/claude, infra-bicep/infra/foundry.bicep).

@description('Foundry account name; also the custom subdomain, so the endpoint is https://<name>.services.ai.azure.com/anthropic.')
param accountName string = 'sl-ai-uofnt2'

@description('Region that offers the chosen Claude model on Global Standard.')
param location string = 'eastus2'

@description('Deployment name; the ingestion client sends it as the "model" field.')
param deploymentName string = 'claude-sonnet-5'

param modelName string = 'claude-sonnet-5'

@description('Model version 2 is the "Hosted on Azure" build; 1 runs on Anthropic infrastructure.')
param modelVersion string = '2'

@description('Thousands of tokens per minute. Capacity is free; tokens are billed per use.')
param capacity int = 80

// Anthropic Marketplace attestation: sending modelProviderData accepts the offer
// on the subscription's behalf. It must describe the real organization.
@description('Legal name of the organization using Claude.')
param organizationName string

@description('Two-letter ISO country code.')
@minLength(2)
@maxLength(2)
param countryCode string

@allowed(['technology', 'finance', 'healthcare', 'education', 'retail', 'manufacturing', 'government', 'media', 'other'])
param industry string = 'technology'

param tags object = {
  app: 'secondlook'
  purpose: 'catalog-ingestion'
}

resource account 'Microsoft.CognitiveServices/accounts@2025-10-01-preview' = {
  name: accountName
  location: location
  tags: tags
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
    // Ingestion authenticates with the account key (x-api-key).
    disableLocalAuth: false
  }
}

resource claude 'Microsoft.CognitiveServices/accounts/deployments@2025-10-01-preview' = {
  parent: account
  name: deploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: capacity
  }
  properties: {
    model: {
      format: 'Anthropic'
      name: modelName
      version: modelVersion
    }
    // The RP accepts this (it's what the starter kit sends); Bicep's type
    // definitions for DeploymentProperties don't list it yet.
    #disable-next-line BCP037
    modelProviderData: {
      organizationName: organizationName
      countryCode: countryCode
      industry: industry
    }
    // Pin the Azure-hosted version; an automatic upgrade must not move the
    // deployment to a different hosting model.
    versionUpgradeOption: 'NoAutoUpgrade'
    raiPolicyName: 'Microsoft.DefaultV2'
  }
}

output baseUrl string = 'https://${account.name}.services.ai.azure.com/anthropic/'
output accountName string = account.name
output deploymentName string = claude.name
