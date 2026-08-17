import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as IORedis from 'ioredis';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class HealthService {
  private redisClient: IORedis.Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  private getRedisClient(): IORedis.Redis {
    if (!this.redisClient) {
      const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
      this.redisClient = new IORedis.default(redisUrl, {
        lazyConnect: true,
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
      });
    }
    return this.redisClient;
  }

  async check() {
    const cacheMetrics = await this.checkCache();
    const results = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const db = results[0];
    const redis = results[1];

    const dbStatus = db.status === 'fulfilled' ? db.value : { status: 'down', error: (db as PromiseRejectedResult).reason?.message };
    const redisStatus = redis.status === 'fulfilled' ? redis.value : { status: 'down', error: (redis as PromiseRejectedResult).reason?.message };

    const allUp = dbStatus.status === 'up' && redisStatus.status === 'up';

    return {
      status: allUp ? 'ok' : 'degraded',
      maintenanceMode: process.env.SYSTEM_MAINTENANCE_MODE === 'true',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbStatus,
        redis: redisStatus,
        cache: cacheMetrics,
      },
    };
  }

  private async checkCache() {
    const enabled = this.cacheService.isEnabled();
    if (!enabled) {
      return { enabled, healthy: false, latencyMs: null, stats: this.cacheService.getStats() };
    }

    const startedAt = Date.now();
    const healthy = await this.cacheService.isHealthy();
    return {
      enabled,
      healthy,
      latencyMs: Date.now() - startedAt,
      stats: this.cacheService.getStats(),
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'down', error: msg };
    }
  }

  private async checkRedis() {
    try {
      const client = this.getRedisClient();
      await client.ping();
      return { status: 'up' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'down', error: msg };
    }
  }
}
