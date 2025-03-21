# CI/CD Workflow for Hashland API

This document describes the CI/CD workflow for the Hashland API project, explaining how the GitHub Actions workflows are configured for both development and production environments.

## Overview

The Hashland API project uses GitHub Actions with self-hosted runners to implement CI/CD pipelines for both development and production environments. The workflows are defined in the `.github/workflows` directory.

## Secrets Required

The following secrets need to be configured in your GitHub repository:

### Repository Secrets (Shared)
- `DOCKER_USERNAME`: Your Docker Hub username
- `DOCKER_PASSWORD`: Your Docker Hub password
- `ADMIN_PASSWORD`: Admin password hash
- `JWT_SECRET`: Secret key for JWT token generation
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TON_API_KEY`: TON API key
- `TON_API_ENDPOINT`: API endpoint for TON blockchain (e.g., "https://toncenter.com/api/v2/jsonRPC")
- `ALCHEMY_API_KEY`: Alchemy API key
- `TON_RECEIVER_ADDRESS`: TON wallet address for receiving funds
- `TON_X_API_KEY`: TON X API key

### Environment Secrets

Configure these in the production environment:
- `MONGO_URI`: MongoDB connection URI
- `REDIS_URI`: Redis connection URI

Note: For the development environment, local MongoDB and Redis instances are used through docker-compose.

## Environment Variables

The following environment variables are set in the .env files during deployment:

```
ADMIN_PASSWORD="<from-secrets>"
DATABASE_NAME="main"
JWT_EXPIRATION="24h"
JWT_SECRET="<from-secrets>"
MONGO_URI="<from-secrets-or-local-docker>"
PORT="8080"
REDIS_URI="<from-secrets-or-local-docker>"
TELEGRAM_BOT_TOKEN="<from-secrets>"
TON_API_KEY="<from-secrets>"
TON_API_ENDPOINT="<from-secrets>"
ALCHEMY_API_KEY="<from-secrets>"
TON_RECEIVER_ADDRESS="<from-secrets>"
TON_X_API_KEY="<from-secrets>"
NODE_ENV="<environment-name>"
```

## Development Workflow

The development workflow is triggered when:
- Code is pushed to the `dev` branch
- A pull request is created targeting the `dev` branch
- Code is tagged with 'development'
- The workflow is manually triggered

### Workflow Steps

1. **Test**
   - Checkout code
   - Install dependencies using npm
   - Run tests

2. **Build and Deploy**
   - Checkout code
   - Login to Docker Hub
   - Build Docker image with both 'dev' and 'development' tags
   - Push images to Docker Hub
   - Create .env file with necessary environment variables
   - Modify docker-compose.yml to use the pre-built image
   - Deploy using docker-compose with MongoDB and Redis

## Production Workflow

The production workflow is triggered when:
- Code is pushed to the `main` branch
- Code is tagged with 'production'
- The workflow is manually triggered

### Workflow Steps

1. **Build and Deploy**
   - Checkout code
   - Login to Docker Hub
   - Build Docker image with both 'latest' and 'production' tags
   - Push images to Docker Hub
   - Create .env file with necessary environment variables
   - Deploy as a standalone Docker container

## Docker Configuration

### Development Environment
The development environment uses docker-compose.yml which includes:
- The HashLand API application
- MongoDB for data storage
- Redis for caching and message queuing

### Production Environment
The production environment runs as a standalone Docker container that connects to external MongoDB and Redis services specified in the environment variables.

## Branch Structure

The repository follows this branch structure:
- `main`: Production code 
- `dev`: Development code

You can also trigger workflows by using tags:
- Tag with 'production' to trigger a production deployment
- Tag with 'development' to trigger a development deployment

## Setting Up GitHub Environments

1. Go to your GitHub repository
2. Navigate to Settings → Environments
3. Create two environments: "production" and "development"
4. Add the environment-specific secrets to each environment

## Self-Hosted Runner Requirements

The workflows are designed to run on self-hosted GitHub Actions runners. For details on setting up these runners, see the [GitHub Runners Setup](./github-runners-setup.md) documentation. 