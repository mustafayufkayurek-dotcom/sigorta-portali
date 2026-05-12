import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { CACHE_KEY_PREFIX, CACHE_SCAN_COUNT } from './cache.constants';
import type { CacheKeyParts } from './cache.types';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;
  private stats = new Map<string, { hits: number; misses: number }>();

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    this.client.on('error', (err) => {
      console.warn('[CacheService] Redis error:', err.message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error: unknown) {
      console.warn('[CacheService] Redis quit failed:', (error as Error)?.message || 'Unknown error');
    }
  }

  isEnabled(): boolean {
    return process.env.CACHE_ENABLED === 'true';
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled()) return null;
    try {
      const value = await this.client.get(key);
      this.recordGetStat(key, value !== null);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error: unknown) {
      console.warn('[CacheService] GET failed:', (error as Error)?.message || 'Unknown error');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error: unknown) {
      console.warn('[CacheService] SET failed:', (error as Error)?.message || 'Unknown error');
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      await this.client.del(key);
    } catch (error: unknown) {
      console.warn('[CacheService] DEL failed:', (error as Error)?.message || 'Unknown error');
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled()) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error: unknown) {
      console.warn('[CacheService] EXISTS failed:', (error as Error)?.message || 'Unknown error');
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.isEnabled()) return 0;
    try {
      let cursor = '0';
      let totalDeleted = 0;
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          CACHE_SCAN_COUNT,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          totalDeleted += await this.client.del(...keys);
        }
      } while (cursor !== '0');

      return totalDeleted;
    } catch (error: unknown) {
      console.warn('[CacheService] invalidatePattern failed:', (error as Error)?.message || 'Unknown error');
      return 0;
    }
  }

  buildKey(parts: CacheKeyParts): string {
    const keyBase = [CACHE_KEY_PREFIX, parts.resource];
    if (parts.userId) keyBase.push(`u:${parts.userId}`);
    if (parts.role) keyBase.push(`r:${parts.role}`);
    if (parts.params && Object.keys(parts.params).length > 0) {
      const sortedEntries = Object.entries(parts.params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, v]);
      keyBase.push(`p:${JSON.stringify(sortedEntries)}`);
    }
    return keyBase.join(':');
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isEnabled()) return false;
    try {
      await this.client.ping();
      return true;
    } catch (error: unknown) {
      console.warn('[CacheService] health check failed:', (error as Error)?.message || 'Unknown error');
      return false;
    }
  }

  getStats(): {
    totalHits: number;
    totalMisses: number;
    hitRatio: number;
    byResource: Array<{ resource: string; hits: number; misses: number; hitRatio: number }>;
  } {
    try {
      const byResource = Array.from(this.stats.entries()).map(([resource, stat]) => {
        const total = stat.hits + stat.misses;
        return {
          resource,
          hits: stat.hits,
          misses: stat.misses,
          hitRatio: total > 0 ? stat.hits / total : 0,
        };
      });
      const totalHits = byResource.reduce((acc, item) => acc + item.hits, 0);
      const totalMisses = byResource.reduce((acc, item) => acc + item.misses, 0);
      const total = totalHits + totalMisses;
      return {
        totalHits,
        totalMisses,
        hitRatio: total > 0 ? totalHits / total : 0,
        byResource,
      };
    } catch {
      return {
        totalHits: 0,
        totalMisses: 0,
        hitRatio: 0,
        byResource: [],
      };
    }
  }

  private recordGetStat(key: string, isHit: boolean): void {
    try {
      const resource = this.extractResourceFromKey(key);
      const current = this.stats.get(resource) ?? { hits: 0, misses: 0 };
      if (isHit) {
        current.hits += 1;
        this.logger.debug(`[CacheService] HIT resource=${resource}`);
      } else {
        current.misses += 1;
        this.logger.debug(`[CacheService] MISS resource=${resource}`);
      }
      this.stats.set(resource, current);
    } catch {
      return;
    }
  }

  private extractResourceFromKey(key: string): string {
    const prefix = `${CACHE_KEY_PREFIX}:`;
    const withoutPrefix = key.startsWith(prefix) ? key.slice(prefix.length) : key;
    const marker = withoutPrefix.search(/:(u|r|p):/);
    if (marker === -1) return withoutPrefix;
    return withoutPrefix.slice(0, marker);
  }
}