import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { createClient } from 'redis';
import { Kafka, Producer } from 'kafkajs';
import jwt from 'jsonwebtoken';
import pino from 'pino';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: parseInt(process.env.PRESENCE_PORT || '4001', 10),
  redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
    clientId: 'chat-presence',
  },
  jwt: { secret: process.env.JWT_SECRET || 'your-secret-key-change-this' },
  heartbeatTTL: 30, // seconds
};

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const app = express();
const redisClient = createClient({ url: config.redis.url });
const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
});

let producer: Producer;

// Middleware
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Auth middleware
function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: { message: 'Invalid token' } });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Heartbeat endpoint
app.post('/heartbeat', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const key = `presence:${userId}`;

    // Check if user was offline
    const wasOnline = await redisClient.exists(key);

    // Set presence with TTL
    await redisClient.setEx(key, config.heartbeatTTL, 'online');

    // If user just came online, publish event
    if (!wasOnline) {
      await producer.send({
        topic: 'presence.user.changed',
        messages: [
          {
            key: userId,
            value: JSON.stringify({
              type: 'presence.user.changed',
              data: {
                userId,
                status: 'online',
                timestamp: new Date().toISOString(),
              },
            }),
          },
        ],
      });

      logger.info({ userId }, 'User came online');
    }

    res.json({ success: true, data: { status: 'online' } });
  } catch (error: any) {
    logger.error({ error }, 'Heartbeat error');
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get user presence
app.get('/status/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const key = `presence:${userId}`;

    const exists = await redisClient.exists(key);
    const status = exists ? 'online' : 'offline';

    res.json({ success: true, data: { userId, status } });
  } catch (error: any) {
    logger.error({ error }, 'Get status error');
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get multiple users' presence
app.post('/status/batch', authMiddleware, async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ success: false, error: { message: 'userIds must be an array' } });
    }

    const statuses = await Promise.all(
      userIds.map(async (userId) => {
        const key = `presence:${userId}`;
        const exists = await redisClient.exists(key);
        return {
          userId,
          status: exists ? 'online' : 'offline',
        };
      })
    );

    res.json({ success: true, data: statuses });
  } catch (error: any) {
    logger.error({ error }, 'Batch status error');
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Background job to detect offline users
async function checkOfflineUsers() {
  try {
    const keys = await redisClient.keys('presence:*');

    for (const key of keys) {
      const ttl = await redisClient.ttl(key);

      // If TTL is -2, key doesn't exist (expired)
      if (ttl === -2) {
        const userId = key.replace('presence:', '');

        // Publish offline event
        await producer.send({
          topic: 'presence.user.changed',
          messages: [
            {
              key: userId,
              value: JSON.stringify({
                type: 'presence.user.changed',
                data: {
                  userId,
                  status: 'offline',
                  timestamp: new Date().toISOString(),
                },
              }),
            },
          ],
        });

        logger.info({ userId }, 'User went offline');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Error checking offline users');
  }
}

// Startup
async function start() {
  try {
    // Connect Redis
    await redisClient.connect();
    logger.info('Redis client connected');

    // Connect Kafka
    producer = kafka.producer();
    await producer.connect();
    logger.info('Kafka producer connected');

    // Start offline check interval
    setInterval(checkOfflineUsers, 10000); // Check every 10 seconds

    // Start server
    app.listen(config.port, () => {
      logger.info(`Presence service listening on port ${config.port}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start presence service');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await producer.disconnect();
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await producer.disconnect();
  await redisClient.quit();
  process.exit(0);
});

start();

