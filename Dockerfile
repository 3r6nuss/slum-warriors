# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build frontend
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy backend server
COPY server/ ./server/

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Serve static frontend from Express in production
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Data volume for SQLite database
VOLUME /app/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/lagerverwaltung.db

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
