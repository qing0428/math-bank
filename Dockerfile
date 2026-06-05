# ── Build frontend ──
FROM node:20-alpine AS build
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --prefer-offline || npm install
COPY . .
RUN npm run build

# ── Production ──
FROM node:20-alpine
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk add --no-cache python3 make g++
WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

# Copy server source
COPY server/ .

# Copy built frontend into server/dist
COPY --from=build /app/dist ./dist

# Create directories for data persistence
RUN mkdir -p /data/images

EXPOSE 3001
CMD ["node", "index.js"]
