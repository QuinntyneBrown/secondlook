// Parameters for eng/infra/main.bicep. Secrets come from the environment:
// GitHub Actions maps them from repository secrets.
using 'main.bicep'

param suffix = 'uofnt2'
param swaLocation = 'eastus2'

// Cheapest tiers; see main.bicep for when to bump them. The subscription has no
// Free Static Web App slots left, so these two are Standard (about US$9 each).
param apiSkuName = 'F1'
param sqlSkuName = 'Basic'
param swaSkuName = 'Standard'

// Comma-separated hostnames; each needs its CNAME in place first (see main.bicep).
param appCustomDomains = readEnvironmentVariable('APP_CUSTOM_DOMAIN', '')
param adminCustomDomains = readEnvironmentVariable('ADMIN_CUSTOM_DOMAIN', '')

param sqlAdminLogin = readEnvironmentVariable('SQL_ADMIN_LOGIN')
param sqlAdminPassword = readEnvironmentVariable('SQL_ADMIN_PASSWORD')
param jwtSigningKey = readEnvironmentVariable('SECONDLOOK_JWT_SIGNING_KEY')
