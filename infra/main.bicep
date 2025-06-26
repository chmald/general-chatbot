@description('Environment name')
param environmentName string = 'chatbot-${uniqueString(resourceGroup().id)}'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Resource name token for naming consistency')
param resourceToken string = toLower(uniqueString(subscription().id, resourceGroup().id, environmentName))

@description('Application name')
param appName string = 'general-chatbot'

@description('Container image for the application')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('MongoDB connection string')
@secure()
param mongoDbConnectionString string = ''

@description('Azure OpenAI endpoint')
param azureOpenAiEndpoint string = ''

@description('Azure OpenAI deployment name')
param azureOpenAiDeploymentName string = 'gpt-4'

@description('Azure OpenAI API version')
param azureOpenAiApiVersion string = '2024-02-01'

// Variables
var tags = {
  'azd-env-name': environmentName
  'app-name': appName
}

var containerRegistryName = 'acrgen${resourceToken}'
var managedEnvironmentName = 'cae-${resourceToken}'
var containerAppName = 'ca-${appName}-${resourceToken}'
var logAnalyticsName = 'log-${resourceToken}'
var userAssignedIdentityName = 'id-${resourceToken}'

// User-assigned managed identity
resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: userAssignedIdentityName
  location: location
  tags: tags
}

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      searchVersion: 1
      legacy: 0
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// Container Registry
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: containerRegistryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    policies: {
      quarantinePolicy: {
        status: 'disabled'
      }
      trustPolicy: {
        type: 'Notary'
        status: 'disabled'
      }
      retentionPolicy: {
        days: 7
        status: 'disabled'
      }
      exportPolicy: {
        status: 'enabled'
      }
    }
    encryption: {
      status: 'disabled'
    }
    dataEndpointEnabled: false
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
    zoneRedundancy: 'Disabled'
  }
}

// Role assignment for Container Registry
resource containerRegistryRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: containerRegistry
  name: guid(containerRegistry.id, userAssignedIdentity.id, 'acrpull')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Container Apps Environment
resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: managedEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    zoneRedundant: false
  }
}

// Container App
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: union(tags, {
    'azd-service-name': appName
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentity.id}': {}
    }
  }
  properties: {
    environmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3001
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          allowCredentials: true
        }
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: userAssignedIdentity.id
        }
      ]
      secrets: [
        {
          name: 'mongodb-connection-string'
          value: mongoDbConnectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: appName
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3001'
            }
            {
              name: 'MONGODB_URI'
              secretRef: 'mongodb-connection-string'
            }
            {
              name: 'AZURE_OPENAI_ENDPOINT'
              value: azureOpenAiEndpoint
            }
            {
              name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
              value: azureOpenAiDeploymentName
            }
            {
              name: 'AZURE_OPENAI_API_VERSION'
              value: azureOpenAiApiVersion
            }
            {
              name: 'SESSION_SECRET'
              value: uniqueString(resourceGroup().id, appName)
            }
            {
              name: 'RATE_LIMIT_WINDOW'
              value: '900000'
            }
            {
              name: 'RATE_LIMIT_MAX'
              value: '100'
            }
            {
              name: 'MAX_CHAT_HISTORY'
              value: '50'
            }
            {
              name: 'LOG_LEVEL'
              value: 'info'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '30'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [
    containerRegistryRoleAssignment
  ]
}

// Outputs
output RESOURCE_GROUP_ID string = resourceGroup().id

output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.properties.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.name
output AZURE_CONTAINER_REGISTRY_RESOURCE_ID string = containerRegistry.id

output AZURE_CONTAINER_APPS_ENVIRONMENT_ID string = managedEnvironment.id
output AZURE_CONTAINER_APPS_ENVIRONMENT_NAME string = managedEnvironment.name
output AZURE_CONTAINER_APPS_ENVIRONMENT_DEFAULT_DOMAIN string = managedEnvironment.properties.defaultDomain

output SERVICE_CHATBOT_IDENTITY_PRINCIPAL_ID string = userAssignedIdentity.properties.principalId
output SERVICE_CHATBOT_NAME string = containerApp.name
output SERVICE_CHATBOT_URI string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output SERVICE_CHATBOT_IMAGE_NAME string = containerImage

output AZURE_LOG_ANALYTICS_WORKSPACE_NAME string = logAnalytics.name
output AZURE_LOG_ANALYTICS_WORKSPACE_ID string = logAnalytics.id
