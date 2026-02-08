FROM node:18-slim

# Install LibreOffice and fonts for document conversion
RUN apt-get update && apt-get install -y \
    libreoffice-writer \
    libreoffice-common \
    fonts-liberation \
    fonts-dejavu \
    make \
    g++ \
    python3 \
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
