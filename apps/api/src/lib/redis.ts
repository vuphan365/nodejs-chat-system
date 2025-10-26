import { createClient } from 'redis';
import { config } from '../config';
import { logger } from './logger';

export const redisClient = createClient({
  url: config.redis.url,
});

redisClient.on('error', (err) => logger.error({ err }, 'Redis client error'));
redisClient.on('connect', () => logger.info('Redis client connected'));

export async function connectRedis() {
  await redisClient.connect();
}

