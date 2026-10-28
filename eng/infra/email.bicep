// Outbound email for the API (ADR-021): an Email Communication Service that
// owns the sending domain, and the Communication Services resource the API
// authenticates to over SMTP.
//
// The domain is customer-managed: Azure issues four DNS records (a TXT that
// proves ownership, SPF, and two DKIM CNAMEs) and the registrar holds them.
// Linking the domain to the Communication Services resource is only accepted
// once Azure has verified it, so the link waits on `domainVerified`. The
// first deployment creates the domain and outputs the records; the operator
// adds them, starts verification and flips the flag.
//
// Both resources are global; `dataLocation` says where Azure keeps the mail
// metadata, and the two must agree.

targetScope = 'resourceGroup'

@description('Name of the Email Communication Service (sl-email-<suffix>).')
param emailServiceName string

@description('Name of the Communication Services resource (sl-comms-<suffix>). It is the first part of the SMTP username.')
param communicationServiceName string

@description('Sending domain, e.g. secondlook.ca. Mail goes out as no-reply@<domain>.')
param domainName string

@description('Local part of the sending address and its display name.')
param senderUsername string = 'no-reply'
param senderDisplayName string = 'SecondLook'

@description('Where Azure keeps the service\'s data at rest. Must match between the email service and the Communication Services resource.')
param dataLocation string = 'Canada'

@description('True once Azure shows the domain verified; links it to the Communication Services resource so mail can be sent from it.')
param domainVerified bool = false

@description('Object id of the service principal the API authenticates to SMTP with. Blank skips the role assignment.')
param smtpPrincipalId string = ''

param tags object = {}

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: emailServiceName
  location: 'global'
  tags: tags
  properties: {
    dataLocation: dataLocation
  }
}

resource domain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: domainName
  location: 'global'
  tags: tags
  properties: {
    domainManagement: 'CustomerManaged'
    // Open and click tracking rewrite every link through Azure; account mail
    // carries one-time tokens, so the links stay untouched.
    userEngagementTracking: 'Disabled'
  }
}

resource sender 'Microsoft.Communication/emailServices/domains/senderUsernames@2023-04-01' = {
  parent: domain
  name: senderUsername
  properties: {
    username: senderUsername
    displayName: senderDisplayName
  }
}

resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: communicationServiceName
  location: 'global'
  tags: tags
  properties: {
    dataLocation: dataLocation
    linkedDomains: domainVerified ? [domain.id] : []
  }
}

// SMTP authentication (ADR-021): the service principal that presents the
// client secret must hold this role on the Communication Services resource.
var smtpRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '09976791-48a7-449e-bb21-39d1a415f350') // Communication and Email Service Owner

resource smtpRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(smtpPrincipalId)) {
  name: guid(communicationService.id, smtpPrincipalId, smtpRoleId)
  scope: communicationService
  properties: {
    roleDefinitionId: smtpRoleId
    principalId: smtpPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ───────────────────────────── outputs (no secrets) ─────────────────────────────

output communicationServiceName string = communicationService.name
output domainName string = domain.name
output fromAddress string = '${senderUsername}@${domainName}'
output verificationStatus object = domain.properties.verificationStates
@description('The DNS records the registrar needs: Domain (TXT), SPF (TXT), DKIM and DKIM2 (CNAME).')
output verificationRecords object = domain.properties.verificationRecords
