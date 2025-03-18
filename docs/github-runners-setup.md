# Setting Up GitHub Actions Self-Hosted Runners for Hashland API

This documentation provides step-by-step instructions for setting up GitHub Actions self-hosted runners on an Ubuntu VPS server to handle CI/CD for both development and production environments.

## Prerequisites

- Ubuntu 22.04 or newer VPS
- Root or sudo access
- GitHub repository with owner/admin permissions
- Docker and Docker Compose installed
- Ports 8080 opened for the API

## 1. Preparing Your Ubuntu VPS

### 1.1 Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 Install Required Dependencies

```bash
sudo apt install -y curl wget git build-essential
```

### 1.3 Install Docker and Docker Compose

If Docker is not already installed:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Verify installations
docker --version
docker compose version
```

## 2. Setting Up GitHub Self-Hosted Runners

### 2.1 Create Directory for Runners

```bash
mkdir -p /opt/actions-runner
cd /opt/actions-runner
```

### 2.2 Create Separate Directories for Dev and Prod Runners

```bash
mkdir -p /opt/actions-runner/dev
mkdir -p /opt/actions-runner/prod
```

### 2.3 Set Up Development Runner

```bash
cd /opt/actions-runner/dev
```

Download the latest runner package:

```bash
# Get the latest version
latest_version=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | grep -oP '"tag_name": "v\K[^"]+')

# Download and extract
curl -o actions-runner-linux-x64-${latest_version}.tar.gz -L https://github.com/actions/runner/releases/download/v${latest_version}/actions-runner-linux-x64-${latest_version}.tar.gz
tar xzf ./actions-runner-linux-x64-${latest_version}.tar.gz
```

### 2.4 Configure Development Runner

1. Go to your GitHub repository: `https://github.com/yourusername/hashland-api`
2. Navigate to Settings > Actions > Runners
3. Click "New self-hosted runner"
4. Select Linux as the operating system and x64 as the architecture
5. Copy the configuration commands provided by GitHub, which will look similar to:

```bash
./config.sh --url https://github.com/yourusername/hashland-api --token ABCDEFGHIJKLMNOP
```

6. Run the configuration script with an additional label for development:

```bash
./config.sh --url https://github.com/yourusername/hashland-api --token ABCDEFGHIJKLMNOP --labels "self-hosted,Linux,X64,dev"
```

7. Install and start the runner as a service:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

8. Verify the runner is running:

```bash
sudo ./svc.sh status
```

### 2.5 Set Up Production Runner

Repeat the same steps for production runner:

```bash
cd /opt/actions-runner/prod
```

Download the latest runner package:

```bash
curl -o actions-runner-linux-x64-${latest_version}.tar.gz -L https://github.com/actions/runner/releases/download/v${latest_version}/actions-runner-linux-x64-${latest_version}.tar.gz
tar xzf ./actions-runner-linux-x64-${latest_version}.tar.gz
```

Configure with production labels:

```bash
./config.sh --url https://github.com/yourusername/hashland-api --token ABCDEFGHIJKLMNOP --labels "self-hosted,Linux,X64,prod"
```

Install and start as a service:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

## 3. Configuring Environment Variables

### 3.1 Development Environment

Create a `.env` file for development:

```bash
cd /opt/actions-runner/dev/hashland-api
cp .env.example .env
```

Edit the `.env` file with your development configuration:

```
NODE_ENV=development
PORT=8080
MONGO_URI=mongodb://mongo:27017/main
REDIS_URI=redis://redis:6379
DATABASE_NAME=main
JWT_SECRET=your_development_jwt_secret
JWT_EXPIRATION=24h
TON_API_ENDPOINT=your_development_ton_api_endpoint
```

### 3.2 Production Environment

Create a `.env.production` file for production:

```bash
cd /opt/actions-runner/prod/hashland-api
cp .env.example .env.production
```

Edit the `.env.production` file with your production configuration:

```
NODE_ENV=production
PORT=8080
MONGO_URI=mongodb://your_production_mongo_host:27017/main
REDIS_URI=redis://your_production_redis_host:6379
DATABASE_NAME=main
JWT_SECRET=your_production_jwt_secret
JWT_EXPIRATION=24h
TON_API_ENDPOINT=your_production_ton_api_endpoint
```

## 4. Creating Docker Network for Production

Create a dedicated network for the production environment:

```bash
docker network create hashland-network
```

## 5. Setting Up GitHub Workflows

The GitHub Actions workflow files are already set up in your repository at:
- `.github/workflows/development.yml`
- `.github/workflows/production.yml`

These files define the CI/CD pipelines for both environments.

## 6. Runner Maintenance

### 6.1 Updating Runners

To update the runners when new versions are released:

```bash
# Stop the service
sudo ./svc.sh stop

# Download and extract the new version
curl -o actions-runner-linux-x64-${new_version}.tar.gz -L https://github.com/actions/runner/releases/download/v${new_version}/actions-runner-linux-x64-${new_version}.tar.gz
tar xzf ./actions-runner-linux-x64-${new_version}.tar.gz

# Start the service
sudo ./svc.sh start
```

### 6.2 Monitoring Runner Status

Check the status of your runners:

```bash
sudo ./svc.sh status
```

View logs:

```bash
less ~/.actions-runner/_diag/Runner_*.log
```

## 7. Troubleshooting

### 7.1 Runner Not Connecting

If the runner is not connecting to GitHub:

```bash
# Check the runner service status
sudo ./svc.sh status

# Restart the runner
sudo ./svc.sh restart

# Check logs for errors
less ~/.actions-runner/_diag/Runner_*.log
```

### 7.2 Docker Issues

If Docker is not working correctly:

```bash
# Check Docker status
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker

# Verify Docker is running
docker ps
```

### 7.3 Workflow Failures

If a workflow fails:
1. Check the GitHub Actions logs in your repository
2. Review the error message and fix any issues
3. Re-run the workflow manually if needed

## 8. Security Considerations

- Use a dedicated user for running the GitHub Actions runners
- Implement proper firewall rules to restrict access to your VPS
- Regularly update your system and the runners
- Use secrets for sensitive information in your GitHub repository

## 9. Backup and Recovery

Regularly back up your:
- Environment files
- Docker volumes for MongoDB and Redis
- Runner configuration

Example backup script:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/$(date +%Y-%m-%d)"
mkdir -p $BACKUP_DIR

# Backup environment files
cp /opt/actions-runner/dev/hashland-api/.env $BACKUP_DIR/dev.env
cp /opt/actions-runner/prod/hashland-api/.env.production $BACKUP_DIR/prod.env

# Backup Docker volumes (if needed)
docker run --rm -v hashland-mongo-data:/data -v $BACKUP_DIR:/backup alpine tar -czf /backup/mongo-data.tar.gz /data
docker run --rm -v hashland-redis-data:/data -v $BACKUP_DIR:/backup alpine tar -czf /backup/redis-data.tar.gz /data
```

## 10. Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Self-hosted Runners Documentation](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Docker Documentation](https://docs.docker.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Redis Documentation](https://redis.io/documentation)
- [Nginx Setup with SSL](./nginx-ssl-setup.md) - Guide for setting up Nginx as a reverse proxy with SSL 