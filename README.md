# General Chatbot - Azure AI Foundry Connected

A modern web application chatbot built with React and Node.js, connected to Azure AI Foundry with session-based chat history management.

## Features

- **Modern UI**: Beautiful, responsive chat interface built with React
- **Azure AI Integration**: Connected to Azure AI Foundry (Azure OpenAI) for intelligent responses
- **Session Management**: Persistent chat history using MongoDB sessions
- **Security**: Implements security best practices with rate limiting, CORS, and input validation
- **Authentication**: Uses Azure Managed Identity for secure Azure service authentication
- **Containerized**: Docker-ready for easy deployment to Azure Container Apps
- **Scalable**: Built with Azure Container Apps for automatic scaling

## Architecture

### Frontend (React)
- Modern chat interface with real-time messaging
- Session management for conversation history
- Responsive design for mobile and desktop
- Built with Create React App

### Backend (Node.js/Express)
- RESTful API for chat operations
- Session-based authentication with MongoDB storage
- Azure OpenAI integration with managed identity
- Rate limiting and security middleware
- Comprehensive logging and error handling

### Azure Services
- **Azure Container Apps**: Hosting the application
- **Azure Container Registry**: Container image storage
- **Azure OpenAI**: AI model hosting and inference
- **MongoDB**: Session and chat history storage
- **Azure Log Analytics**: Application logging and monitoring

## Prerequisites

- Node.js 18 or higher
- Docker
- Azure CLI
- Azure Developer CLI (azd)
- MongoDB (for local development)

## Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd general-chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   - `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI endpoint
   - `AZURE_OPENAI_DEPLOYMENT_NAME`: Your model deployment name
   - `MONGODB_URI`: MongoDB connection string

4. **Start development servers**
   ```bash
   # Start both frontend and backend
   npm run dev
   ```

   Or start them separately:
   ```bash
   # Backend only (port 3001)
   npm run server
   
   # Frontend only (port 3000)
   npm run client
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/api

## Deployment to Azure

### Using Azure Developer CLI (Recommended)

1. **Initialize Azure environment**
   ```bash
   azd init
   ```

2. **Set environment variables**
   ```bash
   azd env set MONGODB_CONNECTION_STRING "your-mongodb-connection-string"
   azd env set AZURE_OPENAI_ENDPOINT "your-azure-openai-endpoint"
   azd env set AZURE_OPENAI_DEPLOYMENT_NAME "your-model-deployment-name"
   ```

3. **Deploy to Azure**
   ```bash
   azd up
   ```

This will:
- Provision Azure resources (Container Apps, Container Registry, Log Analytics)
- Build and push the Docker image
- Deploy the application
- Configure environment variables and managed identity

### Manual Deployment

1. **Build the Docker image**
   ```bash
   docker build -t general-chatbot .
   ```

2. **Deploy using Azure CLI**
   ```bash
   # Create resource group
   az group create --name rg-general-chatbot --location eastus2
   
   # Deploy infrastructure
   az deployment group create \
     --resource-group rg-general-chatbot \
     --template-file infra/main.bicep \
     --parameters @infra/main.parameters.json
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3001` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/chatbot-sessions` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint | Required |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Model deployment name | `gpt-4` |
| `AZURE_OPENAI_API_VERSION` | API version | `2024-02-01` |
| `SESSION_SECRET` | Session encryption secret | Auto-generated |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `MAX_CHAT_HISTORY` | Max messages per conversation | `50` |

### Azure OpenAI Setup

1. Create an Azure OpenAI resource
2. Deploy a GPT model (e.g., GPT-4, GPT-3.5-turbo)
3. Note the endpoint and deployment name
4. Configure managed identity for authentication (recommended)

### MongoDB Setup

For production, use Azure Cosmos DB with MongoDB API:

1. Create a Cosmos DB account with MongoDB API
2. Get the connection string
3. Set the `MONGODB_URI` environment variable

## API Endpoints

### Chat API
- `POST /api/chat` - Send a message and get AI response
- `GET /api/chat/history` - Get chat history for current session
- `DELETE /api/chat/history` - Clear chat history

### Session API
- `GET /api/sessions` - Get all conversations for current session
- `POST /api/sessions` - Create a new conversation
- `DELETE /api/sessions/:id` - Delete a specific conversation
- `GET /api/sessions/current` - Get current session info

### Health Check
- `GET /api/health` - Application health status

## Security Features

- **Rate Limiting**: Protects against abuse
- **CORS**: Configured for cross-origin requests
- **Helmet**: Security headers middleware
- **Input Validation**: Validates and sanitizes user input
- **Session Security**: Secure session configuration
- **Managed Identity**: Azure service authentication without secrets

## Monitoring and Logging

- **Application Insights**: Performance and error monitoring
- **Log Analytics**: Centralized logging
- **Health Checks**: Automatic health monitoring
- **Structured Logging**: JSON-formatted logs with context

## Scaling

The application is designed to scale horizontally:
- Stateless backend design
- Session data stored in MongoDB
- Container Apps automatic scaling
- Load balancing across instances

## Development Scripts

```bash
# Install all dependencies
npm install

# Start development mode (both frontend and backend)
npm run dev

# Start backend only
npm run server

# Start frontend only
npm run client

# Build production client
npm run build

# Install client dependencies
npm run install-client
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check the troubleshooting section below
2. Create an issue in the repository
3. Contact the development team

## Troubleshooting

### Common Issues

1. **MongoDB Connection Issues**
   - Verify connection string
   - Check network connectivity
   - Ensure MongoDB is running

2. **Azure OpenAI Authentication**
   - Verify managed identity is configured
   - Check endpoint and deployment name
   - Ensure proper RBAC permissions

3. **Container Build Issues**
   - Check Docker is running
   - Verify all files are copied correctly
   - Check for syntax errors in Dockerfile

4. **Deployment Issues**
   - Verify Azure CLI is logged in
   - Check resource quotas
   - Verify all required parameters are set
