# Getting Started with Chat System

This guide will help you get the chat system up and running on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- **pnpm** >= 8.0.0 (Install: `npm install -g pnpm`)
- **Docker** and **Docker Compose** ([Download](https://www.docker.com/))

## Quick Start (Automated)

The easiest way to get started is using the setup script:

```bash
# Make the script executable
chmod +x scripts/setup.sh

# Run the setup script
./scripts/setup.sh
```

This script will:
1. Check prerequisites
2. Install dependencies
3. Create `.env` file
4. Start Docker services
5. Generate Prisma client
6. Run database migrations

## Manual Setup

If you prefer to set up manually:

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your preferred editor
# Update any values as needed
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and Kafka
pnpm docker:up

# Verify services are running
docker-compose ps
```

You should see:
- `chat-postgres` - PostgreSQL database
- `chat-redis` - Redis cache
- `chat-redpanda` - Kafka-compatible message broker
- `chat-redpanda-console` - Web UI for Kafka

### 4. Setup Database

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate
```

When prompted for a migration name, you can use: `init`

### 5. Seed Test Data (Optional)

```bash
# Install dependencies for seed script
cd scripts && pnpm install && cd ..

# Run seed script
tsx scripts/seed-test-data.ts
```

This creates:
- Two test users (alice@example.com, bob@example.com)
- A test conversation between them
- Some test messages

Password for both users: `password123`

## Running the Application

### Start All Services

```bash
pnpm dev
```

This starts all services in development mode:
- **Web App**: http://localhost:3000
- **API Service**: http://localhost:3001
- **WebSocket Gateway**: http://localhost:4000
- **Presence Service**: http://localhost:4001
- **Inbox Worker**: (background process)

### Start Individual Services

You can also start services individually:

```bash
# Web app only
cd apps/web && pnpm dev

# API service only
cd apps/api && pnpm dev

# WebSocket gateway only
cd apps/ws-gateway && pnpm dev

# Presence service only
cd apps/presence && pnpm dev

# Inbox worker only
cd apps/inbox-worker && pnpm dev
```

## Verify Installation

### 1. Check Service Health

```bash
# API Service
curl http://localhost:3001/health

# Presence Service
curl http://localhost:4001/health
```

Both should return: `{"status":"ok","timestamp":"..."}`

### 2. Access Web Interfaces

- **Web App**: http://localhost:3000
- **Redpanda Console**: http://localhost:8080 (Kafka UI)
- **Prisma Studio**: Run `pnpm db:studio` then visit http://localhost:5555

### 3. Test API Endpoints

```bash
# Register a user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## Using the Application

### 1. Register/Login

Visit http://localhost:3000 and:
1. Click "Register" to create a new account
2. Or use test credentials:
   - Email: `alice@example.com`
   - Password: `password123`

### 2. Create a Conversation

Use the API or Prisma Studio to create conversations:

```bash
# Get your auth token from login response
TOKEN="your-jwt-token"

# Create a conversation
curl -X POST http://localhost:3001/api/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "participantIds": ["user-id-1", "user-id-2"]
  }'
```

### 3. Send Messages

```bash
# Send a message
curl -X POST http://localhost:3001/api/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-key-123" \
  -d '{
    "conversationId": "conversation-id",
    "body": "Hello, world!"
  }'
```

### 4. Connect via WebSocket

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: { token: 'your-jwt-token' }
});

// Join a conversation
socket.emit('join', { conversationId: 'conversation-id' });

// Listen for new messages
socket.on('message:new', (data) => {
  console.log('New message:', data);
});

// Send typing indicator
socket.emit('typing', {
  conversationId: 'conversation-id',
  isTyping: true
});
```

## Load Testing

### Prerequisites for Load Testing

1. Ensure all services are running
2. Create test data (users and conversations)
3. Update `tests/load/http-messages.yml` with a valid conversation ID

### Run Load Tests

```bash
# HTTP message sending test (1000 TPS)
pnpm load-test:http

# WebSocket delivery test
pnpm load-test:ws

# Run all tests
pnpm load-test:all
```

### Interpreting Results

Artillery will output:
- **Request rate**: Requests per second
- **Response time**: P50, P95, P99 latencies
- **Success rate**: Percentage of successful requests
- **Errors**: Any errors encountered

Target metrics:
- P95 latency < 100ms
- P99 latency < 200ms
- Success rate > 99%
- Sustained 1000 TPS

## Enabling Message Encryption

### 1. Generate Encryption Key

```bash
node -e "console.log('base64:' + require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Update Environment

Edit `.env`:

```bash
CHAT_ENCRYPTION_ENABLED=true
CHAT_MESSAGE_KEY="base64:YOUR_GENERATED_KEY_HERE"
```

### 3. Restart Services

```bash
# Stop all services (Ctrl+C)
# Restart
pnpm dev
```

All new messages will now be encrypted at rest in the database.

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

```bash
# Find process using port
lsof -i :3000  # or :3001, :4000, :4001

# Kill the process
kill -9 <PID>
```

### Docker Services Not Starting

```bash
# Stop all containers
pnpm docker:down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# Start fresh
pnpm docker:up
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Connect manually
psql postgresql://chatuser:chatpass@localhost:5432/chatdb
```

### Kafka Connection Issues

```bash
# Check Redpanda is running
docker-compose ps redpanda

# View logs
docker-compose logs redpanda

# Access Redpanda console
open http://localhost:8080
```

### Prisma Issues

```bash
# Reset database (WARNING: deletes data)
cd packages/database
pnpm prisma migrate reset

# Regenerate client
pnpm prisma generate
```

## Development Tips

### Viewing Logs

```bash
# Docker services
pnpm docker:logs

# Individual service logs
# Check terminal where you ran `pnpm dev`
```

### Database Management

```bash
# Open Prisma Studio
pnpm db:studio

# Create a new migration
cd packages/database
pnpm prisma migrate dev --name your_migration_name

# View database directly
psql postgresql://chatuser:chatpass@localhost:5432/chatdb
```

### Kafka Management

- Visit http://localhost:8080 for Redpanda Console
- View topics, messages, consumer groups
- Monitor lag and throughput

### Redis Management

```bash
# Connect to Redis CLI
docker exec -it chat-redis redis-cli

# View all keys
KEYS *

# Get presence data
GET presence:user-id

# Monitor commands
MONITOR
```

## Next Steps

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system design
2. Explore the codebase in `apps/` and `packages/`
3. Check out the API documentation in [README.md](./README.md)
4. Run load tests to see performance
5. Build your own features!

## Getting Help

- Check the [README.md](./README.md) for API documentation
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Look at example code in `apps/web/src/`
- Check Docker logs: `pnpm docker:logs`

## Clean Up

When you're done:

```bash
# Stop all services
# Press Ctrl+C in terminal running `pnpm dev`

# Stop Docker services
pnpm docker:down

# Remove all data (optional)
docker-compose down -v
```

