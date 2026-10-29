// Parameters for eng/infra/main.bicep. Secrets come from the environment:
// GitHub Actions maps them from repository secrets.
using 'main.bicep'

param suffix = 'uofnt2'
param swaLocation = 'eastus2'

// Cheapest tiers; see main.bicep for when to bump them.
param apiSkuName = 'F1'
param sqlSkuName = 'Basic'
param swaSkuName = 'Free'

param appCustomDomain = readEnvironmentVariable('APP_CUSTOM_DOMAIN', '')
param adminCustomDomain = readEnvironmentVariable('ADMIN_CUSTOM_DOMAIN', '')

param sqlAdminLogin = readEnvironmentVariable('SQL_ADMIN_LOGIN')
param sqlAdminPassword = readEnvironmentVariable('SQL_ADMIN_PASSWORD')
param jwtSigningKey = readEnvironmentVariable('SECONDLOOK_JWT_SIGNING_KEY')
