FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:20-alpine

# Add a non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig*.json ./

# Set proper permissions - use environment variables for user IDs to match host's github-runner
# ARG values will be overridden at build time in CI/CD pipeline
ARG USER_ID=1000
ARG GROUP_ID=1000

# Change ownership of all files to match the host runner's UID/GID
RUN chown -R ${USER_ID}:${GROUP_ID} /app

# Switch to non-root user for running the app
USER appuser

EXPOSE 8080

CMD ["npm", "run", "start:prod"] 