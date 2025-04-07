# MongoDB Production Setup Guide

This guide provides step-by-step instructions for setting up a production-ready MongoDB v8 installation on Ubuntu Linux with replication (1 primary + 2 secondary nodes) and SSL encryption using Certbot.

## Prerequisites

- 3 Ubuntu Linux VPS servers (recommended Ubuntu 22.04 LTS)
- A domain name for the MongoDB primary endpoint (e.g., mongodb.yourdomain.com)
- SSH access to all servers
- Root or sudo privileges on all servers

## Overview of Setup Steps

1. Prepare all servers
2. Install MongoDB v8 Community Edition on all servers
3. Configure MongoDB for replication
4. Set up SSL with Certbot
5. Configure MongoDB for SSL
6. Set up authentication
7. Test the replica set
8. Configure MongoDB domain endpoint
9. Final security considerations

## 1. Prepare All Servers

Execute these steps on all three servers:

```bash
# Update package lists and upgrade packages
sudo apt update
sudo apt upgrade -y

# Install necessary packages
sudo apt install -y gnupg curl software-properties-common

# Configure system settings for MongoDB
echo "vm.swappiness = 1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Create a separate user for MongoDB (optional but recommended)
sudo useradd -m -s /bin/bash mongodb
sudo passwd mongodb

# Create data and log directories
sudo mkdir -p /var/lib/mongodb
sudo mkdir -p /var/log/mongodb
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb

# Setup firewall (adjust ports as needed)
sudo apt install -y ufw
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 27017/tcp
sudo ufw allow 27018/tcp
sudo ufw allow 27019/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## 2. Install MongoDB v8 Community Edition

Execute these steps on all three servers:

```bash
# Import MongoDB GPG key
curl -fsSL https://pgp.mongodb.com/server-8.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg \
   --dearmor

# Create list file for MongoDB
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/8.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# Update package lists
sudo apt update

# Install MongoDB v8
sudo apt install -y mongodb-org

# Enable MongoDB service
sudo systemctl enable mongod
sudo systemctl start mongod

# Verify installation
mongod --version
```

## 3. Configure MongoDB for Replication

### Configure each server individually

#### On all servers, edit the MongoDB configuration file:

```bash
sudo nano /etc/mongod.conf
```

Update the configuration with the following settings (adjust for each server):

```yaml
# Network configuration
net:
  port: 27017
  bindIp: 0.0.0.0  # Bind to all interfaces (secure with proper firewall rules)

# Storage configuration
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

# System log configuration
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

# Process management configuration
processManagement:
  timeZoneInfo: /usr/share/zoneinfo

# Replication configuration
replication:
  replSetName: "rs0"
```

After updating the configuration file on each server, restart MongoDB:

```bash
sudo systemctl restart mongod
```

### Initialize the replica set

Connect to the MongoDB shell on the intended primary node:

```bash
mongosh
```

Initialize the replica set:

```javascript
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "primary-server-ip:27017", priority: 10 },
    { _id: 1, host: "secondary1-server-ip:27017", priority: 1 },
    { _id: 2, host: "secondary2-server-ip:27017", priority: 1 }
  ]
})
```

Check the replica set status:

```javascript
rs.status()
```

## 4. Set Up SSL with Certbot

Execute these steps on all three servers:

```bash
# Install Certbot
sudo apt install -y certbot

# Obtain certificates (replace with your domain)
sudo certbot certonly --standalone -d mongodb.yourdomain.com

# Create directory for MongoDB certificates
sudo mkdir -p /etc/mongodb/ssl
```

On the primary server, generate certificates:

```bash
# Copy the certificates to MongoDB directory
sudo cp /etc/letsencrypt/live/mongodb.yourdomain.com/fullchain.pem /etc/mongodb/ssl/
sudo cp /etc/letsencrypt/live/mongodb.yourdomain.com/privkey.pem /etc/mongodb/ssl/

# Create a PEM file containing both the private key and the certificate chain
sudo cat /etc/letsencrypt/live/mongodb.yourdomain.com/privkey.pem /etc/letsencrypt/live/mongodb.yourdomain.com/fullchain.pem > /etc/mongodb/ssl/mongodb.pem

# Set proper permissions
sudo chmod 600 /etc/mongodb/ssl/mongodb.pem
sudo chown mongodb:mongodb /etc/mongodb/ssl/mongodb.pem
```

Set up auto-renewal for the certificates:

```bash
sudo nano /etc/cron.d/certbot-renewal
```

Add the following content:

```
0 */12 * * * root certbot renew --quiet --post-hook "cat /etc/letsencrypt/live/mongodb.yourdomain.com/privkey.pem /etc/letsencrypt/live/mongodb.yourdomain.com/fullchain.pem > /etc/mongodb/ssl/mongodb.pem && chmod 600 /etc/mongodb/ssl/mongodb.pem && chown mongodb:mongodb /etc/mongodb/ssl/mongodb.pem && systemctl restart mongod"
```

## 5. Configure MongoDB for SSL

Update the MongoDB configuration file on all servers:

```bash
sudo nano /etc/mongod.conf
```

Add SSL configuration:

```yaml
# SSL Configuration
net:
  port: 27017
  bindIp: 0.0.0.0
  ssl:
    mode: requireSSL
    PEMKeyFile: /etc/mongodb/ssl/mongodb.pem
    disabledProtocols: TLS1_0,TLS1_1
    allowConnectionsWithoutCertificates: true
```

Restart MongoDB on all servers:

```bash
sudo systemctl restart mongod
```

## 6. Set Up Authentication

On the primary node, create an admin user:

```bash
mongosh --host mongodb.yourdomain.com --tls --tlsAllowInvalidCertificates
```

In the MongoDB shell:

```javascript
use admin
db.createUser({
  user: "mongoAdmin",
  pwd: "securePassword",  // Replace with a secure password
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" },
    { role: "clusterAdmin", db: "admin" }
  ]
})
```

Update the MongoDB configuration file on all servers to enable authentication:

```bash
sudo nano /etc/mongod.conf
```

Add the security section:

```yaml
# Security configuration
security:
  authorization: enabled
  keyFile: /etc/mongodb/keyfile
```

Create a keyfile for internal authentication between replica set members:

```bash
# Generate a secure random key
openssl rand -base64 756 > /tmp/mongodb-keyfile

# Set proper ownership and permissions
sudo mv /tmp/mongodb-keyfile /etc/mongodb/keyfile
sudo chmod 400 /etc/mongodb/keyfile
sudo chown mongodb:mongodb /etc/mongodb/keyfile
```

Copy this keyfile to all replica set members and ensure it has the same permissions on each server.

Restart MongoDB on all servers:

```bash
sudo systemctl restart mongod
```

## 7. Test the Replica Set

Connect to the primary node using authentication:

```bash
mongosh --host mongodb.yourdomain.com --tls --tlsAllowInvalidCertificates -u mongoAdmin -p securePassword --authenticationDatabase admin
```

Check the replica set status:

```javascript
rs.status()
```

Verify data replication by inserting data and checking it on secondary nodes:

```javascript
// On primary
use testdb
db.test.insertOne({ name: "test" })

// On secondary (need to enable reads on secondary)
rs.secondaryOk()
use testdb
db.test.find()
```

## 8. Configure MongoDB Domain Endpoint

Set up DNS records for your domain:

- Create an A record for mongodb.yourdomain.com pointing to the primary server's IP address
- Optionally, create CNAME records for secondary nodes

To enable connection string access, update MongoDB configuration on the primary node:

```bash
sudo nano /etc/mongod.conf
```

Update the net section to include your domain:

```yaml
net:
  port: 27017
  bindIp: 0.0.0.0
  ssl:
    mode: requireSSL
    PEMKeyFile: /etc/mongodb/ssl/mongodb.pem
    disabledProtocols: TLS1_0,TLS1_1
    allowConnectionsWithoutCertificates: true
  serverSelectionTimeoutMS: 15000
```

Restart MongoDB:

```bash
sudo systemctl restart mongod
```

## 9. Final Security Considerations

1. **Disable root SSH access**:
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Set PermitRootLogin to no
   sudo systemctl restart ssh
   ```

2. **Enable automatic updates**:
   ```bash
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

3. **Configure MongoDB monitoring** (e.g., with MongoDB Atlas monitoring or Prometheus/Grafana)

4. **Set up regular backups**:
   ```bash
   # Create a backup script
   sudo nano /usr/local/bin/mongodb-backup.sh
   ```
   
   Add the following content:
   ```bash
   #!/bin/bash
   BACKUP_DIR="/var/backups/mongodb"
   DATE=$(date +%Y-%m-%d-%H%M)
   mkdir -p $BACKUP_DIR
   mongodump --host mongodb.yourdomain.com --tls --tlsAllowInvalidCertificates -u mongoAdmin -p securePassword --authenticationDatabase admin --out $BACKUP_DIR/$DATE
   
   # Keep only last 7 days of backups
   find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;
   ```
   
   Make it executable and set up a daily cron job:
   ```bash
   sudo chmod +x /usr/local/bin/mongodb-backup.sh
   sudo nano /etc/cron.d/mongodb-backup
   ```
   
   Add:
   ```
   0 2 * * * root /usr/local/bin/mongodb-backup.sh > /var/log/mongodb-backup.log 2>&1
   ```

## Connection String for Applications

Your applications can connect to the MongoDB replica set using the following connection string:

```
mongodb://mongoAdmin:securePassword@mongodb.yourdomain.com:27017/?replicaSet=rs0&tls=true&authSource=admin
```

## Troubleshooting

- **Connection issues**: Check firewall rules, SSL certificates, and network connectivity
- **Replication issues**: Verify replica set configuration and server communication
- **Authentication issues**: Ensure keyfile is identical on all servers and has correct permissions
- **SSL errors**: Check certificate validity and paths in configuration

For more detailed MongoDB documentation, refer to the [MongoDB official documentation](https://www.mongodb.com/docs/) 