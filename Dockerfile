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

# Set ARGs for user ID mapping with host
ARG USER_ID=1000
ARG GROUP_ID=1000

# Update the appuser and appgroup IDs to match host's user
RUN apk add --no-cache shadow && \
    groupmod -g ${GROUP_ID} appgroup && \
    usermod -u ${USER_ID} appuser && \
    apk del shadow

# Copy build artifacts with correct ownership
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} /app/dist ./dist
COPY --from=builder --chown=${USER_ID}:${GROUP_ID} /app/node_modules ./node_modules
COPY --chown=${USER_ID}:${GROUP_ID} package*.json ./
COPY --chown=${USER_ID}:${GROUP_ID} tsconfig*.json ./

# Ensure all files have correct ownership
RUN chown -R ${USER_ID}:${GROUP_ID} /app

# Switch to non-root user for running the app
USER appuser

EXPOSE 8080

CMD ["npm", "run", "start:prod"] 