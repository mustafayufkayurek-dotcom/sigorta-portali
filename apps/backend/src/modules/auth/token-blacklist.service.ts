import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';

@Injectable()
export class TokenBlacklistService {
  private client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    this.client = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    this.client.on('error', (err) => {
      console.warn('[TokenBlacklist] Redis error:', err.message);
    });
  }

  private key(token: string): string {
    const hash = createHash('sha256').update(token).digest('hex').substring(0, 16);
    return `bl:${hash}`;
  }

  async blacklist(token: string, ttlSeconds: number): Promise<void> {
    if (process.env.JWT_BLACKLIST_ENABLED === 'false') return;
    if (!token || ttlSeconds <= 0) return;
    await this.client.set(this.key(token), '1', 'EX', ttlSeconds);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    if (process.env.JWT_BLACKLIST_ENABLED === 'false') return false;
    if (!token) return false;
    try {
      const value = await this.client.get(this.key(token));
      return value === '1';
    } catch (err: unknown) {
      console.warn('[TokenBlacklist] Redis check failed:', (err as Error).message);
      return false; // Redis bağlanamazsa geçir (fail-open)
    }
  }
}