# CI/CD Workflow for Hashland API

This document describes the CI/CD workflow for the Hashland API project, explaining how the GitHub Actions workflows are configured for both development and production environments.

## Overview

The Hashland API project uses GitHub Actions with self-hosted runners to implement CI/CD pipelines for both development and production environments. The workflows are defined in the `.github/workflows` directory.

## Development Workflow

The development workflow is triggered when:
- Code is pushed to the `dev` branch
- A pull request is created targeting the `dev` branch

### Workflow Steps

1. **Build and Test**
   - Checkout code
   - Set up Node.js environment
   - Install dependencies using npm
   - Lint the code
   - Build the application
   - Start Docker services (MongoDB and Redis)
   - Run tests
   - Stop Docker services

2. **Deploy to Development**
   - Deploy the application using Docker Compose
   - Perform a health check to verify deployment

### Docker Services in Development

The development environment uses Docker Compose to run:
- The Hashland API application
- MongoDB database
- Redis cache

All services are defined in the `docker-compose.yml` file.

## Production Workflow

The production workflow is triggered when:
- Code is pushed to the `main` branch

### Workflow Steps

1. **Build**
   - Checkout code
   - Set up Node.js environment
   - Install dependencies using npm
   - Lint the code
   - Build the application

2. **Deploy to Production**
   - Build and tag a Docker image
   - Stop any existing container
   - Deploy the new container with proper environment variables
   - Perform a health check to verify deployment
   - Clean up old Docker images

### Production Deployment

In production, the application is deployed as a standalone Docker container that connects to external MongoDB and Redis services, using the configured environment variables in `.env.production`.

## Health Checks

Both workflows include health checks to verify successful deployment. The health check endpoint is available at:

```
GET /health
```

The endpoint returns:
```json
{
  "status": "ok",
  "timestamp": "2023-06-07T12:34:56.789Z",
  "service": "hashland-api"
}
```

## Workflow Files

The GitHub Actions workflow files are located at:
- `.github/workflows/development.yml`: Development workflow
- `.github/workflows/production.yml`: Production workflow

## Self-Hosted Runner Requirements

The workflows are designed to run on self-hosted GitHub Actions runners with the following labels:
- Development: `self-hosted,Linux,X64,dev`
- Production: `self-hosted,Linux,X64,prod`

For details on setting up these runners, see the [GitHub Runners Setup](./github-runners-setup.md) documentation.

## Customizing the Workflows

To customize the workflows:

1. Edit the respective workflow files in the `.github/workflows` directory
2. Commit and push your changes to the repository
3. GitHub Actions will use the updated workflow files for subsequent runs

## Monitoring Workflow Runs

You can monitor workflow runs in the GitHub repository:
1. Go to your repository on GitHub
2. Click on the "Actions" tab
3. View the list of workflow runs
4. Click on a specific run to see details and logs 