# High-Performance Chat System

A scalable, high-throughput chat system built with Node.js and Next.js 15, designed to handle 1000+ TPS with real-time messaging, presence tracking, and optional message encryption.

## Architecture

### Services

- **Web App** (Next.js 15): User interface with Tailwind CSS
- **API Service**: HTTP REST API for chat operations with Kafka integration
- **WebSocket Gateway**: Real-time message delivery using Socket.IO with Redis adapter
- **Presence Service**: User online/offline status tracking with heartbeat mechanism
- **Inbox Worker**: Background worker for processing Kafka events

### Infrastructure

- **PostgreSQL**: Primary database for persistent chat data
- **Redis**: Caching, presence tracking, rate limiting, and WebSocket pub/sub
- **Kafka (Redpanda)**: Event streaming for cross-service communication
- **Prisma**: Type-safe database ORM

### Key Features

- ✅ Direct and group chat support
- ✅ Real-time message delivery via WebSocket
- ✅ Offline message inbox with unread counts
- ✅ User presence tracking (online/offline)
- ✅ Optional AES-256-GCM message encryption (toggleable)
- ✅ Kafka event streaming for service integration
- ✅ Rate limiting and security hardening
- ✅ Horizontal scalability with Redis adapter
- ✅ Load testing setup targeting 1000 TPS

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker and Docker Compose

## Quick Start

### 1. Clone and Install

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and Kafka
pnpm docker:up

# Wait for services to be healthy (check with docker ps)
```

### 3. Setup Database

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate
```

### 4. Start Services

```bash
# Start all services in development mode
pnpm dev
```

This will start:
- Next.js web app on http://localhost:3000
- API service on http://localhost:3001
- WebSocket gateway on http://localhost:4000
- Presence service on http://localhost:4001
- Inbox worker (background)

### 5. Access Services

- **Web App**: http://localhost:3000
- **API Health**: http://localhost:3001/health
- **WebSocket**: ws://localhost:4000
- **Presence API**: http://localhost:4001/health
- **Redpanda Console**: http://localhost:8080
- **Prisma Studio**: `pnpm db:studio`

## Environment Variables

Key environment variables (see `.env.example`):

```bash
# Database
DATABASE_URL="postgresql://chatuser:chatpass@localhost:5432/chatdb"

# Redis
REDIS_URL="redis://localhost:6379"

# Kafka
KAFKA_BROKERS="localhost:19092"

# Encryption (toggle)
CHAT_ENCRYPTION_ENABLED=false
CHAT_MESSAGE_KEY="base64:..." # 32 bytes base64-encoded

# Auth
JWT_SECRET="your-secret-key-change-this"
```

## Load Testing

### Prerequisites

The load tests require:
1. Running infrastructure (PostgreSQL, Redis, Kafka)
2. Running API and WebSocket services
3. A test conversation created in the database

### Setup Test Data

```bash
# Create a test user and conversation
# You can use Prisma Studio or the API endpoints
pnpm db:studio
```

### Run Load Tests

```bash
# HTTP message sending test (1000 TPS)
pnpm load-test:http

# WebSocket delivery test
pnpm load-test:ws

# Run all tests
pnpm load-test:all
```

### Load Test Configuration

- **HTTP Test**: Ramps up to 1000 requests/second for message sending
- **WS Test**: Connects 500+ concurrent WebSocket clients
- **Duration**: 2-4 minutes per test
- **Reports**: Generated in `artillery-reports/` directory

### Performance Targets

- **Throughput**: 1000 messages/second
- **Latency**: P95 < 100ms, P99 < 200ms
- **Concurrent Connections**: 10,000+ WebSocket connections
- **Database**: Optimized with indexes on conversation and message queries

## Message Encryption

### Enable Encryption

1. Generate a 32-byte encryption key:

```bash
node -e "console.log('base64:' + require('crypto').randomBytes(32).toString('base64'))"
```

2. Update `.env`:

```bash
CHAT_ENCRYPTION_ENABLED=true
CHAT_MESSAGE_KEY="base64:YOUR_GENERATED_KEY"
```

3. Restart services

### How It Works

- **Algorithm**: AES-256-GCM
- **Storage**: Ciphertext, IV, and auth tag stored in database
- **Key Rotation**: Supported via `keyVersion` field
- **Scope**: Application-level encryption (not end-to-end)
- **Toggle**: Can be enabled/disabled without data migration

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token

### Conversations

- `GET /api/conversations` - List user's conversations
- `GET /api/conversations/:id` - Get conversation details
- `POST /api/conversations` - Create new conversation
- `PATCH /api/conversations/:id` - Update conversation

### Messages

- `GET /api/messages?conversationId=...` - Get messages (paginated)
- `POST /api/messages` - Send message (with Idempotency-Key header)
- `POST /api/messages/read` - Mark message as read

### Presence

- `POST /heartbeat` - Send heartbeat (requires auth)
- `GET /status/:userId` - Get user status
- `POST /status/batch` - Get multiple users' status

## WebSocket Events

### Client → Server

- `join` - Join conversation room
- `leave` - Leave conversation room
- `typing` - Send typing indicator

### Server → Client

- `message:new` - New message in conversation
- `typing` - User typing indicator
- `read:receipt` - Message read receipt
- `presence` - User online/offline status
- `error` - Error message

## Kafka Topics

- `chat.message.created` - New message events
- `chat.message.read` - Read receipt events
- `chat.conversation.updated` - Conversation update events
- `presence.user.changed` - User presence change events

## Development

### Project Structure

```
chat-system/
├── apps/
│   ├── web/              # Next.js 15 web app
│   ├── api/              # HTTP API service
│   ├── ws-gateway/       # WebSocket gateway
│   ├── presence/         # Presence service
│   └── inbox-worker/     # Kafka consumer worker
├── packages/
│   ├── database/         # Prisma schema and client
│   ├── shared/           # Shared types and schemas
│   └── encryption/       # Encryption utilities
└── tests/
    └── load/             # Artillery load tests
```

### Commands

```bash
# Development
pnpm dev                  # Start all services
pnpm build                # Build all services
pnpm lint                 # Lint all services

# Database
pnpm db:generate          # Generate Prisma client
pnpm db:migrate           # Run migrations
pnpm db:studio            # Open Prisma Studio

# Docker
pnpm docker:up            # Start infrastructure
pnpm docker:down          # Stop infrastructure
pnpm docker:logs          # View logs

# Load Testing
pnpm load-test:http       # HTTP load test
pnpm load-test:ws         # WebSocket load test
pnpm load-test:all        # All load tests
```

## Security Features

- JWT-based authentication
- Rate limiting (Redis-backed)
- Input validation with Zod
- SQL injection protection (Prisma)
- CORS and Helmet middleware
- Optional message encryption
- Secure WebSocket authentication

## Scaling Considerations

### Horizontal Scaling

- **API Service**: Stateless, can scale horizontally behind load balancer
- **WebSocket Gateway**: Uses Redis adapter for cross-instance communication
- **Presence Service**: Stateless, can scale horizontally
- **Database**: Use read replicas for queries, connection pooling

### Performance Optimization

- Database indexes on frequently queried fields
- Redis caching for conversation membership
- Kafka for async processing
- Connection pooling (Prisma, Redis)
- Batch operations for inbox updates

## Troubleshooting

### Services won't start

```bash
# Check if ports are available
lsof -i :3000 -i :3001 -i :4000 -i :4001

# Check Docker services
docker-compose ps

# View logs
pnpm docker:logs
```

### Database connection issues

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check connection
psql postgresql://chatuser:chatpass@localhost:5432/chatdb
```

### Kafka connection issues

```bash
# Check Redpanda is healthy
docker-compose ps redpanda

# View Redpanda console
open http://localhost:8080
```

## License

ISC

