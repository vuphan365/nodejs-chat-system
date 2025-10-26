import rateLimit from 'express-rate-limit';
import { redisClient } from '../lib/redis';
import { config } from '../config';

// Redis-backed rate limiter store
class RedisStore {
  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const now = Date.now();
    const windowStart = now - config.rateLimit.windowMs;
    
    // Use sorted set to track requests in time window
    const multi = redisClient.multi();
    
    // Remove old entries
    multi.zRemRangeByScore(key, 0, windowStart);
    
    // Add current request
    multi.zAdd(key, { score: now, value: `${now}` });
    
    // Count requests in window
    multi.zCard(key);
    
    // Set expiry
    multi.expire(key, Math.ceil(config.rateLimit.windowMs / 1000));
    
    const results = await multi.exec();
    const totalHits = (results?.[2] as number) || 0;
    
    return {
      totalHits,
      resetTime: new Date(now + config.rateLimit.windowMs),
    };
  }

  async decrement(key: string): Promise<void> {
    // Not needed for our use case
  }

  async resetKey(key: string): Promise<void> {
    await redisClient.del(key);
  }
}

export const createRateLimiter = (options?: { max?: number; windowMs?: number }) => {
  return rateLimit({
    windowMs: options?.windowMs || config.rateLimit.windowMs,
    max: options?.max || config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore() as any,
    keyGenerator: (req) => {
      // Rate limit by user ID if authenticated, otherwise by IP
      const user = (req as any).user;
      return user ? `rate:user:${user.id}` : `rate:ip:${req.ip}`;
    },
  });
};

export const messageRateLimiter = createRateLimiter({ max: 60, windowMs: 60000 }); // 60 messages per minute
export const authRateLimiter = createRateLimiter({ max: 5, windowMs: 60000 }); // 5 auth attempts per minute

