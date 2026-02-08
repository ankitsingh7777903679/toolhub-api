FROM node:20-slim

# Install LibreOffice and fonts for document conversion
RUN apt-get update && apt-get install -y \
    libreoffice-writer \
    libreoffice-common \
    fonts-liberation \
    fonts-dejavu \
    make \
    g++ \
    python3 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Expose the port Render expects
EXPOSE 10000

# Start the application
CMD ["node", "index.js"]
