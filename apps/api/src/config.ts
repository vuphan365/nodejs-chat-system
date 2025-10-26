import dotenv from 'dotenv';
import path from 'path';

// Load .env from the monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.API_PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL!,
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
    clientId: 'chat-api',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
    expiresIn: '7d',
  },
  
  encryption: {
    enabled: process.env.CHAT_ENCRYPTION_ENABLED === 'true',
    key: process.env.CHAT_MESSAGE_KEY || '',
  },
  
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
  },
};

