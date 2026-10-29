// SecondLook production stack in one idempotent template. Deployed into
// secondlook-rg by .github/workflows/deploy.yml on every push to main.
//
// Sized for a handful of testers: the cheapest tiers that still run the app.
//
//   App Service plan   Linux Free F1 (no Always On, 60 CPU min/day)   US$0
//   Azure SQL          Basic (5 DTU, 2 GB)                            about US$5/month
//   Static Web Apps    Standard x2 (secondlook, admin; no Free slots) about US$18/month
//
// F1 sleeps when idle, so the first request after a quiet spell is slow. Move
// apiSkuName to 'B1' when real traffic arrives (Always On turns on with it).
// Re-running converges on the same state; nothing here is destructive.

targetScope = 'resourceGroup'

@description('Short suffix shared by every resource name (sl-api-<suffix>, sl-sql-<suffix>, ...).')
param suffix string = 'uofnt2'

param location string = resourceGroup().location

@description('Static Web Apps are only offered in a few regions; eastus2 is the closest to canadacentral.')
param swaLocation string = 'eastus2'

param planName string = 'sl-plan-${suffix}'
param apiName string = 'sl-api-${suffix}'
param sqlServerName string = 'sl-sql-${suffix}'
param sqlDatabaseName string = 'secondlook'
param webSwaName string = 'sl-web-${suffix}'
param adminSwaName string = 'sl-admin-${suffix}'

@description('F1 is the only free Linux tier. Use B1 once the app needs Always On.')
param apiSkuName string = 'F1'

@description('Basic is the cheapest SQL tier with backups.')
param sqlSkuName string = 'Basic'
param sqlMaxSizeBytes int = 2147483648
param swaSkuName string = 'Free'

@description('Custom domain for the buyer app, once its DNS TXT validation record exists.')
param appCustomDomain string = ''
param adminCustomDomain string = ''
param extraCorsOrigins array = []

@secure()
param sqlAdminLogin string
@secure()
param sqlAdminPassword string
@secure()
@description('SecondLook:Jwt:SigningKey, at least 32 characters.')
param jwtSigningKey string

param tags object = {
  app: 'secondlook'
  managedBy: 'bicep'
}

var webOrigin = 'https://${webSwa.properties.defaultHostname}'
var adminOrigin = 'https://${adminSwa.properties.defaultHostname}'
var corsOrigins = union(
  concat(
    [webOrigin, adminOrigin],
    empty(appCustomDomain) ? [] : ['https://${appCustomDomain}'],
    empty(adminCustomDomain) ? [] : ['https://${adminCustomDomain}']
  ),
  extraCorsOrigins
)

// SecondLook__Cors__AllowedOrigins__0, __1, ... bind to SecondLook:Cors:AllowedOrigins.
var corsSettings = toObject(
  range(0, length(corsOrigins)),
  i => 'SecondLook__Cors__AllowedOrigins__${i}',
  i => corsOrigins[i]
)

var sqlConnectionString = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDatabaseName};User ID=${sqlAdminLogin};Password=${sqlAdminPassword};Encrypt=True;TrustServerCertificate=False;MultipleActiveResultSets=False;Connection Timeout=30;'

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
  location: location
  tags: tags
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    // The migration job connects from a GitHub runner through a firewall rule
    // it adds and removes around the run.
    publicNetworkAccess: 'Enabled'
  }

  // Lets the App Service reach the server without a per-outbound-IP rule.
  resource allowAzure 'firewallRules' = {
    name: 'AllowAllWindowsAzureIps'
    properties: {
      startIpAddress: '0.0.0.0'
      endIpAddress: '0.0.0.0'
    }
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  tags: tags
  sku: { name: sqlSkuName, tier: sqlSkuName == 'Basic' ? 'Basic' : 'Standard' }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: sqlMaxSizeBytes
    zoneRedundant: false
    requestedBackupStorageRedundancy: 'Local'
  }
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'linux'
  sku: { name: apiSkuName }
  properties: {
    reserved: true // Linux
  }
}

resource api 'Microsoft.Web/sites@2024-04-01' = {
  name: apiName
  location: location
  tags: tags
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      alwaysOn: apiSkuName != 'F1'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      use32BitWorkerProcess: false
      // The live video call signals over WebSockets.
      webSocketsEnabled: true
      healthCheckPath: '/health/live'
    }
  }
}

resource apiSettings 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: api
  name: 'appsettings'
  properties: union(
    {
      ASPNETCORE_ENVIRONMENT: 'Production'
      // The workflow ships a ready-to-run publish folder; Oryx must not rebuild it.
      SCM_DO_BUILD_DURING_DEPLOYMENT: 'false'
      SecondLook__Database__Provider: 'SqlServer'
      SecondLook__Database__ConnectionString: sqlConnectionString
      SecondLook__Jwt__SigningKey: jwtSigningKey
    },
    corsSettings
  )
}

var swaProperties = {
  // Deployed by token from GitHub Actions, not by a linked repository.
  buildProperties: { skipGithubActionWorkflowGeneration: true }
  allowConfigFileUpdates: true
  stagingEnvironmentPolicy: 'Disabled'
  enterpriseGradeCdnStatus: 'Disabled'
}

resource webSwa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: webSwaName
  location: swaLocation
  tags: union(tags, { role: 'buyer-app' })
  sku: { name: swaSkuName, tier: swaSkuName }
  properties: swaProperties
}

resource webSwaDomain 'Microsoft.Web/staticSites/customDomains@2024-04-01' = if (!empty(appCustomDomain)) {
  parent: webSwa
  name: appCustomDomain
  properties: { validationMethod: 'dns-txt-token' }
}

resource adminSwa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: adminSwaName
  location: swaLocation
  tags: union(tags, { role: 'admin-app' })
  sku: { name: swaSkuName, tier: swaSkuName }
  properties: swaProperties
}

resource adminSwaDomain 'Microsoft.Web/staticSites/customDomains@2024-04-01' = if (!empty(adminCustomDomain)) {
  parent: adminSwa
  name: adminCustomDomain
  properties: { validationMethod: 'dns-txt-token' }
}

output apiName string = api.name
output apiOrigin string = 'https://${api.properties.defaultHostName}'
output webSwaName string = webSwa.name
output webSwaHostName string = webSwa.properties.defaultHostname
output adminSwaName string = adminSwa.name
output adminSwaHostName string = adminSwa.properties.defaultHostname
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDatabase.name
output corsOrigins array = corsOrigins
