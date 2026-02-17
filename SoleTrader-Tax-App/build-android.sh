#!/bin/bash

echo "🚀 Building Android App with Bubblewrap..."

# Check if bubblewrap is installed
if ! command -v bubblewrap &> /dev/null
then
    echo "Installing Bubblewrap CLI..."
    npm install -g @bubblewrap/cli
fi

# Initialize project (only needed first time)
if [ ! -f "twa-manifest.json" ]; then
    echo "Initializing Bubblewrap project..."
    bubblewrap init --manifest https://YOUR-USERNAME.github.io/sole-trader-tax/manifest.json
fi

# Build the Android app
echo "Building Android package..."
bubblewrap build

echo "✅ Build complete! Check the app-release-signed.apk file"
echo "Upload this to Google Play Console"
