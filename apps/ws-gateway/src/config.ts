import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.WS_PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
    clientId: 'chat-ws-gateway',
    groupId: 'ws-gateway-group',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
  },
};

