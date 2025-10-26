# Quick Start Guide

Get the Chat System up and running in 5 minutes!

## Prerequisites

Make sure you have installed:
- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker and Docker Compose

## Step 1: Install Dependencies

```bash
pnpm install
```

## Step 2: Setup Environment

```bash
# Copy environment file
cp .env.example .env

# The default values work for local development
# No need to change anything unless you want to customize
```

## Step 3: Start Infrastructure

```bash
# Start PostgreSQL, Redis, and Kafka
docker-compose up -d

# Wait 10 seconds for services to be ready
sleep 10
```

## Step 4: Setup Database

```bash
# Generate Prisma client
cd packages/database && pnpm prisma generate && cd ../..

# Run migrations
cd packages/database && pnpm prisma migrate dev --name init && cd ../..
```

## Step 5: Seed Test Data (Optional but Recommended)

```bash
# Install dependencies for seed script
cd scripts && pnpm install && cd ..

# Run seed script to create test users
npx tsx scripts/seed-test-data.ts
```

This creates two test users:
- **alice@example.com** / password123
- **bob@example.com** / password123

## Step 6: Start All Services

```bash
# Start all services in development mode
   sudo lsof -i :3000
```

This starts:
- ✅ Next.js web app on http://localhost:3000
- ✅ API service on http://localhost:3001
- ✅ WebSocket gateway on http://localhost:4000
- ✅ Presence service on http://localhost:4001
- ✅ Inbox worker (background)

## Step 7: Open the App

Open your browser and go to:
```
http://localhost:3000
```

## Test the App

### Option 1: Use Test Accounts

1. Click **Login**
2. Use credentials:
   - Email: `alice@example.com`
   - Password: `password123`
3. Open another browser (or incognito window)
4. Login as `bob@example.com` / `password123`
5. Create a conversation between Alice and Bob
6. Start chatting!

### Option 2: Create New Accounts

1. Click **Register**
2. Fill in your details
3. Create account
4. Repeat in another browser for a second user
5. Create a conversation
6. Start chatting!

## Verify Everything Works

### Check Services Health

```bash
# API Service
curl http://localhost:3001/health

# Presence Service
curl http://localhost:4001/health
```

Both should return: `{"status":"ok","timestamp":"..."}`

### Check WebSocket Connection

In the web app:
- Look for a **green dot** in the chat interface
- This means WebSocket is connected

### Check Database

```bash
# Open Prisma Studio
cd packages/database && pnpm prisma studio
```

Visit http://localhost:5555 to browse your database.

### Check Kafka

Visit http://localhost:8080 for Redpanda Console to see Kafka topics and messages.

## Common Issues

### Port Already in Use

If you get "port already in use" errors:

```bash
# Find and kill the process
lsof -i :3000  # or :3001, :4000, :4001
kill -9 <PID>
```

### Docker Services Not Starting

```bash
# Stop and remove everything
docker-compose down -v

# Start fresh
docker-compose up -d
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Prisma Client Not Generated

```bash
# Regenerate Prisma client
cd packages/database
pnpm prisma generate
cd ../..
```

## Next Steps

### 1. Explore the Features

- ✅ Send real-time messages
- ✅ Create group chats
- ✅ See typing indicators
- ✅ View online/offline status
- ✅ Check unread message counts

### 2. Read the Documentation

- **WEB_APP_GUIDE.md** - How to use the web interface
- **ARCHITECTURE.md** - System design and architecture
- **README.md** - Complete project documentation
- **GETTING_STARTED.md** - Detailed setup guide

### 3. Run Load Tests

```bash
# Test HTTP message sending (1000 TPS)
pnpm load-test:http

# Test WebSocket delivery
pnpm load-test:ws
```

### 4. Enable Message Encryption

```bash
# Generate encryption key
node -e "console.log('base64:' + require('crypto').randomBytes(32).toString('base64'))"

# Update .env
CHAT_ENCRYPTION_ENABLED=true
CHAT_MESSAGE_KEY="base64:YOUR_KEY_HERE"

# Restart services
# Press Ctrl+C to stop, then run `pnpm dev` again
```

### 5. Customize the App

The codebase is well-organized and easy to modify:

```
apps/
├── web/              # Next.js frontend
│   ├── src/app/      # Pages
│   └── src/components/ # React components
├── api/              # HTTP API
├── ws-gateway/       # WebSocket server
├── presence/         # Presence tracking
└── inbox-worker/     # Background worker
```

## Development Workflow

### Making Changes

1. Edit files in `apps/web/src/` for frontend changes
2. Edit files in `apps/api/src/` for backend changes
3. Changes auto-reload (hot reload enabled)

### Viewing Logs

All service logs appear in the terminal where you ran `pnpm dev`.

### Database Changes

```bash
# Create a new migration
cd packages/database
pnpm prisma migrate dev --name your_migration_name
cd ../..
```

### Stopping Services

```bash
# Stop all Node.js services
# Press Ctrl+C in the terminal running `pnpm dev`

# Stop Docker services
docker-compose down
```

## Production Deployment

For production deployment:

1. Set proper environment variables
2. Use a managed PostgreSQL database
3. Use a managed Redis instance
4. Use a managed Kafka cluster (or Confluent Cloud)
5. Deploy services to your hosting platform
6. Enable HTTPS/WSS
7. Set up monitoring and logging

See `README.md` for more details on production deployment.

## Getting Help

- Check browser console (F12) for frontend errors
- Check terminal logs for backend errors
- Review documentation files
- Check Docker logs: `docker-compose logs`

## Summary

You should now have:
- ✅ All services running
- ✅ Database setup with test data
- ✅ Web app accessible at http://localhost:3000
- ✅ Real-time chat working
- ✅ WebSocket connection active

**Enjoy your high-performance chat system! 🚀**

