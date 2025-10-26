# Chat System - Project Summary

## Overview

A production-ready, high-performance chat system built with Node.js and Next.js 15, designed to handle 1000+ transactions per second with real-time messaging, user presence tracking, and optional message encryption.

## ✅ Implemented Features

### Core Functionality
- ✅ **Direct and Group Chat**: Support for 1-on-1 and group conversations
- ✅ **Real-time Messaging**: WebSocket-based instant message delivery
- ✅ **Offline Inbox**: Messages queued for offline users with unread counts
- ✅ **User Presence**: Online/offline status tracking with heartbeat mechanism
- ✅ **Read Receipts**: Track when messages are read by recipients
- ✅ **Typing Indicators**: Real-time typing status in conversations

### Technical Features
- ✅ **Message Encryption**: Optional AES-256-GCM encryption (toggleable via env)
- ✅ **Kafka Integration**: Event streaming for cross-service communication
- ✅ **Horizontal Scalability**: Redis adapter for WebSocket fanout across instances
- ✅ **Rate Limiting**: Redis-backed rate limiting per user/IP
- ✅ **Idempotent Operations**: Idempotency-Key support for message sending
- ✅ **Load Testing**: Artillery configs targeting 1000 TPS

### Security
- ✅ **JWT Authentication**: Secure token-based auth
- ✅ **Authorization**: Membership verification on all operations
- ✅ **Input Validation**: Zod schemas for all inputs
- ✅ **Rate Limiting**: Protection against abuse
- ✅ **Security Headers**: Helmet middleware
- ✅ **CORS Configuration**: Controlled cross-origin access

## 📁 Project Structure

```
chat-system/
├── apps/
│   ├── web/              # Next.js 15 web application
│   ├── api/              # HTTP REST API service
│   ├── ws-gateway/       # WebSocket gateway (Socket.IO)
│   ├── presence/         # User presence service
│   └── inbox-worker/     # Kafka consumer worker
├── packages/
│   ├── database/         # Prisma schema and client
│   ├── shared/           # Shared types and schemas (Zod)
│   └── encryption/       # AES-256-GCM encryption utilities
├── tests/
│   └── load/             # Artillery load test configs
├── scripts/
│   ├── setup.sh          # Automated setup script
│   └── seed-test-data.ts # Test data seeding
├── docker-compose.yml    # Infrastructure (PostgreSQL, Redis, Kafka)
├── .env.example          # Environment variables template
└── Documentation files
```

## 🛠 Technology Stack

### Frontend
- **Next.js 15**: React framework with App Router
- **React 18**: UI library
- **Tailwind CSS**: Utility-first CSS framework
- **Socket.IO Client**: WebSocket client
- **React Query**: Data fetching and caching
- **Axios**: HTTP client

### Backend Services
- **Node.js 20+**: Runtime environment
- **Express**: HTTP server framework
- **Socket.IO**: WebSocket server
- **Prisma**: Type-safe ORM
- **KafkaJS**: Kafka client
- **Redis**: Caching and pub/sub
- **JWT**: Authentication tokens
- **Bcrypt**: Password hashing
- **Zod**: Schema validation
- **Pino**: Structured logging

### Infrastructure
- **PostgreSQL 16**: Primary database
- **Redis 7**: Cache, presence, rate limiting
- **Redpanda**: Kafka-compatible event streaming
- **Docker Compose**: Local development environment

### Development Tools
- **TypeScript**: Type safety
- **Turbo**: Monorepo build system
- **pnpm**: Package manager
- **Artillery**: Load testing
- **Prisma Studio**: Database GUI

## 🚀 Key Capabilities

### Performance
- **1000+ TPS**: Designed and tested for high throughput
- **Low Latency**: P95 < 100ms, P99 < 200ms target
- **10,000+ Connections**: Concurrent WebSocket support
- **Horizontal Scaling**: Stateless services with Redis adapter

### Reliability
- **Idempotent Operations**: Prevent duplicate messages
- **Event Sourcing**: Kafka for audit trail and integration
- **Graceful Degradation**: Offline inbox for disconnected users
- **Error Handling**: Comprehensive error handling and logging

### Security
- **Authentication**: JWT-based with configurable expiry
- **Authorization**: Role-based access control
- **Encryption**: Optional at-rest message encryption
- **Rate Limiting**: Configurable per-endpoint limits
- **Input Validation**: All inputs validated with Zod

## 📊 Database Schema

### Core Tables
- **users**: User accounts with credentials
- **conversations**: Chat conversations (direct/group)
- **participants**: Conversation membership
- **messages**: Chat messages with optional encryption
- **read_receipts**: Message read tracking
- **inboxes**: Per-user unread counts and last activity

### Indexes
Optimized indexes on:
- User lookups (email, username)
- Message queries (conversationId + createdAt)
- Inbox queries (userId + lastActivity)
- Read receipts (messageId + userId)

## 🔄 Event Flow

### Message Send
1. Client → HTTP POST `/api/messages`
2. API validates auth and membership
3. API encrypts message (if enabled)
4. API persists to PostgreSQL
5. API updates inbox for recipients
6. API publishes to Kafka
7. WebSocket Gateway consumes event
8. WebSocket broadcasts to conversation room
9. Clients receive real-time update

### Presence Tracking
1. Client sends heartbeat every 15-30s
2. Presence service sets Redis key with TTL
3. On status change, publish to Kafka
4. WebSocket Gateway broadcasts to clients
5. Background job detects expired keys

## 🧪 Load Testing

### HTTP Test
- **Target**: 1000 messages/second
- **Duration**: 2 minutes sustained load
- **Metrics**: Latency, throughput, error rate

### WebSocket Test
- **Target**: 500+ concurrent connections
- **Duration**: 2 minutes
- **Metrics**: Connection stability, delivery latency

### Running Tests
```bash
pnpm load-test:http    # HTTP message sending
pnpm load-test:ws      # WebSocket delivery
pnpm load-test:all     # All tests
```

## 🔐 Encryption

### Configuration
```bash
CHAT_ENCRYPTION_ENABLED=true
CHAT_MESSAGE_KEY="base64:..." # 32 bytes
```

### Features
- **Algorithm**: AES-256-GCM
- **Key Rotation**: Supported via keyVersion field
- **Scope**: Application-level (not E2E)
- **Toggle**: Enable/disable without migration

## 📈 Scalability

### Horizontal Scaling
- **API Service**: Stateless, scale behind load balancer
- **WebSocket Gateway**: Redis adapter for cross-instance fanout
- **Presence Service**: Stateless, shared Redis state
- **Database**: Connection pooling, read replicas

### Performance Optimizations
- Database indexes on hot paths
- Redis caching for membership checks
- Kafka batching and compression
- Connection pooling (Prisma, Redis)
- Batch inbox updates

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_URL="postgresql://..."

# Redis
REDIS_URL="redis://localhost:6379"

# Kafka
KAFKA_BROKERS="localhost:19092"

# Encryption
CHAT_ENCRYPTION_ENABLED=false
CHAT_MESSAGE_KEY="base64:..."

# Auth
JWT_SECRET="your-secret"
NEXTAUTH_SECRET="your-secret"

# Ports
API_PORT=3001
WS_PORT=4000
PRESENCE_PORT=4001
```

## 📚 Documentation

- **README.md**: Quick start and API reference
- **GETTING_STARTED.md**: Detailed setup guide
- **ARCHITECTURE.md**: System design and architecture
- **PROJECT_SUMMARY.md**: This file

## 🎯 Use Cases

### Supported
- Direct messaging between users
- Group chat with multiple participants
- Real-time message delivery
- Offline message queuing
- User presence tracking
- Read receipts and typing indicators
- Message encryption at rest

### Future Enhancements
- File attachments (S3 integration)
- End-to-end encryption
- Push notifications
- Message search (Elasticsearch)
- Voice/Video calls (WebRTC)
- Message reactions
- User blocking and moderation

## 🚦 Getting Started

### Quick Start
```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure
pnpm docker:up

# 3. Setup database
pnpm db:generate
pnpm db:migrate

# 4. Start all services
pnpm dev
```

### Access Points
- Web App: http://localhost:3000
- API: http://localhost:3001
- WebSocket: ws://localhost:4000
- Presence: http://localhost:4001
- Redpanda Console: http://localhost:8080

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login

### Conversations
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation
- `PATCH /api/conversations/:id` - Update conversation

### Messages
- `GET /api/messages` - Get messages (paginated)
- `POST /api/messages` - Send message
- `POST /api/messages/read` - Mark as read

### Presence
- `POST /heartbeat` - Update presence
- `GET /status/:userId` - Get user status
- `POST /status/batch` - Batch status check

## 🎨 WebSocket Events

### Client → Server
- `join` - Join conversation
- `leave` - Leave conversation
- `typing` - Typing indicator

### Server → Client
- `message:new` - New message
- `typing` - User typing
- `read:receipt` - Message read
- `presence` - User status change

## 🔍 Monitoring

### Health Checks
- `/health` on all HTTP services
- Returns: `{"status":"ok","timestamp":"..."}`

### Logging
- Structured JSON logs (Pino)
- Log levels: debug, info, warn, error
- Request/response logging
- Error stack traces

### Metrics (Future)
- Message throughput
- WebSocket connections
- API latency percentiles
- Database query performance
- Kafka consumer lag

## 🤝 Contributing

This is a learning project demonstrating:
- Microservices architecture
- Real-time communication
- Event-driven design
- High-performance systems
- Security best practices

## 📄 License

ISC

## 🙏 Acknowledgments

Based on concepts from distributed systems design and real-time messaging architectures, following industry best practices for scalability, security, and performance.

