# Chat System Architecture

## Overview

This document describes the architecture of the high-performance chat system built with Node.js and Next.js 15.

## System Design

### Core Principles

1. **Write via HTTP, Deliver via WebSocket**: Messages are sent through HTTP API for reliability and idempotency, then delivered to recipients via WebSocket for real-time updates.

2. **Event-Driven Architecture**: Kafka is used as the event backbone for cross-service communication and integration with external systems.

3. **Inbox Pattern**: Each user has an inbox that tracks unread messages and last activity per conversation, enabling offline message delivery.

4. **Presence Service**: Dedicated service tracks user online/offline status using heartbeat mechanism with Redis TTL.

5. **Horizontal Scalability**: Services are stateless and can scale horizontally. WebSocket gateway uses Redis adapter for cross-instance communication.

## Service Architecture

### 1. Web App (Next.js 15)

**Technology**: Next.js 15, React 18, Tailwind CSS, Socket.IO Client

**Responsibilities**:
- User interface for chat
- Authentication UI
- Real-time message display
- WebSocket connection management
- Optimistic UI updates

**Key Features**:
- Server Components for initial data loading
- Client Components for interactive chat
- React Query for data fetching and caching
- Socket.IO client for WebSocket connection

### 2. API Service

**Technology**: Express, Prisma, Kafka, Redis, JWT

**Responsibilities**:
- HTTP REST API for chat operations
- Authentication and authorization
- Message persistence
- Conversation management
- Kafka event publishing
- Rate limiting

**Endpoints**:
- `/api/auth/*` - Authentication
- `/api/conversations/*` - Conversation CRUD
- `/api/messages/*` - Message operations

**Key Features**:
- JWT-based authentication
- Redis-backed rate limiting
- Idempotent message creation
- Kafka event publishing on write operations
- Optional message encryption

### 3. WebSocket Gateway

**Technology**: Socket.IO, Redis Adapter, Kafka Consumer

**Responsibilities**:
- WebSocket connection management
- Real-time message delivery
- Typing indicators
- Read receipts
- Presence broadcasting

**Key Features**:
- Redis adapter for horizontal scaling
- JWT authentication on connection
- Room-based message delivery
- Kafka consumer for message events
- Automatic reconnection handling

**Events**:
- Client → Server: `join`, `leave`, `typing`
- Server → Client: `message:new`, `typing`, `read:receipt`, `presence`

### 4. Presence Service

**Technology**: Express, Redis, Kafka Producer

**Responsibilities**:
- User online/offline status tracking
- Heartbeat processing
- Presence event publishing

**Key Features**:
- Redis TTL-based presence tracking
- Heartbeat endpoint (30s TTL)
- Batch status queries
- Kafka event publishing on status changes

**Endpoints**:
- `POST /heartbeat` - Update user presence
- `GET /status/:userId` - Get user status
- `POST /status/batch` - Get multiple users' status

### 5. Inbox Worker

**Technology**: Kafka Consumer, Prisma

**Responsibilities**:
- Process Kafka events
- Update inbox unread counts (handled in API for now)
- Future: Push notifications, webhooks, analytics

**Key Features**:
- Kafka consumer group for parallel processing
- Idempotent event processing
- Error handling and retry logic

## Data Model

### Core Entities

```prisma
User
├── id: String (CUID)
├── email: String (unique)
├── username: String (unique)
├── passwordHash: String
└── timestamps

Conversation
├── id: String (CUID)
├── type: String ('direct' | 'group')
├── name: String? (for groups)
└── timestamps

Participant
├── conversationId: String
├── userId: String
├── role: String ('admin' | 'member')
└── joinedAt: DateTime

Message
├── id: String (CUID)
├── conversationId: String
├── senderId: String
├── body: String (plaintext or ciphertext)
├── encrypted: Boolean
├── keyVersion: Int?
├── iv: String?
├── authTag: String?
└── timestamps

ReadReceipt
├── id: String (CUID)
├── messageId: String
├── userId: String
└── readAt: DateTime

Inbox
├── userId: String
├── conversationId: String
├── unreadCount: Int
├── lastMessageId: String?
└── lastActivity: DateTime
```

### Indexes

- `User`: email, username
- `Conversation`: type, createdAt
- `Participant`: userId, conversationId
- `Message`: (conversationId, createdAt), (senderId, createdAt)
- `ReadReceipt`: (messageId, userId), userId
- `Inbox`: (userId, lastActivity), conversationId

## Event Flow

### Message Send Flow

1. Client sends HTTP POST to `/api/messages` with Idempotency-Key
2. API validates auth and membership
3. API encrypts message (if enabled)
4. API persists message to PostgreSQL
5. API updates conversation timestamp
6. API updates inbox for all participants (except sender)
7. API publishes `message.created` event to Kafka
8. API returns success response
9. Kafka event consumed by WebSocket Gateway
10. WebSocket Gateway broadcasts `message:new` to conversation room
11. Connected clients receive real-time update

### Presence Flow

1. Client sends heartbeat to Presence Service every 15-30s
2. Presence Service sets Redis key with 30s TTL
3. If user was offline, publish `presence.user.changed` event to Kafka
4. Background job checks for expired keys every 10s
5. On expiry, publish offline event to Kafka
6. WebSocket Gateway broadcasts presence updates to clients

### Read Receipt Flow

1. Client sends HTTP POST to `/api/messages/read`
2. API creates/updates ReadReceipt record
3. API decrements inbox unread count
4. API publishes `message.read` event to Kafka
5. WebSocket Gateway broadcasts `read:receipt` to conversation room

## Scalability

### Horizontal Scaling

**API Service**:
- Stateless, can scale to N instances
- Load balancer distributes requests
- Shared Redis for rate limiting
- Shared Kafka for event publishing

**WebSocket Gateway**:
- Redis adapter enables cross-instance communication
- Sticky sessions optional but not required
- Each instance subscribes to Kafka topics
- Room-based broadcasting works across instances

**Presence Service**:
- Stateless, can scale to N instances
- Shared Redis for presence data
- Load balancer distributes heartbeats

**Database**:
- Connection pooling (Prisma)
- Read replicas for queries
- Partitioning by conversationId for messages
- Denormalized inbox for fast queries

### Performance Optimizations

1. **Database**:
   - Indexes on frequently queried fields
   - Batch inbox updates
   - Connection pooling
   - Prepared statements (Prisma)

2. **Caching**:
   - Redis cache for conversation membership
   - Redis cache for user presence
   - Client-side caching with React Query

3. **Messaging**:
   - Kafka batching (linger.ms)
   - Kafka compression (lz4/snappy)
   - Small JSON payloads
   - Binary protocols for high throughput (future)

4. **WebSocket**:
   - Disable compression for small messages
   - Binary frames for large payloads
   - Room-based broadcasting
   - Connection pooling

## Security

### Authentication & Authorization

- JWT-based authentication
- Token validation on every request
- WebSocket authentication on handshake
- Membership verification on every operation

### Input Validation

- Zod schemas for all inputs
- Payload size limits
- HTML sanitization (client-side rendering)
- SQL injection protection (Prisma)

### Rate Limiting

- Redis-backed sliding window
- Per-user and per-IP limits
- Different limits for different endpoints
- 429 responses with Retry-After header

### Encryption

- Optional AES-256-GCM message encryption
- Application-level encryption (not E2E)
- Key rotation support via keyVersion
- Secure key storage in environment variables

### Transport Security

- HTTPS/WSS in production
- Secure cookies
- CORS configuration
- Helmet middleware for security headers

## Monitoring & Observability

### Logging

- Pino for structured logging
- Log levels: debug, info, warn, error
- Request/response logging
- Error stack traces

### Metrics (Future)

- Message throughput (TPS)
- WebSocket connection count
- API latency (P50, P95, P99)
- Database query performance
- Kafka lag

### Health Checks

- `/health` endpoints on all services
- Database connectivity check
- Redis connectivity check
- Kafka connectivity check

## Load Testing

### Artillery Configuration

**HTTP Test**:
- Ramp up to 1000 requests/second
- Sustained load for 2 minutes
- Measures message send throughput

**WebSocket Test**:
- Connect 500+ concurrent clients
- Maintain connections for 2 minutes
- Measures delivery latency

### Performance Targets

- **Throughput**: 1000 messages/second
- **Latency**: P95 < 100ms, P99 < 200ms
- **Connections**: 10,000+ concurrent WebSocket connections
- **Availability**: 99.9% uptime

## Future Enhancements

1. **End-to-End Encryption**: Client-side encryption with key exchange
2. **File Attachments**: S3 integration with presigned URLs
3. **Push Notifications**: Web Push and mobile push
4. **Search**: Elasticsearch for message search
5. **Voice/Video**: WebRTC integration
6. **Moderation**: Content filtering and user blocking
7. **Analytics**: Message analytics and user engagement metrics
8. **Multi-tenancy**: Organization/workspace support

