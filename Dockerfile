# ── Build frontend ──
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ── Production ──
FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev

# Copy server source
COPY server/ .

# Copy built frontend into server/dist
COPY --from=build /app/dist ./dist

EXPOSE 3001
CMD ["node", "index.js"]
