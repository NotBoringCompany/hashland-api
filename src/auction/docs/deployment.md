# Deployment Guide

## Overview

This guide covers deploying the Auction System to production environments, including configuration, monitoring, scaling, and maintenance procedures.

**Target Environments**: Production, Staging, Development  
**Infrastructure**: Docker, Kubernetes, AWS/Azure/GCP  
**Monitoring**: Prometheus, Grafana, ELK Stack

## Prerequisites

### System Requirements

**Minimum Requirements**:
- CPU: 4 cores
- RAM: 8GB
- Storage: 100GB SSD
- Network: 1Gbps

**Recommended Requirements**:
- CPU: 8 cores
- RAM: 16GB
- Storage: 500GB SSD
- Network: 10Gbps

### Dependencies

**Runtime Dependencies**:
- Node.js 18+ LTS
- MongoDB 6.0+
- Redis 7.0+
- Nginx (reverse proxy)

**Development Dependencies**:
- Docker & Docker Compose
- Kubernetes CLI (kubectl)
- Helm 3+
- Terraform (infrastructure)

## Environment Configuration

### Environment Variables

**Required Variables**:
```bash
# Database Configuration
MONGODB_URI=mongodb://username:password@host:27017/hashland_auction
MONGODB_SSL=true
MONGODB_AUTH_SOURCE=admin

# Redis Configuration
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=secure_redis_password
REDIS_TLS=true

# Application Configuration
NODE_ENV=production
PORT=3000
JWT_SECRET=ultra_secure_jwt_secret_256_bits_minimum
JWT_EXPIRATION=24h

# Queue Configuration
REDIS_QUEUE_HOST=redis-queue.example.com
REDIS_QUEUE_PORT=6379
REDIS_QUEUE_PASSWORD=queue_password
REDIS_QUEUE_DB=1

# WebSocket Configuration
WEBSOCKET_PORT=3001
WEBSOCKET_CORS_ORIGIN=https://app.example.com
WEBSOCKET_ADAPTER=redis

# Auction Configuration
DEFAULT_AUCTION_DURATION_HOURS=24
DEFAULT_WHITELIST_DURATION_HOURS=48
MIN_BID_INCREMENT=10
DEFAULT_ENTRY_FEE=100
LIFECYCLE_CRON_SCHEDULE="0 * * * * *"

# Monitoring & Logging
LOG_LEVEL=info
ENABLE_METRICS=true
METRICS_PORT=9090
SENTRY_DSN=https://your-sentry-dsn

# Security
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_ROUNDS=12
CORS_ORIGIN=https://app.example.com

# File Storage (if applicable)
AWS_REGION=us-east-1
AWS_S3_BUCKET=auction-assets
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Email Configuration (if applicable)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASSWORD=smtp_password
```

**Optional Variables**:
```bash
# Performance Tuning
MAX_POOL_SIZE=10
CONNECTION_TIMEOUT=30000
SOCKET_TIMEOUT=0

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_NOTIFICATIONS=true
ENABLE_DEBUGGING=false

# Cache Configuration
CACHE_TTL=300
CACHE_MAX_SIZE=1000
```

### Configuration Files

**Production Configuration** (`config/production.yaml`):
```yaml
database:
  mongodb:
    uri: ${MONGODB_URI}
    options:
      useNewUrlParser: true
      useUnifiedTopology: true
      maxPoolSize: 10
      serverSelectionTimeoutMS: 5000
      socketTimeoutMS: 45000
      bufferMaxEntries: 0
      bufferCommands: false

redis:
  host: ${REDIS_HOST}
  port: ${REDIS_PORT}
  password: ${REDIS_PASSWORD}
  tls: true
  retryDelayOnFailover: 100
  maxRetriesPerRequest: 3

queue:
  redis:
    host: ${REDIS_QUEUE_HOST}
    port: ${REDIS_QUEUE_PORT}
    password: ${REDIS_QUEUE_PASSWORD}
    db: 1
  concurrency: 10
  removeOnComplete: 100
  removeOnFail: 50

websocket:
  port: ${WEBSOCKET_PORT}
  cors:
    origin: ${WEBSOCKET_CORS_ORIGIN}
    credentials: true
  adapter: redis
  transports: ['websocket', 'polling']

logging:
  level: ${LOG_LEVEL}
  format: json
  destinations:
    - console
    - file
    - elasticsearch

security:
  jwt:
    secret: ${JWT_SECRET}
    expiresIn: ${JWT_EXPIRATION}
  cors:
    origin: ${CORS_ORIGIN}
    credentials: true
  rateLimit:
    windowMs: ${RATE_LIMIT_WINDOW_MS}
    max: ${RATE_LIMIT_MAX_REQUESTS}

monitoring:
  metrics:
    enabled: ${ENABLE_METRICS}
    port: ${METRICS_PORT}
  healthCheck:
    path: /health
    interval: 30000
  sentry:
    dsn: ${SENTRY_DSN}
    environment: production
```

## Docker Deployment

### Dockerfile

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Copy source code
COPY . .

# Build application
RUN yarn build

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock ./

# Install production dependencies only
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Security: Run as non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/main"]
```

### Docker Compose

**Production Docker Compose** (`docker-compose.prod.yml`):
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_HOST=redis
      - REDIS_QUEUE_HOST=redis
    depends_on:
      - mongodb
      - redis
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: hashland_auction
    volumes:
      - mongodb_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mongodb_data:
  redis_data:
```

### Nginx Configuration

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app_servers {
        server app:3000;
    }

    upstream websocket_servers {
        server app:3001;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=websocket:10m rate=5r/s;

    server {
        listen 80;
        server_name api.example.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.example.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

        # Security Headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

        # API Routes
        location /api {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app_servers;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket Routes
        location /socket.io/ {
            limit_req zone=websocket burst=10 nodelay;
            proxy_pass http://websocket_servers;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health Check
        location /health {
            proxy_pass http://app_servers;
            access_log off;
        }
    }
}
```

## Kubernetes Deployment

### Namespace Configuration

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: auction-system
  labels:
    name: auction-system
    environment: production
```

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: auction-config
  namespace: auction-system
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3000"
  WEBSOCKET_PORT: "3001"
  DEFAULT_AUCTION_DURATION_HOURS: "24"
  DEFAULT_WHITELIST_DURATION_HOURS: "48"
  MIN_BID_INCREMENT: "10"
  DEFAULT_ENTRY_FEE: "100"
  RATE_LIMIT_WINDOW_MS: "60000"
  RATE_LIMIT_MAX_REQUESTS: "100"
```

### Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: auction-secrets
  namespace: auction-system
type: Opaque
data:
  mongodb-uri: <base64-encoded-mongodb-uri>
  jwt-secret: <base64-encoded-jwt-secret>
  redis-password: <base64-encoded-redis-password>
  sentry-dsn: <base64-encoded-sentry-dsn>
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auction-api
  namespace: auction-system
  labels:
    app: auction-api
    version: v1.0.0
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auction-api
  template:
    metadata:
      labels:
        app: auction-api
        version: v1.0.0
    spec:
      containers:
      - name: auction-api
        image: your-registry/auction-api:v1.0.0
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 3001
          name: websocket
        envFrom:
        - configMapRef:
            name: auction-config
        env:
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: auction-secrets
              key: mongodb-uri
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: auction-secrets
              key: jwt-secret
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: auction-secrets
              key: redis-password
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: auction-api-service
  namespace: auction-system
spec:
  selector:
    app: auction-api
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: websocket
    port: 3001
    targetPort: 3001
  type: ClusterIP
```

### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: auction-ingress
  namespace: auction-system
  annotations:
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rate-limit: "10"
    nginx.ingress.kubernetes.io/rate-limit-window: "60s"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: auction-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: auction-api-service
            port:
              number: 80
      - path: /socket.io
        pathType: Prefix
        backend:
          service:
            name: auction-api-service
            port:
              number: 3001
```

### HorizontalPodAutoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auction-api-hpa
  namespace: auction-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auction-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Database Setup

### MongoDB Configuration

**Replica Set Configuration**:
```javascript
// Initialize replica set
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongodb-0.mongodb:27017" },
    { _id: 1, host: "mongodb-1.mongodb:27017" },
    { _id: 2, host: "mongodb-2.mongodb:27017" }
  ]
});

// Create application user
use hashland_auction;
db.createUser({
  user: "auction_app",
  pwd: "secure_password",
  roles: [
    { role: "readWrite", db: "hashland_auction" }
  ]
});

// Create indexes
db.auctions.createIndex({ status: 1, createdAt: -1 });
db.bids.createIndex({ auctionId: 1, createdAt: -1 });
db.auction_whitelists.createIndex({ auctionId: 1, operatorId: 1 }, { unique: true });
```

**MongoDB Connection Monitoring**:
```yaml
# MongoDB monitoring with Prometheus
apiVersion: v1
kind: Service
metadata:
  name: mongodb-exporter
  labels:
    app: mongodb-exporter
spec:
  ports:
  - port: 9216
    targetPort: 9216
    name: metrics
  selector:
    app: mongodb-exporter
```

### Redis Configuration

**Redis Cluster Setup**:
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
spec:
  serviceName: redis
  replicas: 6
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - /etc/redis/redis.conf
        - --cluster-enabled yes
        - --cluster-config-file nodes.conf
        - --cluster-node-timeout 5000
        - --appendonly yes
        ports:
        - containerPort: 6379
        - containerPort: 16379
        volumeMounts:
        - name: redis-data
          mountPath: /data
        - name: redis-config
          mountPath: /etc/redis
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

## Monitoring and Logging

### Prometheus Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    rule_files:
      - "auction_rules.yml"

    scrape_configs:
    - job_name: 'auction-api'
      static_configs:
      - targets: ['auction-api-service:9090']
      metrics_path: /metrics
      scrape_interval: 10s

    - job_name: 'mongodb'
      static_configs:
      - targets: ['mongodb-exporter:9216']

    - job_name: 'redis'
      static_configs:
      - targets: ['redis-exporter:9121']

    alerting:
      alertmanagers:
      - static_configs:
        - targets:
          - alertmanager:9093
```

### Grafana Dashboards

**Auction System Dashboard** (`auction-dashboard.json`):
```json
{
  "dashboard": {
    "title": "Auction System Monitoring",
    "panels": [
      {
        "title": "Active Auctions",
        "type": "stat",
        "targets": [
          {
            "expr": "auction_active_count",
            "legendFormat": "Active Auctions"
          }
        ]
      },
      {
        "title": "Bid Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(auction_bids_total[5m])",
            "legendFormat": "Bids per second"
          }
        ]
      },
      {
        "title": "WebSocket Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "websocket_connections_active",
            "legendFormat": "Active Connections"
          }
        ]
      },
      {
        "title": "Queue Metrics",
        "type": "graph",
        "targets": [
          {
            "expr": "bid_queue_waiting",
            "legendFormat": "Waiting Jobs"
          },
          {
            "expr": "bid_queue_processing",
            "legendFormat": "Processing Jobs"
          }
        ]
      }
    ]
  }
}
```

### ELK Stack Configuration

**Elasticsearch Index Template**:
```json
{
  "index_patterns": ["auction-logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 1,
      "index.refresh_interval": "5s"
    },
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "level": { "type": "keyword" },
        "message": { "type": "text" },
        "service": { "type": "keyword" },
        "auctionId": { "type": "keyword" },
        "operatorId": { "type": "keyword" },
        "action": { "type": "keyword" },
        "duration": { "type": "long" },
        "error": {
          "properties": {
            "message": { "type": "text" },
            "stack": { "type": "text" }
          }
        }
      }
    }
  }
}
```

**Kibana Index Pattern**:
- Pattern: `auction-logs-*`
- Time field: `@timestamp`
- Default fields: `level`, `service`, `message`, `auctionId`

## Security Hardening

### Network Security

**Network Policies**:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: auction-network-policy
  namespace: auction-system
spec:
  podSelector:
    matchLabels:
      app: auction-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
    - protocol: TCP
      port: 3001
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: database
    ports:
    - protocol: TCP
      port: 27017
  - to:
    - namespaceSelector:
        matchLabels:
          name: cache
    ports:
    - protocol: TCP
      port: 6379
```

### Pod Security Standards

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: auction-api
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    runAsGroup: 1001
    fsGroup: 1001
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: auction-api
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      runAsNonRoot: true
      runAsUser: 1001
      capabilities:
        drop:
        - ALL
```

### SSL/TLS Configuration

**Certificate Management with cert-manager**:
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

## Scaling and Performance

### Horizontal Scaling

**Application Scaling**:
- Use HPA for automatic scaling based on CPU/memory
- Scale WebSocket pods separately from API pods
- Implement session affinity for WebSocket connections

**Database Scaling**:
- MongoDB sharding for high-volume collections
- Read replicas for analytics queries
- Connection pooling optimization

**Cache Scaling**:
- Redis cluster for high availability
- Separate cache instances for different data types
- Cache warming strategies

### Performance Optimization

**Application Level**:
```typescript
// Connection pooling
const mongoOptions = {
  maxPoolSize: 10,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferMaxEntries: 0,
  bufferCommands: false
};

// Redis clustering
const redisCluster = new Redis.Cluster([
  { host: 'redis-0', port: 6379 },
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 }
], {
  enableReadyCheck: false,
  redisOptions: {
    password: process.env.REDIS_PASSWORD
  }
});
```

**Database Optimization**:
```javascript
// Index creation for performance
db.bids.createIndex({ auctionId: 1, createdAt: -1 }, { background: true });
db.auctions.createIndex({ status: 1, "auctionConfig.endTime": 1 }, { background: true });

// Query optimization
db.bids.aggregate([
  { $match: { auctionId: ObjectId("...") } },
  { $sort: { createdAt: -1 } },
  { $limit: 20 },
  { $lookup: { from: "operators", localField: "bidderId", foreignField: "_id", as: "bidder" } }
]);
```

## Backup and Disaster Recovery

### Automated Backups

**MongoDB Backup Script**:
```bash
#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/backup/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Perform backup
mongodump \
  --uri="$MONGODB_URI" \
  --out="$BACKUP_DIR/$DATE" \
  --gzip

# Compress backup
tar -czf "$BACKUP_DIR/mongodb_backup_$DATE.tar.gz" \
  -C "$BACKUP_DIR" "$DATE"

# Upload to cloud storage
aws s3 cp "$BACKUP_DIR/mongodb_backup_$DATE.tar.gz" \
  "s3://backup-bucket/mongodb/"

# Cleanup old backups
find "$BACKUP_DIR" -name "mongodb_backup_*.tar.gz" \
  -mtime +$RETENTION_DAYS -delete

# Remove temporary directory
rm -rf "$BACKUP_DIR/$DATE"
```

### Disaster Recovery Procedures

**Database Recovery**:
```bash
# Download latest backup
aws s3 cp s3://backup-bucket/mongodb/mongodb_backup_latest.tar.gz .

# Extract backup
tar -xzf mongodb_backup_latest.tar.gz

# Restore database
mongorestore \
  --uri="$MONGODB_URI" \
  --drop \
  --gzip \
  ./backup_directory
```

**Application Recovery**:
```bash
# Scale down application
kubectl scale deployment auction-api --replicas=0

# Restore database
./restore_database.sh

# Update application configuration if needed
kubectl apply -f k8s/

# Scale up application
kubectl scale deployment auction-api --replicas=3

# Verify health
kubectl get pods -l app=auction-api
```

## Maintenance Procedures

### Rolling Updates

```bash
# Update deployment with zero downtime
kubectl set image deployment/auction-api \
  auction-api=your-registry/auction-api:v1.1.0

# Monitor rollout
kubectl rollout status deployment/auction-api

# Rollback if needed
kubectl rollout undo deployment/auction-api
```

### Database Maintenance

```javascript
// Index maintenance
db.runCommand({ reIndex: "bids" });
db.runCommand({ compact: "auction_history" });

// Statistics update
db.runCommand({ planCacheClear: "auctions" });

// Replica set maintenance
rs.stepDown(60); // Step down primary for 60 seconds
```

### Log Rotation

```yaml
# Logrotate configuration
/var/log/auction/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 auction auction
    postrotate
        /bin/kill -USR1 $(cat /var/run/auction.pid 2> /dev/null) 2> /dev/null || true
    endscript
}
```

## Troubleshooting

### Common Issues

**High Memory Usage**:
```bash
# Check memory usage
kubectl top pods -l app=auction-api

# Analyze heap dump
node --inspect-brk=0.0.0.0:9229 dist/main.js

# Increase memory limits
kubectl patch deployment auction-api -p \
'{"spec":{"template":{"spec":{"containers":[{"name":"auction-api","resources":{"limits":{"memory":"4Gi"}}}]}}}}'
```

**Database Connection Issues**:
```bash
# Check connection pool
db.serverStatus().connections

# Monitor slow queries
db.setProfilingLevel(2, { slowms: 100 })
db.system.profile.find().sort({ ts: -1 }).limit(5)

# Check replica set status
rs.status()
```

**Queue Bottlenecks**:
```bash
# Monitor queue metrics
curl http://auction-api:9090/metrics | grep queue

# Scale queue workers
kubectl scale deployment queue-worker --replicas=10

# Clear failed jobs
redis-cli -h redis EVAL "return redis.call('del', unpack(redis.call('keys', 'bull:bid-queue:failed:*')))" 0
```

### Health Checks

**Application Health**:
```typescript
@Get('health')
async healthCheck() {
  const checks = {
    database: await this.checkDatabase(),
    redis: await this.checkRedis(),
    queue: await this.checkQueue(),
    websocket: await this.checkWebSocket()
  };
  
  const isHealthy = Object.values(checks).every(check => check.status === 'ok');
  
  return {
    status: isHealthy ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    checks
  };
}
```

**External Monitoring**:
```bash
# Uptime monitoring
curl -f http://api.example.com/health

# Response time monitoring
curl -o /dev/null -s -w "%{time_total}" http://api.example.com/api/auctions

# WebSocket connectivity
wscat -c ws://api.example.com/auction
```

### Performance Tuning

**Node.js Optimization**:
```bash
# Increase heap size
NODE_OPTIONS="--max_old_space_size=4096"

# Enable garbage collection logging
NODE_OPTIONS="--trace-gc --trace-gc-verbose"

# Optimize event loop
UV_THREADPOOL_SIZE=128
```

**Database Tuning**:
```javascript
// MongoDB connection optimization
const options = {
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000
};
```

This deployment guide provides comprehensive coverage of deploying the auction system in production environments with proper monitoring, security, and maintenance procedures. 