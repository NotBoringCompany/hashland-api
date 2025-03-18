# Nginx Setup with SSL for Hashland API

This guide explains how to set up Nginx as a reverse proxy with SSL certificates using Certbot for your Hashland API application.

## Prerequisites

- Ubuntu server with SSH access
- Domain name pointed to your server's IP address
- Hashland API running on port 8080

## 1. Install Nginx

```bash
# Update package lists
sudo apt update

# Install Nginx
sudo apt install -y nginx

# Start Nginx and enable it to run on system boot
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify Nginx is running
sudo systemctl status nginx
```

## 2. Configure Firewall (if enabled)

If you have a firewall enabled (like UFW), allow HTTP, HTTPS, and SSH:

```bash
sudo ufw allow 'Nginx Full'  # Allows both HTTP and HTTPS
sudo ufw allow ssh
sudo ufw status
```

## 3. Create Nginx Configuration

Create a new Nginx server block configuration:

```bash
# Create configuration file
sudo nano /etc/nginx/sites-available/hashland-api
```

Add the following configuration, replacing `yourdomain.com` with your actual domain:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration:

```bash
# Create symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/hashland-api /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx to apply changes
sudo systemctl reload nginx
```

## 4. Install Certbot for SSL

Install Certbot and the Nginx plugin:

```bash
# Install Certbot and Nginx plugin
sudo apt install -y certbot python3-certbot-nginx
```

## 5. Obtain SSL Certificate

Use Certbot to automatically obtain and configure SSL certificates:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the interactive prompts:
- Enter your email address for important notifications
- Agree to the terms of service
- Choose whether to redirect HTTP traffic to HTTPS (recommended)

Certbot will automatically modify your Nginx configuration to use SSL.

## 6. Verify SSL Configuration

After Certbot completes, your Nginx configuration should be updated automatically to include SSL settings. You can verify the changes:

```bash
sudo cat /etc/nginx/sites-available/hashland-api
```

The configuration should now include SSL-related directives and redirect from HTTP to HTTPS.

## 7. Test the Setup

Visit your domain in a browser:
- `https://yourdomain.com`

You should see your Hashland API application running with a secure connection (lock icon in the browser).

## 8. Auto-renewal Configuration

Certbot automatically adds a cron job to renew certificates before they expire. You can test the renewal process with:

```bash
sudo certbot renew --dry-run
```

## 9. Production Setup with Multiple Environments

For multiple environments (development/production), you can use subdomains with separate configurations:

### Development Environment (dev.yourdomain.com)

```bash
sudo nano /etc/nginx/sites-available/hashland-api-dev
```

```nginx
server {
    listen 80;
    server_name dev.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and secure it:

```bash
sudo ln -s /etc/nginx/sites-available/hashland-api-dev /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d dev.yourdomain.com
```

### Production Environment (yourdomain.com)

The configuration you already created serves as your production environment.

## 10. Customizing Nginx for Specific Needs

### Rate Limiting

To protect your API from abuse, add rate limiting:

```nginx
# Add inside the server block
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location / {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://localhost:8080;
    # Rest of proxy settings...
}
```

### Enabling Compression

To improve performance, enable gzip compression:

```nginx
# Add inside the server block
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
gzip_comp_level 6;
gzip_min_length 1000;
```

### WebSocket Support

For WebSocket connections (already included in the base config):

```nginx
location /socket.io/ {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

## 11. Troubleshooting

### Check Nginx Error Logs

```bash
sudo tail -f /var/log/nginx/error.log
```

### Check Nginx Access Logs

```bash
sudo tail -f /var/log/nginx/access.log
```

### Common Issues and Solutions

1. **502 Bad Gateway**
   - Ensure your Hashland API is running: `docker ps`
   - Check if it's accessible on port 8080: `curl localhost:8080/health`

2. **SSL Certificate Not Renewed**
   - Run manual renewal: `sudo certbot renew`
   - Check certbot logs: `sudo systemctl status certbot.timer`

3. **Performance Issues**
   - Optimize Nginx worker settings in `/etc/nginx/nginx.conf`
   - Enable caching for static content

## 12. Security Considerations

- Keep your server, Nginx, and Certbot updated
- Configure strong SSL settings (TLS 1.2+)
- Set up appropriate headers for security:

```nginx
# Add inside server block
add_header X-Frame-Options "SAMEORIGIN";
add_header X-XSS-Protection "1; mode=block";
add_header X-Content-Type-Options "nosniff";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
``` 