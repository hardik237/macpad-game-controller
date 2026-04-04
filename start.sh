#!/bin/bash
set -e

# Change to exactly where this script is
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Cleanup function to stop Docker container when script exits
cleanup() {
    echo "🛑 Stopping UI container..."
    docker-compose down
}
trap cleanup EXIT

echo "📱 Starting Gamepad Bridge Local Environment..."

# 1. Start Docker Container for the UI
echo "🐳 Building and starting UI container..."
docker-compose up -d --build

# 2. Get local IP address
# Using simple ipconfig for macOS to find en0 or active interface
LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
if [ -z "$LOCAL_IP" ]; then
    echo "Could not perfectly determine local IP. Usually 127.0.0.1 or check your Wi-Fi settings."
    LOCAL_IP="localhost"
fi

# 3. Start Python Server on Host
echo "🐍 Setting up Python Host environment..."
cd host_daemon
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate
pip install -r requirements.txt > /dev/null 2>&1

echo ""
echo "======================================"
echo "✅ Backend Server Running on Mac"
echo "✅ Web UI Server Running via Docker"
echo "======================================"
echo ""
echo "👉 1. On your Mac, ensure Afterplay.io is open and focused."
echo "👉 2. On your iPhone, visit this exact URL: http://$LOCAL_IP:8080"
echo "👉 3. Ensure your Mac and iPhone are on the same Wi-Fi network."
echo ""
echo "Note: MacOS may ask you to grant Terminal 'Accessibility' permissions to simulate key presses."
echo "Press Ctrl+C to stop the Python server."
echo "======================================"

python3 server.py
