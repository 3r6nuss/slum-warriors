# ---- Build Stage ----
FROM node:22-alpine AS builder

# Build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build frontend
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine

# Build tools for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && apk del python3 make g++

# Copy backend server
COPY server/ ./server/

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Data volume for SQLite database
VOLUME /app/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/lagerverwaltung.db

EXPOSE 3001

CMD ["node", "server/index.js"]
