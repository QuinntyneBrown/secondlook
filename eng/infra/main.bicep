// SecondLook production stack — everything the app needs, in one idempotent
// template (ADR-017). Deployed into secondlook-rg by .github/workflows/deploy.yml
// on every push to main, and once by hand from eng/Bootstrap-Azure.ps1.
//
// Tiers are the cheapest ones that still carry an SLA and the features the app
// relies on (Always On for the ingestion WebJob, backups, TLS 1.2):
//
//   App Service plan   Linux Basic B1 (1 core, 1.75 GB)     ≈ US$13/month
//   Azure SQL          Basic (5 DTU, 2 GB, 7-day PITR)      ≈ US$5/month
//   Static Web Apps    Free ×4 (app, admin, design system,  US$0 (Standard = +US$9 each)
//                      marketing site, ADR-018)
//   Log Analytics +    pay-as-you-go, first 5 GB/month free, capped at 0.5 GB/day
//   App Insights
//   Microsoft Foundry  Claude on Global Standard, billed per token (ADR-011)
//
// Re-running converges on the same state; nothing here is destructive.

targetScope = 'resourceGroup'

// ───────────────────────────── naming ─────────────────────────────

@description('Short suffix shared by every resource name (sl-api-<suffix>, sl-sql-<suffix>, …).')
param suffix string = 'uofnt2'

@description('Region for the plan, API, SQL and monitoring. Defaults to the resource group\'s.')
param location string = resourceGroup().location

@description('Static Web Apps are only offered in a few regions; eastus2 is the closest to canadacentral.')
param swaLocation string = 'eastus2'

@description('Claude is not offered in Canadian regions (ADR-011).')
param foundryLocation string = 'eastus2'

param planName string = 'sl-plan-${suffix}'
param apiName string = 'sl-api-${suffix}'
param sqlServerName string = 'sl-sql-${suffix}'
param sqlDatabaseName string = 'secondlook'
param webSwaName string = 'sl-web-${suffix}'
param adminSwaName string = 'sl-admin-${suffix}'
param designSwaName string = 'sl-design-${suffix}'
param marketingSwaName string = 'sl-www-${suffix}'
param foundryAccountName string = 'sl-ai-${suffix}'
param logAnalyticsName string = 'sl-logs-${suffix}'
param appInsightsName string = 'sl-insights-${suffix}'
param emailServiceName string = 'sl-email-${suffix}'
param communicationServiceName string = 'sl-comms-${suffix}'

// ───────────────────────────── sizing ─────────────────────────────

@description('App Service plan SKU. B1 is the cheapest tier with Always On (needed by the scheduled WebJob) and an SLA.')
@allowed(['B1', 'B2', 'B3', 'S1', 'P0v3', 'P1v3'])
param apiSkuName string = 'B1'

@description('Azure SQL SKU. Basic is the cheapest tier with an SLA and point-in-time restore; S0 is the next step up.')
@allowed(['Basic', 'S0', 'S1', 'GP_S_Gen5_1'])
param sqlSkuName string = 'Basic'

@description('Max database size in bytes. Basic allows up to 2 GB.')
param sqlMaxSizeBytes int = 2147483648

@description('Static Web Apps tier. Free has no SLA; Standard (US$9/app/month) adds one plus more bandwidth and custom-auth.')
@allowed(['Free', 'Standard'])
param swaSkuName string = 'Free'

@description('Tier of the marketing site alone (ADR-018). A subscription holds only so many Free Static Web Apps; Standard (US$9/month) lifts that limit for this one app.')
@allowed(['Free', 'Standard'])
param marketingSwaSkuName string = swaSkuName

@description('Daily Log Analytics ingestion cap in GB, so a log storm cannot run up the bill.')
param logDailyCapGb string = '0.5'

// ───────────────────────────── app config ─────────────────────────────

@description('Custom domain for the family app (e.g. app.secondlook.ca). Blank skips the binding; the domain must already validate in DNS.')
param appCustomDomain string = ''

@description('Custom domain for the admin app (e.g. admin.secondlook.ca, ADR-014). Blank skips the binding; the domain must already validate in DNS.')
param adminCustomDomain string = ''

@description('Custom domain for the static marketing site (e.g. www.secondlook.ca, ADR-018). Blank skips the binding.')
param marketingCustomDomain string = ''

@description('Apex domain bound to the marketing site beside it (e.g. secondlook.ca), so it can redirect to www. Blank skips the binding.')
param marketingApexDomain string = ''

@description('OAuth client id for "Continue with Google" (SecondLook:Google:ClientId, ADR-019). The same id is compiled into the family app; blank answers 503 google_not_configured.')
param googleClientId string = ''

@secure()
@description('OAuth client secret for Google Calendar sync (SecondLook:Google:ClientSecret, ADR-022). Blank turns calendar sync off: the API answers 503 google_calendar_not_configured and the family app hides the Google row.')
param googleClientSecret string = ''

@description('Extra browser origins the API should accept, in addition to the three Static Web Apps and the custom domains.')
param extraCorsOrigins array = []

// ───────────────────────────── outbound email (ADR-021) ─────────────────────────────

@description('Domain account mail is sent from, e.g. secondlook.ca (no-reply@<domain>). Blank skips the email resources and leaves the API writing .eml files.')
param emailDomain string = ''

@description('True once Azure shows the domain verified. Links it to the Communication Services resource and points the API at the SMTP relay; the registrar must hold the four records first.')
param emailDomainVerified bool = false

@description('Application (client) id of the Entra app the API presents to the SMTP relay. Created by eng/Bootstrap-Azure.ps1; public, not a secret.')
param smtpClientId string = ''

@description('Object id of that app\'s service principal. It receives the Communication and Email Service Owner role on the Communication Services resource.')
param smtpPrincipalId string = ''

@secure()
@description('Client secret of that app (SecondLook:Email:SmtpPassword). Blank leaves the API on the pickup directory.')
param smtpClientSecret string = ''

@secure()
@description('SQL administrator login. Immutable once the server exists — pass the current one when re-deploying over an existing server.')
param sqlAdminLogin string

@secure()
param sqlAdminPassword string

@secure()
@minLength(32)
@description('HMAC key for the API\'s JWTs (SECONDLOOK_JWT_SIGNING_KEY). Rotating it signs every family out.')
param jwtSigningKey string

@secure()
@minLength(32)
@description('HMAC key for signed photo URLs (SecondLook:Photos:SigningKey). Rotating it breaks photo links already handed out.')
param photosSigningKey string

// ───────────────────────────── Claude on Foundry (ADR-011) ─────────────────────────────

param claudeDeploymentName string = 'claude-sonnet-5'
param claudeModelName string = 'claude-sonnet-5'
@description('Version 2 is the Azure-hosted build.')
param claudeModelVersion string = '2'
@description('Thousands of tokens per minute. Free to reserve; tokens are billed per use.')
param claudeCapacity int = 80

@description('Legal name of the organization using Claude — the Anthropic Marketplace attestation.')
param organizationName string
@minLength(2)
@maxLength(2)
param countryCode string = 'CA'
param industry string = 'technology'

// ───────────────────────────── guardrails ─────────────────────────────

@description('Monthly budget for the resource group, in the subscription\'s billing currency. Alerts fire at 80 % and 100 %.')
param budgetAmount int = 40

@description('Where budget alerts go. Blank disables the budget.')
param alertEmail string = ''

@description('Budgets must start on the first of a month; defaults to the current one.')
param budgetStartDate string = utcNow('yyyy-MM-01')

param tags object = {
  app: 'secondlook'
  managedBy: 'bicep'
}

// ───────────────────────────── derived values ─────────────────────────────

var apiOrigin = 'https://${api.properties.defaultHostName}'
var webOrigin = 'https://${webSwa.properties.defaultHostname}'
var adminOrigin = 'https://${adminSwa.properties.defaultHostname}'
var appOrigin = empty(appCustomDomain) ? webOrigin : 'https://${appCustomDomain}'

var corsOrigins = union(
  concat(
    [webOrigin, adminOrigin],
    empty(appCustomDomain) ? [] : ['https://${appCustomDomain}'],
    empty(adminCustomDomain) ? [] : ['https://${adminCustomDomain}']
  ),
  extraCorsOrigins
)

// Cors__AllowedOrigins__0, __1, … — .NET's environment-variable array binding.
var corsSettings = toObject(
  range(0, length(corsOrigins)),
  i => 'Cors__AllowedOrigins__${i}',
  i => corsOrigins[i]
)

var sqlConnectionString = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDatabaseName};User ID=${sqlAdminLogin};Password=${sqlAdminPassword};Encrypt=True;TrustServerCertificate=False;MultipleActiveResultSets=False;Connection Timeout=30;'

// The API sends over SMTP only once the domain is verified and the relay
// credentials exist; otherwise it keeps writing .eml files under /home/data/mail
// and the switch is a re-deploy, not a code change (ADR-021).
var smtpEnabled = !empty(emailDomain) && emailDomainVerified && !empty(smtpClientId) && !empty(smtpClientSecret)
var smtpSettings = smtpEnabled
  ? {
      SecondLook__Email__From: 'SecondLook <no-reply@${emailDomain}>'
      SecondLook__Email__SmtpHost: 'smtp.azurecomm.net'
      SecondLook__Email__SmtpPort: '587'
      SecondLook__Email__SmtpStartTls: 'true'
      // The relay's username form: <Communication Services resource>.<Entra app id>.<tenant id>.
      SecondLook__Email__SmtpUsername: '${communicationServiceName}.${smtpClientId}.${tenant().tenantId}'
      SecondLook__Email__SmtpPassword: smtpClientSecret
    }
  : {}

// ───────────────────────────── monitoring ─────────────────────────────

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: json(logDailyCapGb) }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    IngestionMode: 'LogAnalytics'
    RetentionInDays: 30
  }
}

// ───────────────────────────── database ─────────────────────────────

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
    // it adds and removes around the run; private endpoints would cost more
    // than the database.
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
  sku: sqlSkuName == 'GP_S_Gen5_1'
    ? { name: 'GP_S_Gen5', tier: 'GeneralPurpose', family: 'Gen5', capacity: 1 }
    : { name: sqlSkuName, tier: sqlSkuName == 'Basic' ? 'Basic' : 'Standard' }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: sqlMaxSizeBytes
    zoneRedundant: false
    // Locally redundant backups are the cheapest option; PITR still covers 7 days.
    requestedBackupStorageRedundancy: 'Local'
  }
}

// ───────────────────────────── Claude (ADR-011) ─────────────────────────────

module foundry '../foundry/claude.bicep' = {
  name: 'foundry-claude'
  params: {
    accountName: foundryAccountName
    location: foundryLocation
    deploymentName: claudeDeploymentName
    modelName: claudeModelName
    modelVersion: claudeModelVersion
    capacity: claudeCapacity
    organizationName: organizationName
    countryCode: countryCode
    industry: industry
    tags: union(tags, { purpose: 'catalog-ingestion' })
  }
}

// ───────────────────────────── outbound email (ADR-021) ─────────────────────────────

module email './email.bicep' = if (!empty(emailDomain)) {
  name: 'email'
  params: {
    emailServiceName: emailServiceName
    communicationServiceName: communicationServiceName
    domainName: emailDomain
    domainVerified: emailDomainVerified
    smtpPrincipalId: smtpPrincipalId
    tags: union(tags, { purpose: 'account-mail' })
  }
}

// ───────────────────────────── API ─────────────────────────────

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: apiSkuName
    capacity: 1
  }
  properties: {
    reserved: true // Linux
    zoneRedundant: false
  }
}

resource api 'Microsoft.Web/sites@2024-04-01' = {
  name: apiName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      // Keeps the worker warm so the scheduled ingestion WebJob fires on time.
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      use32BitWorkerProcess: false
      webSocketsEnabled: false
      // App settings live in the `appsettings` config resource below so they
      // can reference this site's own host name.
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
      // A triggered WebJob that prints nothing for two minutes is killed by
      // default. One ingestion pass waits minutes on Claude's web searches.
      WEBJOBS_IDLE_TIMEOUT: '3600'
      // On Linux the Kudu agent that runs WebJobs is off unless asked for;
      // without this the job is shipped but never listed, scheduled or run.
      WEBSITE_SKIP_RUNNING_KUDUAGENT: 'false'

      // Codeless Application Insights for .NET on Linux.
      APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
      ApplicationInsightsAgent_EXTENSION_VERSION: '~3'
      XDT_MicrosoftApplicationInsights_Mode: 'recommended'

      // Database — the same variable the CLI (migrations, ingestion) reads.
      SECONDLOOK_CONNECTION: sqlConnectionString

      // Secrets the API refuses to run on placeholders for (L2-024, L2-030).
      SECONDLOOK_JWT_SIGNING_KEY: jwtSigningKey
      SecondLook__Photos__SigningKey: photosSigningKey

      // Uploads live outside wwwroot so a clean zip deploy never deletes them;
      // /home is the plan's persistent share.
      SecondLook__Photos__Directory: '/home/data/photos'
      SecondLook__CuratedPhotos__Directory: '/home/data/catalog-photos'
      SecondLook__Email__PickupDirectory: '/home/data/mail'

      // Public origins (ADR-015, L2-031).
      SecondLook__CuratedPhotos__PublicOrigin: apiOrigin
      SecondLook__Images__AllowedOrigins__0: apiOrigin
      SecondLook__Share__AppOrigin: appOrigin

      // Sign in with Google (ADR-019): the ID token's audience; public, not a secret.
      SecondLook__Google__ClientId: googleClientId

      // Google Calendar sync (ADR-022): the code exchange's secret, and the Data
      // Protection key ring that encrypts refresh tokens, on the persistent share.
      SecondLook__Google__ClientSecret: googleClientSecret
      SecondLook__Calendar__KeyDirectory: '/home/data/keys'

      // Catalog ingestion through Claude on Foundry (ADR-011). The key comes
      // straight from the account, so a rotation is one re-deploy away.
      SecondLook__Ingestion__Claude__Provider: 'Foundry'
      SecondLook__Ingestion__Claude__FoundryResource: foundryAccount.name
      SecondLook__Ingestion__Claude__Model: foundry.outputs.deploymentName
      ANTHROPIC_FOUNDRY_API_KEY: foundryAccount.listKeys().key1
    },
    corsSettings,
    smtpSettings
  )
  // Ordering: `foundry.outputs.deploymentName` above makes this wait for the
  // module, so the account exists before its key is read.
}

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-10-01-preview' existing = {
  name: foundryAccountName
}

resource apiLogs 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: api
  name: 'logs'
  properties: {
    applicationLogs: { fileSystem: { level: 'Warning' } }
    httpLogs: {
      fileSystem: {
        enabled: true
        retentionInDays: 3
        retentionInMb: 35
      }
    }
    detailedErrorMessages: { enabled: true }
    failedRequestsTracing: { enabled: false }
  }
}

// ───────────────────────────── Static Web Apps ─────────────────────────────

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
  tags: union(tags, { role: 'family-app' })
  sku: { name: swaSkuName, tier: swaSkuName }
  properties: swaProperties
}

resource webSwaDomain 'Microsoft.Web/staticSites/customDomains@2024-04-01' = if (!empty(appCustomDomain)) {
  parent: webSwa
  name: appCustomDomain
  properties: {
    // TXT validation works for apex and sub-domains alike.
    validationMethod: 'dns-txt-token'
  }
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
  properties: {
    validationMethod: 'dns-txt-token'
  }
}

resource designSwa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: designSwaName
  location: swaLocation
  tags: union(tags, { role: 'design-system' })
  sku: { name: swaSkuName, tier: swaSkuName }
  properties: swaProperties
}

// The static marketing site (ADR-018): marketing/ uploaded as-is, no build. It
// never calls the API, so it adds nothing to CORS.
resource marketingSwa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: marketingSwaName
  location: swaLocation
  tags: union(tags, { role: 'marketing-site' })
  sku: { name: marketingSwaSkuName, tier: marketingSwaSkuName }
  properties: swaProperties
}

resource marketingSwaDomain 'Microsoft.Web/staticSites/customDomains@2024-04-01' = if (!empty(marketingCustomDomain)) {
  parent: marketingSwa
  name: marketingCustomDomain
  properties: {
    validationMethod: 'dns-txt-token'
  }
}

// The apex binds after www: one hostname operation at a time per site. Making
// www the default domain (portal, Custom domains → Set default) is what turns
// a request to the apex into a redirect to www; ADR-018 describes the fallback.
resource marketingSwaApex 'Microsoft.Web/staticSites/customDomains@2024-04-01' = if (!empty(marketingApexDomain)) {
  parent: marketingSwa
  name: marketingApexDomain
  dependsOn: [marketingSwaDomain]
  properties: {
    validationMethod: 'dns-txt-token'
  }
}

// ───────────────────────────── budget ─────────────────────────────

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = if (!empty(alertEmail)) {
  name: 'secondlook-monthly'
  properties: {
    category: 'Cost'
    amount: budgetAmount
    timeGrain: 'Monthly'
    timePeriod: { startDate: budgetStartDate }
    notifications: {
      actual80: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: [alertEmail]
      }
      actual100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: [alertEmail]
      }
    }
  }
}

// ───────────────────────────── outputs (no secrets) ─────────────────────────────

output apiName string = api.name
output apiHostName string = api.properties.defaultHostName
output apiOrigin string = apiOrigin
output webSwaName string = webSwa.name
output webSwaHostName string = webSwa.properties.defaultHostname
output adminSwaName string = adminSwa.name
output adminSwaHostName string = adminSwa.properties.defaultHostname
output designSwaName string = designSwa.name
output designSwaHostName string = designSwa.properties.defaultHostname
output marketingSwaName string = marketingSwa.name
output marketingSwaHostName string = marketingSwa.properties.defaultHostname
output marketingOrigin string = empty(marketingCustomDomain) ? 'https://${marketingSwa.properties.defaultHostname}' : 'https://${marketingCustomDomain}'
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDatabase.name
output foundryAccountName string = foundry.outputs.accountName
output foundryBaseUrl string = foundry.outputs.baseUrl
output claudeDeploymentName string = foundry.outputs.deploymentName
output appInsightsName string = appInsights.name
output corsOrigins array = corsOrigins
output emailDomain string = emailDomain
output emailSmtpEnabled bool = smtpEnabled
#disable-next-line BCP318
output emailVerificationStatus object = empty(emailDomain) ? {} : email.outputs.verificationStatus
#disable-next-line BCP318
output emailVerificationRecords object = empty(emailDomain) ? {} : email.outputs.verificationRecords
