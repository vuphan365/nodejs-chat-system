#!/bin/bash

set -e

echo "🚀 Setting up Chat System..."

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 20.0.0"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration"
fi

# Start Docker services
echo "🐳 Starting Docker services..."
docker compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Generate Prisma client
echo "🔧 Generating Prisma client..."
cd packages/database && pnpm prisma generate && cd ../..

# Run database migrations
echo "🗄️  Running database migrations..."
cd packages/database && pnpm prisma migrate dev --name init && cd ../..

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your configuration (if needed)"
echo "2. Run 'pnpm dev' to start all services"
echo "3. Visit http://localhost:3000 for the web app"
echo "4. Visit http://localhost:8080 for Redpanda Console"
echo ""
echo "For load testing:"
echo "- Run 'pnpm load-test:http' for HTTP tests"
echo "- Run 'pnpm load-test:ws' for WebSocket tests"

