FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Clear npm cache and install dependencies with exact versions
RUN npm cache clean --force
RUN npm ci --only=production=false

COPY . .

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig*.json ./

EXPOSE 8080

CMD ["npm", "run", "start:prod"] 