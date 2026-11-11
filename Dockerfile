# Production Dockerfile for Google Maps Lead Scanner PRO
FROM node:20-bullseye-slim

# Install system Chromium and required font and rendering libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer executable path to the pre-installed system Chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

# Copy root and workspace package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all workspace dependencies
RUN npm run install:all

# Copy the rest of the application files
COPY . .

# Build the frontend production bundle
RUN npm run build:frontend

# Expose port (Render/Railway dynamically inject PORT)
EXPOSE 3001

# Run the unified fullstack server
CMD ["node", "backend/server.js"]
