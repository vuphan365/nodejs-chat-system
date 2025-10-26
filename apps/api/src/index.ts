import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './lib/logger';
import { connectRedis } from './lib/redis';
import { connectKafka, disconnectKafka } from './lib/kafka';
import { initializeEncryptionFromEnv } from '@chat/encryption';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import messageRoutes from './routes/messages';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: { message: 'Internal server error' },
  });
});

// Startup
async function start() {
  try {
    // Initialize encryption
    initializeEncryptionFromEnv();

    // Connect to Redis
    await connectRedis();

    // Connect to Kafka
    await connectKafka();

    // Start server
    app.listen(config.port, () => {
      logger.info(`API server listening on port ${config.port}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await disconnectKafka();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await disconnectKafka();
  process.exit(0);
});

start();

