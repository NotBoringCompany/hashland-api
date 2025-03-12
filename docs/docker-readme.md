# Docker Setup for Hashland API Development

This guide explains how to use Docker to set up a development environment for the Hashland API.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd hashland-api
```

### 2. Environment Variables

The docker-compose.yml file includes default environment variables for development. If you need to customize them, you can create a `.env` file in the root directory.

### 3. Start the Development Environment

```bash
docker-compose up
```

This command will:
- Build the application container
- Start MongoDB and Redis containers
- Mount your local codebase to the container for hot-reloading
- Expose the necessary ports

### 4. Access the Services

- **API**: http://localhost:8080
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

### 5. Stop the Development Environment

```bash
docker-compose down
```

To remove volumes (database data) as well:

```bash
docker-compose down -v
```

## Production Deployment

For production deployment, use the main Dockerfile:

```bash
docker build -t hashland-api .
docker run -p 8080:8080 --env-file .env hashland-api
```

## Docker Commands Reference

### Rebuild the Application Container

```bash
docker-compose build app
```

### View Container Logs

```bash
docker-compose logs -f app
```

### Access MongoDB Shell

```bash
docker-compose exec mongo mongosh
```

### Access Redis CLI

```bash
docker-compose exec redis redis-cli
```

### Run Tests in Container

```bash
docker-compose exec app npm test
``` 