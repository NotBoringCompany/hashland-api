FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:20-alpine

# Add a non-root user and group with default IDs
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Set ARGs for user ID mapping with host
ARG USER_ID=1000
ARG GROUP_ID=1000

# Update the appuser and appgroup IDs to match host's user - Alpine specific approach
RUN \
    # Only make changes if IDs are not the defaults
    if [ "${USER_ID}" != "1000" ] || [ "${GROUP_ID}" != "1000" ]; then \
        # Install shadow package for user/group manipulation
        apk add --no-cache shadow && \
        # Handle user and group changes with proper conditional checks
        if [ "${GROUP_ID}" != "1000" ]; then \
            # Change GID for appgroup
            sed -i -e "s/x:1000:/x:${GROUP_ID}:/g" /etc/group && \
            find / -group 1000 -exec chgrp -h ${GROUP_ID} {} \; 2>/dev/null || true; \
        fi && \
        if [ "${USER_ID}" != "1000" ]; then \
            # Change UID for appuser
            sed -i -e "s/x:1000:/x:${USER_ID}:/g" /etc/passwd && \
            find / -user 1000 -exec chown -h ${USER_ID} {} \; 2>/dev/null || true; \
        fi && \
        # Remove shadow package as it's no longer needed
        apk del shadow; \
    fi

# Copy build artifacts with correct ownership
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup tsconfig*.json ./

# Ensure all files have correct ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user for running the app
USER appuser

EXPOSE 8080

CMD ["npm", "run", "start:prod"] 