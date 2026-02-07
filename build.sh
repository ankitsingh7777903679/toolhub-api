#!/bin/bash
# Build script for Render deployment
# This script installs LibreOffice for Word to PDF conversion

echo "Installing LibreOffice..."
apt-get update -qq
apt-get install -y libreoffice-writer libreoffice-common fonts-liberation fonts-dejavu
echo "LibreOffice installed successfully!"

echo "Installing npm dependencies..."
npm install
echo "Build complete!"
